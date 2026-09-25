#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

APP="${IZAKHONO_BRIDGE_APP:-growth-os-v2}"
HEALTH_PATH="${IZAKHONO_BRIDGE_HEALTH_PATH:-/api/health}"
EXPECTED_SERVICE="${IZAKHONO_BRIDGE_EXPECTED_SERVICE:-growth-os-v2}"
EXPECTED_PRODUCT="${IZAKHONO_BRIDGE_EXPECTED_PRODUCT:-}"
EXPECTED_STATUS="${IZAKHONO_BRIDGE_EXPECTED_STATUS:-}"
CONTROL_URL="http://127.0.0.1:8790"
EDGE_ORIGIN="http://127.0.0.1:8780"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
REPORT_DIR="/var/lib/izakhono-deploy"
SAFE_APP="$(printf '%s' "$APP" | tr -c 'A-Za-z0-9._-' '-')"
REPORT="$REPORT_DIR/tailscale-funnel-${SAFE_APP}.json"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }
for c in curl node systemctl; do need "$c"; done

mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"

[ -f "$RUNTIME_ENV" ] || fail "IZAKHONO RUNTIME NODE is not installed."
curl -fsS "$CONTROL_URL/health" >/dev/null || fail "IZAKHONO RUNTIME NODE is not healthy."
curl -fsS "$EDGE_ORIGIN/health" >/dev/null 2>&1 || true

if ! command -v tailscale >/dev/null 2>&1; then
  echo "Installing Tailscale from the official Linux installer..."
  TMP_INSTALL="$(mktemp)"
  curl -fsSL https://tailscale.com/install.sh -o "$TMP_INSTALL"
  bash "$TMP_INSTALL"
  rm -f "$TMP_INSTALL"
fi

systemctl enable --now tailscaled >/dev/null

STATUS_JSON="$(tailscale status --json 2>/dev/null || true)"
BACKEND_STATE="$(node -e 'try{const x=JSON.parse(process.argv[1]||"{}");process.stdout.write(x.BackendState||"")}catch{}' "$STATUS_JSON")"

write_report(){
  local state="$1" host="${2:-}" public="${3:-false}"
  node - "$REPORT" "$state" "$host" "$public" "$APP" "$HEALTH_PATH" "$EXPECTED_SERVICE" "$EXPECTED_PRODUCT" "$EXPECTED_STATUS" <<'NODE'
const fs=require("fs");
const [path,state,hostname,publicReady,app,healthPath,expectedService,expectedProduct,expectedStatus]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.external-bridge.tailscale/v2",
  provider:"tailscale-funnel",
  app,
  state,
  hostname:hostname||null,
  public_url:hostname?"https://"+hostname:null,
  public_ready:publicReady==="true",
  health_path:healthPath,
  expected_service:expectedService||null,
  expected_product:expectedProduct||null,
  expected_status:expectedStatus||null,
  origin:"IZAKHONO_EDGE_127.0.0.1_8780",
  runtime:"IZAKHONO_RUNTIME",
  fortress_path:true,
  engine_authority:"IZAKHONO_OWNED_RUNTIME",
  provider_is_replaceable_adapter:true,
  generated_at:new Date().toISOString()
},null,2)+"\n",{mode:0o600});
NODE
  chmod 0600 "$REPORT"
}

if [ "$BACKEND_STATE" != "Running" ]; then
  write_report "AUTH_REQUIRED"
  echo
  echo "TAILSCALE_AUTH_REQUIRED"
  echo "Run: sudo tailscale up"
  echo "After browser sign-in completes, rerun this bridge."
  exit 20
fi

DNS_NAME="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write((x.Self?.DNSName||"").replace(/\.$/,""))' "$STATUS_JSON")"
[ -n "$DNS_NAME" ] || fail "Tailscale is connected but no MagicDNS hostname is available."

RUNTIME_KEY="$(awk -F= '$1=="IZAKHONO_RUNTIME_KEY"{sub(/^[^=]*=/,"");print;exit}' "$RUNTIME_ENV")"
[ -n "$RUNTIME_KEY" ] || fail "IZAKHONO_RUNTIME_KEY is unavailable."

ALIAS_BODY="$(node -e 'process.stdout.write(JSON.stringify({hostname:process.argv[1]}))' "$DNS_NAME")"
ALIAS_HTTP="$(curl -sS -o /tmp/izakhono-tailscale-alias.json -w '%{http_code}' -X POST   -H 'content-type: application/json'   -H "x-izakhono-key: $RUNTIME_KEY"   --data-binary "$ALIAS_BODY"   "$CONTROL_URL/v1/apps/$APP/aliases")"
[ "$ALIAS_HTTP" = "201" ] || fail "Could not register Tailscale hostname with IZAKHONO RUNTIME (HTTP $ALIAS_HTTP)."

echo "Publishing IZAKHONO EDGE through Tailscale Funnel..."
set +e
FUNNEL_OUTPUT="$(tailscale funnel --bg --yes --https=443 "$EDGE_ORIGIN" 2>&1)"
FUNNEL_CODE=$?
set -e
printf '%s\n' "$FUNNEL_OUTPUT"

if [ "$FUNNEL_CODE" -ne 0 ]; then
  write_report "FUNNEL_APPROVAL_REQUIRED" "$DNS_NAME"
  echo
  echo "TAILSCALE_FUNNEL_APPROVAL_REQUIRED"
  echo "Approve Funnel for this tailnet, then rerun this bridge."
  exit 21
fi

PUBLIC_URL="https://$DNS_NAME"
PUBLIC_READY=false
for _ in $(seq 1 12); do
  if curl -fsS --max-time 8 "$PUBLIC_URL$HEALTH_PATH" >/tmp/izakhono-tailscale-health.json 2>/dev/null; then
    if node - "$EXPECTED_SERVICE" "$EXPECTED_PRODUCT" "$EXPECTED_STATUS" /tmp/izakhono-tailscale-health.json <<'NODE' 2>/dev/null
const fs=require("fs");
const [service,product,status,path]=process.argv.slice(2);
const x=JSON.parse(fs.readFileSync(path,"utf8"));
if(service && x.service!==service) process.exit(2);
if(product && x.product!==product) process.exit(3);
if(status && x.status!==status) process.exit(4);
if(!service && !product && x.ok!==true) process.exit(5);
NODE
    then
      PUBLIC_READY=true
      break
    fi
  fi
  sleep 2
done

if [ "$PUBLIC_READY" != true ]; then
  write_report "FUNNEL_ACTIVE_PUBLIC_HEALTH_PENDING" "$DNS_NAME"
  echo "Funnel is configured, but $APP public health is not yet verified."
  echo "Public URL: $PUBLIC_URL"
  exit 22
fi

write_report "LIVE_VERIFIED" "$DNS_NAME" true
echo
echo "IZAKHONO EXTERNAL BRIDGE: LIVE AND VERIFIED"
echo "Provider: Tailscale Funnel"
echo "Public URL: $PUBLIC_URL"
echo "Origin: IZAKHONO EDGE -> FORTRESS -> RUNTIME"
echo "Receipt: $REPORT"
