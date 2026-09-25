#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OWNED="$ROOT/owned"
DATA_DIR="$(mktemp -d)"
LOG="$(mktemp)"
PID=""

cleanup() {
  if [ -n "$PID" ]; then kill "$PID" >/dev/null 2>&1 || true; fi
  rm -rf "$DATA_DIR" "$LOG"
}
trap cleanup EXIT

cd "$OWNED"
npm install --no-audit --no-fund

ADMIN_SECRET="ci-admin-secret-not-for-production" \
ABUSE_SALT="ci-abuse-salt-not-for-production" \
APP_ENV="test" \
VIDEONOMY_DATA_DIR="$DATA_DIR" \
HOST="127.0.0.1" \
PORT="18081" \
./node_modules/.bin/tsx server.mjs >"$LOG" 2>&1 &
PID=$!

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:18081/api/health >/tmp/videonomy-health.json; then
    grep -q '"service":"VIDEONOMY"' /tmp/videonomy-health.json
    curl -fsS http://127.0.0.1:18081/shorts.html | grep -q 'VIDEONOMY Shorts'
    curl -fsS 'http://127.0.0.1:18081/api/videos?platform=videonomy&format=short' | grep -q '"ok":true'
    echo "VIDEONOMY owned engine smoke: PASS"
    exit 0
  fi
  sleep 1
done

cat "$LOG"
echo "VIDEONOMY owned engine smoke: FAIL" >&2
exit 1
