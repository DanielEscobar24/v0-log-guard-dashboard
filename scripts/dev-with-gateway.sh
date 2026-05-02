#!/usr/bin/env bash
# Desarrollo: Next.js + api-log-guard (el .env de la raíz lo carga el backend vía load-env.js).
# analytics-engine / ingestion-service solo llevan datos Kaggle→BD; no van aquí. Para esa ingesta: npm run dev:workers
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/node_modules/.bin:$PATH"

cleanup() {
  for pid in "${PIDS[@]-}"; do
    [[ -n "$pid" ]] || continue
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup INT TERM EXIT

declare -a PIDS=()
next dev --webpack &
PIDS+=("$!")
npm run dev --prefix "$ROOT/services/api-log-guard" &
PIDS+=("$!")

ML_DIR="$ROOT/services/guard-logs-ml"
ML_PY="$ML_DIR/.venv/bin/python"

if [[ -x "$ML_PY" ]]; then
  (
    cd "$ML_DIR"
    "$ML_PY" -u main.py
  ) &
  PIDS+=("$!")
else
  echo "Aviso: Guard-logs-ML no se inició porque falta $ML_PY" >&2
  echo "Crea su venv con: cd services/guard-logs-ml && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
fi

wait
