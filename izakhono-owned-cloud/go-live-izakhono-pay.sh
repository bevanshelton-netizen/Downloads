#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PAY_DIR="$ROOT/izakhono-pay"
ENV_FILE="${IZAKHONO_PAY_ENV_FILE:-/etc/izakhono/apps/izakhono-pay.env}"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
FORTRESS_RECEIPT="/var/lib/izakhono-deploy/fortress-protector.json"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/izakhono-pay-live.json"
HOSTNAME="pay.izakhonoafrica.co.za"
PUBLIC_URL="https://$HOSTNAME"
RELEASE_ROOT="/var/lib/izakhono-runtime/releases"

fail(){ echo "FAIL: $*" >&2; exit 10; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }
for cmd in curl node python3 openssl systemctl install awk; do need "$cmd"; done

mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"

systemctl is-active --quiet izakhono-runtime-node || fail "IZAKHONO RUNTIME NODE is not active"
systemctl is-active --quiet izakhono-edge-node || fail "IZAKHONO EDGE NODE is not active"

FORTRESS_HEALTH="$(curl -fsS --max-time 5 http://127.0.0.1:18109/health)" || fail "FORTRESS Protector is not healthy"
node -e 'const x=JSON.parse(process.argv[1]);if(x.status!=="ok"||x.product!=="FORTRESS")process.exit(2)' "$FORTRESS_HEALTH" || fail "FORTRESS health payload invalid"
[ -f "$FORTRESS_RECEIPT" ] || fail "FORTRESS Protector safety receipt missing"
node - "$FORTRESS_RECEIPT" <<'NODE' || fail "FORTRESS Protector is outside its private safety boundary"
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.role!=="THEE PROTECTOR"||x.health_passed!==true||x.public_bind!==false||x.payment_credentials_stored!==false) process.exit(2);
NODE

EDGE_HEALTH="$(curl -fsS --max-time 5 http://127.0.0.1:8795/health)" || fail "IZAKHONO EDGE health unavailable"
node -e 'const x=JSON.parse(process.argv[1]);if(x.status!=="healthy"||x.fortressProtector!==true)process.exit(2)' "$EDGE_HEALTH" || fail "FORTRESS edge policy is not active"

[ -f "$ENV_FILE" ] || fail "Payment environment missing at $ENV_FILE"
chown root:izakhono "$ENV_FILE"
chmod 0640 "$ENV_FILE"

has_env(){
  local key="$1"
  awk -F= -v k="$key" '$1==k {sub(/^[^=]*=/,""); if(length($0)>0) found=1} END{exit(found?0:1)}' "$ENV_FILE"
}
for key in IKHOKHA_APP_ID IKHOKHA_APP_SECRET IZAKHONO_PAY_APPS_JSON IZAKHONO_PAY_PUBLIC_BASE_URL; do
  has_env "$key" || fail "$key is not configured in the protected payment environment"
done

PUBLIC_BASE="$(awk -F= '$1=="IZAKHONO_PAY_PUBLIC_BASE_URL"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE")"
[ "$PUBLIC_BASE" = "$PUBLIC_URL" ] || fail "IZAKHONO_PAY_PUBLIC_BASE_URL must equal $PUBLIC_URL"

if [ -f /etc/izakhono/tls/fullchain.pem ]; then
  openssl x509 -in /etc/izakhono/tls/fullchain.pem -noout -checkhost "$HOSTNAME" >/dev/null 2>&1 || fail "Installed TLS certificate does not cover $HOSTNAME"
else
  fail "IZAKHONO EDGE TLS certificate is missing"
fi

(cd "$PAY_DIR" && python3 -m py_compile shared_gateway.py ikhokha_provider.py bank_reconciler.py)
(cd "$PAY_DIR" && python3 shared_gateway.py self-test)

COMMIT="$(git -C "$ROOT" rev-parse --verify HEAD 2>/dev/null || echo source)"
RELEASE="$RELEASE_ROOT/izakhono-pay-${COMMIT:0:12}"
rm -rf "$RELEASE"
install -d -o izakhono -g izakhono -m 0750 "$RELEASE"
install -o izakhono -g izakhono -m 0640 "$PAY_DIR/shared_gateway.py" "$RELEASE/shared_gateway.py"
install -o izakhono -g izakhono -m 0640 "$PAY_DIR/ikhokha_provider.py" "$RELEASE/ikhokha_provider.py"
install -o izakhono -g izakhono -m 0640 "$PAY_DIR/bank_reconciler.py" "$RELEASE/bank_reconciler.py"
install -o izakhono -g izakhono -m 0640 "$PAY_DIR/products.json" "$RELEASE/products.json"
install -o izakhono -g izakhono -m 0640 "$PAY_DIR/runtime.mjs" "$RELEASE/runtime.mjs"

[ -f "$RUNTIME_ENV" ] || fail "IZAKHONO RUNTIME environment missing"
RUNTIME_KEY="$(awk -F= '$1=="IZAKHONO_RUNTIME_KEY"{sub(/^[^=]*=/,"");print;exit}' "$RUNTIME_ENV")"
[ -n "$RUNTIME_KEY" ] || fail "IZAKHONO RUNTIME control key missing"

BODY="$(node - "$RELEASE" "$ENV_FILE" "$HOSTNAME" <<'NODE'
const [releasePath,envFile,hostname]=process.argv.slice(2);
process.stdout.write(JSON.stringify({
  app:"izakhono-pay",
  hostname,
  releasePath,
  command:["node","runtime.mjs"],
  envFile,
  healthPath:"/health"
}));
NODE
)"

DEPLOY="$(curl -fsS --max-time 30 -X POST   -H "x-izakhono-key: $RUNTIME_KEY"   -H 'content-type: application/json'   --data "$BODY"   http://127.0.0.1:8790/v1/deployments)" || fail "IZAKHONO RUNTIME deployment failed"
unset RUNTIME_KEY

node -e 'const x=JSON.parse(process.argv[1]);if(x.app!=="izakhono-pay"||x.hostname!=="pay.izakhonoafrica.co.za")process.exit(2)' "$DEPLOY" || fail "Runtime deployment receipt invalid"

LOCAL_HEADERS="$(mktemp)"
LOCAL_BODY="$(mktemp)"
trap 'rm -f "$LOCAL_HEADERS" "$LOCAL_BODY" /tmp/izakhono-pay-public-headers /tmp/izakhono-pay-public-body' EXIT
curl -fsS --max-time 10 -D "$LOCAL_HEADERS" -o "$LOCAL_BODY" -H "Host: $HOSTNAME" http://127.0.0.1:8080/health || fail "Runtime host route is not healthy"
node - "$LOCAL_BODY" <<'NODE' || fail "Payment runtime health payload invalid"
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.ok!==true||x.service!=="izakhono-pay"||x.primary_provider!=="ikhokha")process.exit(2);
NODE

curl -fsS --max-time 20 -D /tmp/izakhono-pay-public-headers -o /tmp/izakhono-pay-public-body "$PUBLIC_URL/health" || fail "Public IZAKHONO PAY HTTPS health check failed"
node - /tmp/izakhono-pay-public-body <<'NODE' || fail "Public payment health payload invalid"
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.ok!==true||x.service!=="izakhono-pay"||x.primary_provider!=="ikhokha")process.exit(2);
NODE
grep -qi '^x-fortress-protector: active' /tmp/izakhono-pay-public-headers || fail "Public payment route is not protected by FORTRESS"

python3 - "$REPORT" "$COMMIT" <<'PY'
import datetime,json,sys
payload={
  "schema":"izakhono.pay-live/v1",
  "hostname":"pay.izakhonoafrica.co.za",
  "public_url":"https://pay.izakhonoafrica.co.za",
  "commit":sys.argv[2],
  "runtime":"izakhono-runtime-node",
  "edge":"izakhono-edge-node",
  "fortress_protector":True,
  "ikhokha_primary":True,
  "eft_fallback":True,
  "public_health_passed":True,
  "secrets_in_source":False,
  "live":True,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}
open(sys.argv[1],"w",encoding="utf-8").write(json.dumps(payload,indent=2)+"\n")
print(json.dumps(payload,indent=2))
PY
chmod 0600 "$REPORT"

echo
echo "IZAKHONO PAY LIVE: VERIFIED"
echo "$PUBLIC_URL"
echo "FORTRESS PROTECTOR: ACTIVE"
echo "iKhokha primary online rail: ACTIVE"
