#!/usr/bin/env bash
# Desarrollo: Next.js + api-gateway (el .env de la raíz lo carga el gateway vía load-env.js).
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
npm run dev --prefix "$ROOT/services/api-gateway" &
PIDS+=("$!")

wait
