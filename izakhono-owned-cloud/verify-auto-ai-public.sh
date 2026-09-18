#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="${AUTO_AI_HOSTNAME:-autoai.izakhonoafrica.co.za}"
CONTROL_URL="${IZAKHONO_RUNTIME_CONTROL_URL:-http://127.0.0.1:8790}"
PROXY_URL="${IZAKHONO_RUNTIME_PROXY_URL:-http://127.0.0.1:8080}"
EDGE_CONTROL_URL="${IZAKHONO_EDGE_CONTROL_URL:-http://127.0.0.1:8795}"

fail(){ echo "NOT READY: $*" >&2; exit 2; }

curl -fsS "$CONTROL_URL/health" >/dev/null || fail "IZAKHONO RUNTIME NODE health failed."
curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/api/health" >/tmp/auto-ai-runtime-health.json   || fail "AUTO AI is not active in IZAKHONO RUNTIME NODE."
node -e 'const x=require("/tmp/auto-ai-runtime-health.json"); if(x.ok!==true||x.service!=="auto-ai")process.exit(2)'   || fail "AUTO AI runtime health payload is invalid."

EDGE_JSON="$(curl -fsS "$EDGE_CONTROL_URL/health")" || fail "IZAKHONO EDGE NODE health failed."
MODE="$(node -e 'const x=JSON.parse(process.argv[1]); process.stdout.write(x.ingressMode||"")' "$EDGE_JSON")"
[ "$MODE" = "direct" ] || [ "$MODE" = "tunnel" ] || fail "Unknown EDGE ingress mode."

PUBLIC_HEADERS="$(mktemp)"
PUBLIC_BODY="$(mktemp)"
trap 'rm -f "$PUBLIC_HEADERS" "$PUBLIC_BODY" /tmp/auto-ai-runtime-health.json' EXIT

curl -fsS -D "$PUBLIC_HEADERS" "https://$HOSTNAME/api/health" -o "$PUBLIC_BODY"   || fail "Public HTTPS endpoint does not resolve or is unreachable."
grep -qi '^x-izakhono-edge: 1' "$PUBLIC_HEADERS"   || fail "Public endpoint did not prove traffic passed through IZAKHONO EDGE."
node - "$PUBLIC_BODY" <<'NODE' || fail "Public AUTO AI health payload is invalid."
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.ok!==true || x.service!=="auto-ai") process.exit(2);
NODE

curl -fsS "https://$HOSTNAME/" | grep -q "CHECK MY CAR NOW"   || fail "Public homepage is not the current CTA-enabled AUTO AI release."

echo "AUTO AI PUBLIC CUTOVER: VERIFIED"
echo "HOSTNAME=$HOSTNAME"
echo "RUNTIME=VERIFIED"
echo "EDGE=VERIFIED"
echo "INGRESS_MODE=$MODE"
echo "HTTPS=VERIFIED"
echo "CTA_BUILD=VERIFIED"
echo "SAFE_TO_SWITCH_CUSTOMER_LINKS=YES"
