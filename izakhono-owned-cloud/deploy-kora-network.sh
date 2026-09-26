#!/usr/bin/env bash
set -euo pipefail

ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
ENV_SOURCE="${KORA_ENV_FILE:-/etc/izakhono/kora-network.env}"
STATE_DIR="/var/lib/izakhono-deploy"
SAFE_ENV="$(mktemp)"
trap 'rm -f "$SAFE_ENV"' EXIT INT TERM

for c in git docker curl python3; do command -v "$c" >/dev/null 2>&1 || { echo "$c required"; exit 2; }; done
[ -d "$ROOT/.git" ] || { echo "Canonical IZAKHONO source missing"; exit 3; }
[ -s "$ENV_SOURCE" ] || { echo "Protected KORA environment missing: $ENV_SOURCE"; exit 4; }

REVISION="$(git -C "$ROOT" rev-parse HEAD)"
mkdir -p "$STATE_DIR"
chmod 0700 "$STATE_DIR"

python3 - "$ENV_SOURCE" "$SAFE_ENV" <<'PY'
from pathlib import Path
import sys
src=Path(sys.argv[1]); dst=Path(sys.argv[2])
updates={
 "PAYFAST_SANDBOX":"true",
 "KORA_TICKET_CHECKOUT_MODE":"off",
 "KORA_TICKET_LIVE_APPROVED":"false",
 "KORA_IZAKHONO_PAY_LIVE_APPROVED":"false",
 "KORA_PRIVATE_SIGNUP_ENABLED":"true",
 "IZAKHONO_ANALYTICS_URL":"http://127.0.0.1:18112",
}
out=[]; seen=set()
for line in src.read_text(encoding="utf-8").splitlines():
    s=line.strip()
    if s and not s.startswith("#") and "=" in line:
        key=line.split("=",1)[0].strip()
        if key in updates:
            out.append(f"{key}={updates[key]}"); seen.add(key); continue
    out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f"{k}={v}")
dst.write_text("\n".join(out)+"\n",encoding="utf-8")
dst.chmod(0o600)
PY

cd "$ROOT"
KORA_ENV_FILE="$SAFE_ENV" GITHUB_SHA="$REVISION" IZAKHONO_CANARY_PORT=18207 IZAKHONO_PRODUCTION_PORT=18107 sh kora-network/scripts/izakhono-production-cutover.sh

HEALTH="$(curl -fsS --max-time 8 http://127.0.0.1:18107/api/health)"
node - "$STATE_DIR/kora-network.json" "$REVISION" "$HEALTH" <<'NODE'
const fs=require('fs');
const [path,revision,healthRaw]=process.argv.slice(2);
const health=JSON.parse(healthRaw);
if(health.ok!==true) process.exit(2);
fs.writeFileSync(path,JSON.stringify({
 schema:'izakhono.infrastructure-deployment/v1',
 app:'kora-network',product:'KORA',revision,
 runtime_authority:'IZAKHONO_INFRASTRUCTURE',
 runtime:'docker-loopback-private-beta',
 local_url:'http://127.0.0.1:18107',
 health_passed:true,
 payment_mode:'sandbox-locked',
 laptop_target:false,platform_to_laptop_traffic:'DENY',
 public_dns_changed:false,public_traffic_changed:false,live_payments_changed:false,
 public_live_claim:false,external_resilience_preserved:true,
 deployed_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE

echo "KORA_INFRASTRUCTURE_DEPLOYMENT=VERIFIED"
echo "PUBLIC_LIVE_CLAIM=false"
