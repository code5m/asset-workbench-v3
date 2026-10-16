#!/usr/bin/env bash
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if ! command -v java >/dev/null 2>&1; then
  echo "BLOCKED: JDK 17+ is required; install a trusted JDK before continuing." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "BLOCKED: Python 3.9+ is required." >&2
  exit 1
fi
VENV="$APP_ROOT/.asset-workbench-data/toolchains/sql-python"
python3 -m venv "$VENV"
"$VENV/bin/python" -m pip install --disable-pip-version-check --require-hashes -r "$APP_ROOT/tools/semantic/requirements.txt"
"$VENV/bin/python" -c 'import sqlglot; print("SQLGlot ready:", sqlglot.__version__)'
java -version
echo "Semantic engine installed in Framework-managed venv (not the business project)."
echo "AI refactoring additionally requires local Ollama and a cached, network-isolated Maven/JDK Docker image."
