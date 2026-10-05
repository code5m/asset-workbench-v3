# Language and Ecosystem Support

Asset Workbench's core asset model is intentionally language-neutral. The first
performance/open-source compatibility gate explicitly covers these ecosystems:

| Ecosystem | Source recognition | Generated directories ignored | Manifest recognition |
| --- | --- | --- | --- |
| Java | `.java` | `target/`, `.gradle/` | `pom.xml`, `build.gradle`, `settings.gradle` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` | `node_modules/`, `dist/`, framework caches | `package.json`, lockfiles |
| TypeScript | `.ts`, `.tsx` | same JS build caches | `tsconfig.json` |
| Python | `.py`, `.pyi` | `__pycache__/`, `.venv/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/` | `pyproject.toml`, `requirements.txt`, `poetry.lock` |
| Rust | `.rs` | `target/` | `Cargo.toml`, `Cargo.lock` |

These labels improve browsing and future CodeGraph routing. They do **not** fork the
workspace model by language. Repository identity, lazy directory loading, Diff,
Manifest, Transcript, and Provider semantics stay shared.

## UI locales

The UI currently maintains complete Simplified Chinese (`zh-CN`) and English
(`en`) dictionaries. New locales should be added through the i18n registry rather
than component-local conditionals.
