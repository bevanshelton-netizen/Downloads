#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

APP="izakhono-revenue-desk"
OWNED_HOST="${IZAKHONO_REVENUE_OWNED_HOST:-revenue.domains.izakhonoafrica.co.za}"
CANONICAL_HOST="${IZAKHONO_REVENUE_CANONICAL_HOST:-revenue.izakhonoafrica.co.za}"
EXTERNAL_FALLBACK="${IZAKHONO_REVENUE_EXTERNAL_FALLBACK:-https://izakhono-revenue-desk.vercel.app/}"
RECEIPT="/var/lib/izakhono-deploy/revenue-desk.json"
PROMOTION_RECEIPT="/var/lib/izakhono-deploy/revenue-desk-canonical.json"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
CONTROL_URL="http://127.0.0.1:8790"
PROXY_URL="http://127.0.0.1:8080"
CERT_NAME="${IZAKHONO_EDGE_CERT_NAME:-izakhono-owned-edge}"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }
for c in curl node openssl python3 systemctl getent; do need "$c"; done
[ -f "$RECEIPT" ] || fail "Revenue Desk owned deployment receipt is missing."
[ -f "$RUNTIME_ENV" ] || fail "IZAKHONO RUNTIME NODE environment is missing."

write_receipt(){
  local status="$1" public_ip="${2:-}" resolved_ip="${3:-}" tls="${4:-false}" public_https="${5:-NOT_VERIFIED}" detail="${6:-}"
  node - "$PROMOTION_RECEIPT" "$status" "$OWNED_HOST" "$CANONICAL_HOST" "$EXTERNAL_FALLBACK" "$public_ip" "$resolved_ip" "$tls" "$public_https" "$detail" <<'NODE'
const fs=require("fs");
const [path,status,ownedHost,canonicalHost,fallback,publicIp,resolvedIp,tls,publicHttps,detail]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.revenue-desk-canonical-promotion/v1",
  app:"izakhono-revenue-desk",
  status,
  owned_origin:"https://"+ownedHost,
  canonical_hostname:canonicalHost,
  external_fallback:fallback,
  external_fallback_action:"KEEP_INTACT",
  public_ipv4:publicIp||null,
  canonical_resolved_ipv4:resolvedIp||null,
  runtime_alias_verified:true,
  tls_ready:tls==="true",
  public_https:publicHttps,
  payment_boundary:"UNCHANGED",
  detail,
  generated_at:new Date().toISOString()
},null,2)+"\n",{mode:0o600});
NODE
  chmod 0600 "$PROMOTION_RECEIPT"
}

node - "$RECEIPT" "$APP" "$OWNED_HOST" <<'NODE'
const fs=require("fs");
const [path,app,host]=process.argv.slice(2);
const x=JSON.parse(fs.readFileSync(path,"utf8"));
if(x.app!==app) throw new Error("receipt app mismatch");
if(x.hostname!==host) throw new Error("receipt hostname mismatch");
if(x.source!=="IZAKHONO_CODE") throw new Error("receipt source not IZAKHONO_CODE");
if(x.runtime!=="IZAKHONO_RUNTIME") throw new Error("receipt runtime not IZAKHONO_RUNTIME");
if(x.public_https!=="VERIFIED") throw new Error("owned origin is not PUBLIC_HTTPS=VERIFIED");
NODE

curl -fsS --max-time 12 "https://$OWNED_HOST/health" >/tmp/izakhono-revenue-owned-health.json
node -e 'const x=require("/tmp/izakhono-revenue-owned-health.json");if(x.ok!==true||x.service!=="izakhono-revenue-desk")process.exit(2)'

RUNTIME_KEY="$(awk -F= '$1=="IZAKHONO_RUNTIME_KEY"{sub(/^[^=]*=/,"");print;exit}' "$RUNTIME_ENV")"
[ -n "$RUNTIME_KEY" ] || fail "Runtime key unavailable."

ALIAS_BODY="$(node -e 'process.stdout.write(JSON.stringify({hostname:process.argv[1]}))' "$CANONICAL_HOST")"
curl -fsS -X POST "$CONTROL_URL/v1/apps/$APP/aliases"   -H "content-type: application/json"   -H "x-izakhono-key: $RUNTIME_KEY"   --data-binary "$ALIAS_BODY" >/tmp/izakhono-revenue-alias.json

curl -fsS -H "Host: $CANONICAL_HOST" "$PROXY_URL/health" >/tmp/izakhono-revenue-alias-health.json
node -e 'const x=require("/tmp/izakhono-revenue-alias-health.json");if(x.ok!==true||x.service!=="izakhono-revenue-desk"||x.runtime!=="izakhono-owned")process.exit(2)'

PUBLIC_IP="${IZAKHONO_PUBLIC_IPV4:-}"
if [ -z "$PUBLIC_IP" ]; then PUBLIC_IP="$(curl -4fsS --max-time 8 https://api.ipify.org || true)"; fi
node -e 'const p=process.argv[1].split(".").map(Number);if(p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255))process.exit(1)' "$PUBLIC_IP" || fail "A usable public IPv4 was not detected."

RESOLVED_IP="$(getent ahostsv4 "$CANONICAL_HOST" 2>/dev/null | awk 'NR==1{print $1}' || true)"
if [ "$RESOLVED_IP" != "$PUBLIC_IP" ]; then
  write_receipt "DNS_CUTOVER_REQUIRED" "$PUBLIC_IP" "$RESOLVED_IP" false "NOT_VERIFIED" "Owned origin is verified and the runtime alias is ready. Parent DNS for the canonical hostname must now point to the owner public IPv4."
  echo
  echo "REVENUE DESK CANONICAL PROMOTION: DNS CUTOVER REQUIRED"
  echo "Owned origin remains verified: https://$OWNED_HOST"
  echo "Runtime alias prepared: $CANONICAL_HOST -> $APP"
  echo "Parent DNS action:"
  echo "  A  $CANONICAL_HOST -> $PUBLIC_IP"
  echo "External fallback remains intact: $EXTERNAL_FALLBACK"
  echo "After DNS propagation, rerun this launcher to issue/expand TLS and verify public HTTPS."
  echo "RECEIPT=$PROMOTION_RECEIPT"
  exit 20
fi

[ -f /etc/izakhono/tls/fullchain.pem ] || fail "Owned EDGE certificate is missing."
[ -f /etc/izakhono/tls/privkey.pem ] || fail "Owned EDGE private key is missing."

TLS_READY=false
if openssl x509 -in /etc/izakhono/tls/fullchain.pem -noout -checkhost "$CANONICAL_HOST" >/dev/null 2>&1; then
  TLS_READY=true
fi

if [ "$TLS_READY" != true ]; then
  if ! command -v certbot >/dev/null 2>&1; then
    apt-get update >/dev/null
    apt-get install -y certbot >/dev/null
  fi

  mapfile -t CERT_DOMAINS < <(python3 - /etc/izakhono/tls/fullchain.pem "$CANONICAL_HOST" <<'PY'
import ssl,sys
cert=ssl._ssl._test_decode_cert(sys.argv[1])
names=[v for k,v in cert.get("subjectAltName",[]) if k=="DNS"]
if sys.argv[2] not in names:
    names.append(sys.argv[2])
for name in dict.fromkeys(names):
    print(name)
PY
)
  [ "${#CERT_DOMAINS[@]}" -gt 0 ] || fail "Could not read current EDGE certificate SANs."

  CERT_ARGS=()
  for d in "${CERT_DOMAINS[@]}"; do CERT_ARGS+=(-d "$d"); done

  EDGE_WAS_ACTIVE=false
  if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
    EDGE_WAS_ACTIVE=true
    systemctl stop izakhono-edge-node
  fi

  set +e
  certbot certonly --standalone --preferred-challenges http --non-interactive --agree-tos     --register-unsafely-without-email --cert-name "$CERT_NAME" --expand "${CERT_ARGS[@]}"
  CERT_CODE=$?
  set -e

  if [ "$CERT_CODE" -ne 0 ]; then
    if [ "$EDGE_WAS_ACTIVE" = true ]; then systemctl start izakhono-edge-node || true; fi
    write_receipt "TLS_ISSUANCE_FAILED" "$PUBLIC_IP" "$RESOLVED_IP" false "NOT_VERIFIED" "Canonical DNS reaches the owner IP, but trusted TLS could not be issued/expanded. Confirm inbound TCP 80/443 and rerun."
    echo "Trusted TLS issuance failed. Existing certificate and external fallback were not removed." >&2
    echo "RECEIPT=$PROMOTION_RECEIPT"
    exit 21
  fi

  ln -sfn "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" /etc/izakhono/tls/fullchain.pem
  ln -sfn "/etc/letsencrypt/live/$CERT_NAME/privkey.pem" /etc/izakhono/tls/privkey.pem
  systemctl restart izakhono-edge-node
  sleep 1
fi

openssl x509 -in /etc/izakhono/tls/fullchain.pem -noout -checkhost "$CANONICAL_HOST" >/dev/null
curl -kfsS --resolve "$CANONICAL_HOST:443:127.0.0.1" "https://$CANONICAL_HOST/health" >/tmp/izakhono-revenue-canonical-local.json
node -e 'const x=require("/tmp/izakhono-revenue-canonical-local.json");if(x.ok!==true||x.service!=="izakhono-revenue-desk")process.exit(2)'

curl -fsS --max-time 12 "https://$CANONICAL_HOST/health" >/tmp/izakhono-revenue-canonical-public.json
node -e 'const x=require("/tmp/izakhono-revenue-canonical-public.json");if(x.ok!==true||x.service!=="izakhono-revenue-desk")process.exit(2)'

write_receipt "OWNED_LIVE_VERIFIED" "$PUBLIC_IP" "$RESOLVED_IP" true "VERIFIED" "Canonical customer hostname is routed by IZAKHONO RUNTIME alias, covered by trusted TLS and independently verified over public HTTPS."

echo
echo "IZAKHONO REVENUE DESK: OWNED LIVE VERIFIED"
echo "OWNED_ORIGIN=https://$OWNED_HOST"
echo "CANONICAL=https://$CANONICAL_HOST"
echo "PUBLIC_HTTPS=VERIFIED"
echo "EXTERNAL_FALLBACK=$EXTERNAL_FALLBACK"
echo "EXTERNAL_FALLBACK_ACTION=KEEP_INTACT"
echo "PAYMENT_BOUNDARY=UNCHANGED"
echo "RECEIPT=$PROMOTION_RECEIPT"
