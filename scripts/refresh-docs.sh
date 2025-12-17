#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${DOCS_PORT:-3003}"
APP_URL="${APP_URL:-http://localhost:${PORT}/hisaab}"
HEALTH_URL="${APP_URL%/}/dashboard"
LOG_DIR="$ROOT_DIR/.context"
LOG_FILE="$LOG_DIR/docs-refresh-dev.log"
STARTED_SERVER=0
SERVER_PID=""

mkdir -p "$LOG_DIR"

cleanup() {
  if [[ "$STARTED_SERVER" -eq 1 && -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  echo "Using existing app at $APP_URL"
else
  echo "Starting dev server on port $PORT..."
  npm run dev -- --port "$PORT" >"$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  STARTED_SERVER=1

  for _ in {1..90}; do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Dev server failed to start. Check $LOG_FILE"
    exit 1
  fi
fi

echo "Regenerating screenshots..."
APP_URL="$APP_URL" node scripts/take-screenshots.mjs

echo "Syncing README and running doc checks..."
node scripts/update-readme.mjs

echo "Documentation refresh complete."
