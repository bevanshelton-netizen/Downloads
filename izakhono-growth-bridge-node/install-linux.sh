#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fail(){ echo "FAIL: $*" >&2; exit 10; }
command -v node >/dev/null || fail "Node.js is required"
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(2)' || fail "Node 22.13+ required"
[ -f /etc/izakhono/apps/growth-os.env ] || fail "Growth OS owned env missing"
useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
install -d -o root -g izakhono -m 0750 /opt/izakhono-growth-bridge /etc/izakhono/apps /var/log/izakhono /var/lib/izakhono-deploy
cp "$HERE/server.mjs" "$HERE/policy.mjs" "$HERE/package.json" /opt/izakhono-growth-bridge/
install -d -o root -g izakhono -m 0750 /opt/izakhono-growth-bridge/scripts
cp "$HERE/scripts/self-test.mjs" /opt/izakhono-growth-bridge/scripts/
chown -R root:izakhono /opt/izakhono-growth-bridge
chmod -R g=rX,o= /opt/izakhono-growth-bridge
cd /opt/izakhono-growth-bridge
npm install --omit=dev --no-audit --no-fund
npm test

PAY_ENV="/etc/izakhono/apps/izakhono-pay.env"
PAY_KEY=""
if [ -f "$PAY_ENV" ]; then
  APPS_JSON="$(awk -F= '$1=="IZAKHONO_PAY_APPS_JSON"{sub(/^[^=]*=/,"");print;exit}' "$PAY_ENV" || true)"
  if [ -n "$APPS_JSON" ]; then
    PAY_KEY="$(node -e 'try{const x=JSON.parse(process.argv[1]);process.stdout.write(String(x["growth-os"]||""))}catch{}' "$APPS_JSON")"
  fi
fi
TMP="$(mktemp)"
cat >"$TMP" <<EOF
HOST=127.0.0.1
PORT=8920
IZAKHONO_PAY_URL=http://127.0.0.1:18100
IZAKHONO_PAY_GROWTH_OS_KEY=$PAY_KEY
VERCEL_TEAM_SLUG=bevan2
VERCEL_TEAM_ID=team_XSHdQaQxmXGD1HlK2E4nehif
VERCEL_PROJECT_NAME=izakhono-growth-os-resilience
VERCEL_PROJECT_ID=prj_OpMGIOe5TXhyhn6lHabQOOafRTV6
VERCEL_ENVIRONMENT=production
VERCEL_OIDC_AUDIENCE=https://bridge.domains.izakhonoafrica.co.za
IZAKHONO_GROWTH_BRIDGE_LOG=/var/log/izakhono/growth-bridge-access.jsonl
EOF
install -o root -g izakhono -m 0640 "$TMP" /etc/izakhono/apps/growth-bridge.env
rm -f "$TMP"

cp "$HERE/systemd/izakhono-growth-bridge-node.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now izakhono-growth-bridge-node
for _ in $(seq 1 20); do
  if curl -fsS --max-time 4 http://127.0.0.1:8920/health >/tmp/growth-bridge-health.json 2>/dev/null; then break; fi
  sleep 1
done
node - <<'NODE'
const x=require("/tmp/growth-bridge-health.json");
if(x.ok!==true||x.service!=="izakhono-growth-bridge"||x.runtime!=="izakhono-owned")process.exit(2);
if(x.arbitraryProxy!==false||x.shellAccess!==false||x.secretsReturned!==false)process.exit(3);
if(x.oidc?.project_id!=="prj_OpMGIOe5TXhyhn6lHabQOOafRTV6")process.exit(4);
NODE
node - /var/lib/izakhono-deploy/growth-bridge.json <<'NODE'
const fs=require("fs");
const path=process.argv[2];
const h=require("/tmp/growth-bridge-health.json");
fs.writeFileSync(path,JSON.stringify({
 schema:"izakhono.growth-bridge/v1",
 state:"ACTIVE_LOCAL",
 port:8920,
 bind:"127.0.0.1",
 oidc:h.oidc,
 modules:h.modules,
 arbitrary_proxy:false,
 shell_access:false,
 generated_at:new Date().toISOString()
},null,2)+"\n",{mode:0o600});
NODE
chmod 0600 /var/lib/izakhono-deploy/growth-bridge.json
echo "IZAKHONO GROWTH BRIDGE: ACTIVE LOCAL"
