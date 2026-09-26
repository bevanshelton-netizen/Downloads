#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

for c in node git curl flock timeout systemctl install; do
  command -v "$c" >/dev/null 2>&1 || { echo "$c is required"; exit 2; }
done

bash "$HERE/host-eligibility.sh"

[ -d "$ROOT/.git" ] || { echo "Canonical IZAKHONO source checkout is required."; exit 3; }
[ -s "$ROOT/IZAKHONO-INFRASTRUCTURE-AUTHORITY.json" ] || { echo "Infrastructure authority contract missing."; exit 4; }

node - "$ROOT/IZAKHONO-INFRASTRUCTURE-AUTHORITY.json" <<'NODE'
const fs=require('fs');
const p=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(p.runtime_authority!=='IZAKHONO_INFRASTRUCTURE') process.exit(2);
if(p.laptop?.role!=='ADMIN_CLIENT_ONLY'||p.laptop?.deployment_target!==false) process.exit(3);
if(p.communication_policy?.platform_to_laptop!=='DENY') process.exit(4);
NODE

install -d -o root -g root -m 0750 /opt/izakhono-infrastructure-executor
install -d -o root -g root -m 0700 /var/lib/izakhono-infrastructure-executor
install -d -o root -g root -m 0755 /etc/izakhono

install -o root -g root -m 0750 "$HERE/run-once.sh" /opt/izakhono-infrastructure-executor/run-once.sh
install -o root -g root -m 0750 "$HERE/sync-source.sh" /opt/izakhono-infrastructure-executor/sync-source.sh
install -o root -g root -m 0750 "$HERE/host-eligibility.sh" /opt/izakhono-infrastructure-executor/host-eligibility.sh
install -o root -g root -m 0640 "$HERE/targets.json" /opt/izakhono-infrastructure-executor/targets.json

if [ ! -f /etc/izakhono/infrastructure-executor.env ]; then
  cat >/etc/izakhono/infrastructure-executor.env <<'EOF'
IZAKHONO_INFRA_SOURCE_ROOT=/opt/izakhono-source/Downloads
IZAKHONO_INFRA_EXECUTOR_STATE_DIR=/var/lib/izakhono-infrastructure-executor
IZAKHONO_INFRA_EXECUTOR_DEPLOY_TIMEOUT_SECONDS=3600
IZAKHONO_EXECUTOR_ALLOW_EXTERNAL_SOURCE_FALLBACK=1
EOF
  chmod 0600 /etc/izakhono/infrastructure-executor.env
fi

install -o root -g root -m 0644 "$HERE/systemd/izakhono-infrastructure-executor.service" /etc/systemd/system/izakhono-infrastructure-executor.service
install -o root -g root -m 0644 "$HERE/systemd/izakhono-infrastructure-executor.timer" /etc/systemd/system/izakhono-infrastructure-executor.timer

systemctl daemon-reload
systemctl enable --now izakhono-infrastructure-executor.timer
systemctl start izakhono-infrastructure-executor.service || true

echo
echo "IZAKHONO INFRASTRUCTURE EXECUTOR: INSTALLED"
echo "HOST_ROLE=MANAGED_INFRASTRUCTURE_ONLY"
echo "LAPTOP_ELIGIBLE=false"
echo "PLATFORM_TO_LAPTOP=DENY"
echo "CONTROL=infrastructure/control/portfolio-desired-state.json"
echo "STATE=/var/lib/izakhono-infrastructure-executor/status.json"
