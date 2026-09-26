#!/usr/bin/env bash
set -euo pipefail

ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
STATE_DIR="/var/lib/izakhono-deploy"
ENV_SOURCE="${FAISREADY_ENV_FILE:-/etc/izakhono/faisready.env}"

for c in git docker curl node; do command -v "$c" >/dev/null 2>&1 || { echo "$c required"; exit 2; }; done
[ -d "$ROOT/.git" ] || { echo "Canonical IZAKHONO source missing"; exit 3; }
REVISION="$(git -C "$ROOT" rev-parse HEAD)"
mkdir -p "$STATE_DIR"
chmod 0700 "$STATE_DIR"

cd "$ROOT"
if [ -s "$ENV_SOURCE" ]; then
  export FAISREADY_ENV_FILE="$ENV_SOURCE"
else
  unset FAISREADY_ENV_FILE || true
fi

GITHUB_SHA="$REVISION" IZAKHONO_CANARY_PORT=18211 IZAKHONO_PRODUCTION_PORT=18111 IZAKHONO_ANALYTICS_URL=http://127.0.0.1:18112 sh FAISReady/scripts/izakhono-production-cutover.sh

HEALTH="$(curl -fsS --max-time 8 http://127.0.0.1:18111/health)"
CFG="$(curl -fsS --max-time 8 http://127.0.0.1:18111/api/config)"
node - "$STATE_DIR/faisready.json" "$REVISION" "$HEALTH" "$CFG" <<'NODE'
const fs=require('fs');
const [path,revision,healthRaw,cfgRaw]=process.argv.slice(2);
const health=JSON.parse(healthRaw),cfg=JSON.parse(cfgRaw);
if(health.ok!==true||cfg.payments_configured!==false) process.exit(2);
fs.writeFileSync(path,JSON.stringify({
 schema:'izakhono.infrastructure-deployment/v1',
 app:'faisready',product:'FAISReady',revision,
 runtime_authority:'IZAKHONO_INFRASTRUCTURE',
 runtime:'docker-loopback-controlled-pilot',
 local_url:'http://127.0.0.1:18111',
 health_passed:true,payments_configured:false,
 laptop_target:false,platform_to_laptop_traffic:'DENY',
 public_dns_changed:false,public_traffic_changed:false,live_payments_changed:false,
 public_live_claim:false,external_resilience_preserved:true,
 deployed_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE

echo "FAISREADY_INFRASTRUCTURE_DEPLOYMENT=VERIFIED"
echo "PUBLIC_LIVE_CLAIM=false"
