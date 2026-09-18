#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
RUNTIME_PID=""
EDGE_PID=""
cleanup(){
  [ -n "$EDGE_PID" ] && kill "$EDGE_PID" 2>/dev/null || true
  [ -n "$RUNTIME_PID" ] && kill "$RUNTIME_PID" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

HOSTNAME="autoai.izakhonoafrica.co.za"
RUNTIME_CONTROL=18790
RUNTIME_PROXY=18080
EDGE_TUNNEL=18780
EDGE_CONTROL=18795
RUNTIME_KEY="ci-runtime-key-$(date +%s)"
EDGE_KEY="ci-edge-key-$(date +%s)"
RELEASE="$TMP/releases/auto-ai/test"

mkdir -p "$TMP/releases/auto-ai" "$TMP/runtime-logs" "$TMP/env" "$TMP/edge-logs"
cp -a "$ROOT/auto-ai" "$RELEASE"

CONTROL_HOST=127.0.0.1 CONTROL_PORT="$RUNTIME_CONTROL" PROXY_HOST=127.0.0.1 PROXY_PORT="$RUNTIME_PROXY" IZAKHONO_RUNTIME_KEY="$RUNTIME_KEY" IZAKHONO_RELEASE_ROOT="$TMP/releases" IZAKHONO_RUNTIME_DB="$TMP/runtime.sqlite" IZAKHONO_RUNTIME_LOG_ROOT="$TMP/runtime-logs" IZAKHONO_ENV_ROOT="$TMP/env" IZAKHONO_APP_PORT_START=19000 node "$ROOT/izakhono-runtime-node/server.mjs" >"$TMP/runtime.out" 2>&1 &
RUNTIME_PID=$!

for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$RUNTIME_CONTROL/health" >/dev/null 2>&1 && break
  sleep .25
done
curl -fsS "http://127.0.0.1:$RUNTIME_CONTROL/health" >/dev/null

BODY="$(node - "$HOSTNAME" "$RELEASE" <<'NODE'
const [hostname,releasePath]=process.argv.slice(2);
process.stdout.write(JSON.stringify({
  app:"auto-ai",
  hostname,
  releasePath,
  command:["node","server.mjs"],
  envFile:null,
  healthPath:"/api/health"
}));
NODE
)"

curl -fsS -X POST "http://127.0.0.1:$RUNTIME_CONTROL/v1/deployments"   -H "content-type: application/json"   -H "x-izakhono-key: $RUNTIME_KEY"   --data-binary "$BODY" >"$TMP/deploy.json"

node - "$TMP/deploy.json" <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(!x.id || x.app!=="auto-ai" || x.hostname!=="autoai.izakhonoafrica.co.za") process.exit(2);
NODE

curl -fsS -H "Host: $HOSTNAME" "http://127.0.0.1:$RUNTIME_PROXY/api/health" >"$TMP/runtime-health.json"
node - "$TMP/runtime-health.json" <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.ok!==true || x.service!=="auto-ai") process.exit(2);
NODE

IZAKHONO_EDGE_MODE=tunnel TUNNEL_HOST=127.0.0.1 TUNNEL_PORT="$EDGE_TUNNEL" CONTROL_HOST=127.0.0.1 CONTROL_PORT="$EDGE_CONTROL" RUNTIME_HOST=127.0.0.1 RUNTIME_PORT="$RUNTIME_PROXY" IZAKHONO_EDGE_KEY="$EDGE_KEY" IZAKHONO_EDGE_ACCESS_LOG="$TMP/edge-logs/access.jsonl" node "$ROOT/izakhono-edge-node/server.mjs" >"$TMP/edge.out" 2>&1 &
EDGE_PID=$!

for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$EDGE_CONTROL/health" >/dev/null 2>&1 && break
  sleep .25
done
curl -fsS "http://127.0.0.1:$EDGE_CONTROL/health" >"$TMP/edge-health.json"

curl -fsS -D "$TMP/headers.txt" -H "Host: $HOSTNAME" "http://127.0.0.1:$EDGE_TUNNEL/api/health" >"$TMP/public-health.json"
grep -qi '^x-izakhono-edge: 1' "$TMP/headers.txt"
node - "$TMP/public-health.json" <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.ok!==true || x.service!=="auto-ai") process.exit(2);
NODE

curl -fsS -H "Host: $HOSTNAME" "http://127.0.0.1:$EDGE_TUNNEL/" >"$TMP/home.html"
grep -q "AUTO AI" "$TMP/home.html"
grep -q "CHECK MY CAR NOW" "$TMP/home.html"

curl -fsS -X POST -H "Host: $HOSTNAME" -H "content-type: application/json"   --data '{"quote":"Diagnostics R350. Labour 2 hours. Replace oxygen sensor after scan test."}'   "http://127.0.0.1:$EDGE_TUNNEL/api/quote-review" >"$TMP/quote.json"
grep -q '"result"' "$TMP/quote.json"

echo "AUTO AI OWNED CLOUD E2E: PASS"
echo "Runtime activation: PASS"
echo "Edge tunnel routing: PASS"
echo "AUTO AI health: PASS"
echo "CTA homepage: PASS"
echo "Quote API: PASS"
