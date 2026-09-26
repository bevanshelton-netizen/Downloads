#!/usr/bin/env bash
set -euo pipefail

ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
STATE_DIR="/var/lib/izakhono-deploy"
[ -d "$ROOT/.git" ] || { echo "Canonical IZAKHONO source missing"; exit 2; }
cd "$ROOT"
REVISION="$(git rev-parse HEAD)"
mkdir -p "$STATE_DIR"
chmod 0700 "$STATE_DIR"

GITHUB_SHA="$REVISION" sh scripts/izakhono/portfolio-cutover.sh izakhono-command-center ports/izakhono-command-center 18103 /healthz.txt

curl -fsS --max-time 8 http://127.0.0.1:18103/healthz.txt >/dev/null
node - "$STATE_DIR/izakhono-command-center.json" "$REVISION" <<'NODE'
const fs=require('fs');
const [path,revision]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:'izakhono.infrastructure-workload-deployment/v1',
  workload:'izakhono-command-center',revision,
  runtime_authority:'IZAKHONO_INFRASTRUCTURE',
  local_url:'http://127.0.0.1:18103',
  health_passed:true,
  laptop_target:false,
  platform_to_laptop_traffic:'DENY',
  public_live_claim:false,
  deployed_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE
echo "IZAKHONO_COMMAND_CENTER_INFRASTRUCTURE=VERIFIED"
echo "PUBLIC_LIVE_CLAIM=false"
