#!/usr/bin/env python3
"""Bounded MyBatis XML dynamic SQL branch + SQLGlot AST lineage.

Input is a Framework-managed, Git-pinned Raw source staging directory. Never
evaluates OGNL, expands real database values or runs project code. Conditions
are symbolic; unresolved identifiers and truncated variants remain explicit.
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    import sqlglot
    from sqlglot import exp
except ImportError as exc:
    raise SystemExit("sqlglot not installed; run pip install -r tools/semantic/requirements.txt") from exc

MAX_FILES = 3000
MAX_VARIANTS = 24
MAX_SQL_LENGTH = 120000
PARAM = re.compile(r"#\{[^}]{1,200}\}")
UNSAFE = re.compile(r"\$\{([^}]{1,200})\}")


def strip_xml(src: str) -> str:
    # MyBatis documents commonly include an external DTD. ElementTree does
    # not fetch it; strip the declaration and reject arbitrary entity markup.
    if "<!ENTITY" in src.upper() or "<![CDATA[" not in src and "<!DOCTYPE" in src.upper() and "[" in src.split("]>", 1)[0]:
        raise ValueError("XML custom entities/DTD subsets are unsupported")
    return re.sub(r"<!DOCTYPE\s+[^>]*>", "", src, count=1, flags=re.I)


def render_element(node, fragments, namespace, predicates=(), depth=0):
    if depth > 18:
        return [("", predicates, ("include depth exceeded",))]
    tag = node.tag.split("}")[-1].lower()
    text = node.text or ""
    warnings = ()
    if tag == "include":
        refid = node.get("refid", "")
        key = refid if "." in refid else namespace + "." + refid
        if key not in fragments:
            return [(" ", predicates, ("unresolved include:" + key,))]
        if key in predicates:
            return [(" ", predicates, ("recursive include:" + key,))]
        return render_element(fragments[key], fragments, key.rsplit(".", 1)[0],
                              predicates + ("include:" + key,), depth + 1)
    if tag == "if":
        test = node.get("test", "").strip() or "unknown"
        present = render_children(node, fragments, namespace, predicates + ("if:" + test,), depth + 1)
        return present + [("", predicates + ("else:" + test,), ())]
    if tag == "choose":
        branches = []
        for child in node:
            name = child.tag.split("}")[-1].lower()
            if name in ("when", "otherwise"):
                guard = ("when:" + child.get("test", "")) if name == "when" else "otherwise"
                branches.extend(render_children(child, fragments, namespace, predicates + (guard,), depth + 1))
        return branches or [("", predicates, ("choose without branches",))]
    if tag == "foreach":
        children = render_children(node, fragments, namespace, predicates + ("foreach:" + node.get("collection", "?"),), depth + 1)
        return [(node.get("open", "(") + " " + (part or "?") + " " + node.get("close", ")"),
                 conditions, problems + ("foreach cardinality is runtime-dependent",)) for part, conditions, problems in children]
    return render_children(node, fragments, namespace, predicates, depth + 1)


def render_children(node, fragments, namespace, predicates=(), depth=0):
    possibilities = [(node.text or "", predicates, ())]
    for child in node:
        cases = render_element(child, fragments, namespace, predicates, depth + 1)
        next_cases = []
        for prefix, conditions, prior_warnings in possibilities:
            for text, child_conditions, warnings in cases:
                merged = tuple(dict.fromkeys(conditions + child_conditions))
                next_cases.append((prefix + " " + text + " " + (child.tail or ""),
                                   merged, prior_warnings + warnings))
                if len(next_cases) >= MAX_VARIANTS:
                    break
            if len(next_cases) >= MAX_VARIANTS:
                break
        possibilities = next_cases
    tag = node.tag.split("}")[-1].lower()
    if tag in ("where", "set", "trim"):
        cleaned = []
        for text, conditions, warnings in possibilities:
            body = text.strip()
            if tag == "where":
                body = re.sub(r"^(?:AND|OR)\b", "", body, flags=re.I).strip()
                text = (" WHERE " + body) if body else ""
            elif tag == "set":
                body = body.rstrip(", ")
                text = (" SET " + body) if body else ""
            else:
                for token in (node.get("prefixOverrides", "").split("|")):
                    if token.strip() and body.upper().startswith(token.strip().upper()):
                        body = body[len(token):].strip()
                for token in node.get("suffixOverrides", "").split("|"):
                    if token.strip() and body.upper().endswith(token.strip().upper()):
                        body = body[:-len(token)].strip()
                text = (" " + node.get("prefix", "") + " " + body + " " + node.get("suffix", "")) if body else ""
            cleaned.append((text, conditions, warnings))
        possibilities = cleaned
    return possibilities


def table_lineage(sql):
    clean = PARAM.sub("?", sql)
    dynamic_identifiers = UNSAFE.findall(clean)
    clean = UNSAFE.sub("__dynamic_identifier__", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    if not clean:
        return {"reads": [], "writes": [], "columns": [], "parseError": "empty SQL", "dynamicIdentifiers": dynamic_identifiers}
    if len(clean) > MAX_SQL_LENGTH:
        return {"reads": [], "writes": [], "columns": [], "parseError": "SQL too large", "dynamicIdentifiers": dynamic_identifiers}
    try:
        trees = sqlglot.parse(clean, read="mysql", error_level="RAISE")
        reads, writes, columns = set(), set(), set()
        for tree in trees:
            if tree is None:
                continue
            if isinstance(tree, (exp.Insert, exp.Update, exp.Delete, exp.Merge, exp.Create)):
                target = tree.this
                if isinstance(target, exp.Schema):
                    target = target.this
                if isinstance(target, exp.Table):
                    writes.add(target.sql(dialect="mysql"))
            ctes = {cte.alias_or_name.lower() for cte in tree.find_all(exp.CTE)}
            for table in tree.find_all(exp.Table):
                value = table.sql(dialect="mysql")
                if table.name.lower() not in ctes and value not in writes:
                    reads.add(value)
            for col in tree.find_all(exp.Column):
                columns.add(col.sql(dialect="mysql"))
        return {"reads": sorted(reads), "writes": sorted(writes), "columns": sorted(columns),
                "parseError": None, "dynamicIdentifiers": dynamic_identifiers}
    except Exception as exc:
        return {"reads": [], "writes": [], "columns": [], "parseError": str(exc)[:260],
                "dynamicIdentifiers": dynamic_identifiers}


def analyze(directory: Path):
    results = []
    errors = []
    paths = sorted(p for p in directory.rglob("*") if p.is_file() and p.suffix.lower() in (".xml", ".sql"))
    incomplete = len(paths) > MAX_FILES
    paths = paths[:MAX_FILES]
    parsed = []
    fragments = {}
    for file in paths:
        relative = file.relative_to(directory).as_posix()
        if file.stat().st_size > 2 * 1024 * 1024:
            errors.append(relative + ": size cap"); continue
        try:
            source = file.read_text("utf-8")
            if file.suffix.lower() == ".sql":
                parsed.append((relative, None, None, source))
                continue
            xml = ET.fromstring(strip_xml(source))
            if xml.tag.split("}")[-1].lower() != "mapper":
                continue
            ns = xml.get("namespace", relative)
            parsed.append((relative, ns, xml, None))
            for tag in xml.iter():
                if tag.tag.split("}")[-1].lower() == "sql" and tag.get("id"):
                    fragments[ns + "." + tag.get("id")] = tag
        except Exception as exc:
            errors.append(relative + ": XML failure " + str(exc)[:140])
    for relative, namespace, xml, direct in parsed:
        items = [("file", direct, ())] if direct is not None else []
        if xml is not None:
            items = []
            for node in xml:
                tag = node.tag.split("}")[-1].lower()
                if tag in ("select", "insert", "update", "delete"):
                    sid = namespace + "." + (node.get("id") or "unknown")
                    branches = render_children(node, fragments, namespace)
                    for idx, (sql, conditions, warn) in enumerate(branches[:MAX_VARIANTS]):
                        items.append((sid + "#" + str(idx), sql, conditions + warn))
                    if len(branches) >= MAX_VARIANTS:
                        incomplete = True
        for statement, text, conditions in items:
            semantic = table_lineage(text or "")
            unresolved = bool(semantic["parseError"] or semantic["dynamicIdentifiers"]
                              or any(x.startswith(("unresolved ", "recursive ", "foreach ")) for x in conditions))
            if unresolved: incomplete = True
            results.append({
                "file": relative, "statement": statement, "conditions": list(conditions),
                "reads": semantic["reads"], "writes": semantic["writes"], "columns": semantic["columns"],
                "dynamicIdentifiers": semantic["dynamicIdentifiers"], "parseError": semantic["parseError"],
                "complete": not unresolved,
            })
    return {
        "engine": "sqlglot-mybatis-symbolic", "status": "partial" if (incomplete or errors) else "verified",
        "analyzedFiles": len(paths), "statements": results, "errors": errors,
        "limitations": [
            "MyBatis OGNL conditions are not executed; lineage is symbolic over bounded branches.",
            "SQL with ${identifier} depends on runtime values and is marked unresolved.",
            "Dynamic identifiers, vendor extensions and generated SQL require recorded runtime BoundSql evidence.",
            "Column-to-column lineage without schema/catalog bindings is not claimed as complete.",
        ],
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: mybatis_lineage.py <staged-raw-root> <report.json>")
    source_root = Path(sys.argv[1]).resolve(strict=True)
    report = analyze(source_root)
    dest = Path(sys.argv[2]).resolve()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": report["status"], "statements": len(report["statements"])}))
