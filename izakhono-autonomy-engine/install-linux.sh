#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$HERE/../izakhono-infrastructure-executor/host-eligibility.sh"
bash "$HERE/../izakhono-infrastructure-executor/install-linux.sh"
install -d -o root -g root -m 0750 /opt/izakhono-autonomy-engine
install -o root -g root -m 0750 "$HERE/run.sh" /opt/izakhono-autonomy-engine/run.sh
install -o root -g root -m 0644 "$HERE/systemd/izakhono-autonomy-engine.service" /etc/systemd/system/izakhono-autonomy-engine.service
install -o root -g root -m 0644 "$HERE/systemd/izakhono-autonomy-engine.timer" /etc/systemd/system/izakhono-autonomy-engine.timer
systemctl daemon-reload
systemctl disable --now izakhono-infrastructure-executor.timer 2>/dev/null || true
systemctl enable --now izakhono-autonomy-engine.timer
systemctl start izakhono-autonomy-engine.service
echo "IZAKHONO AUTONOMY ENGINE: ACTIVE"
echo "LAPTOP_ROLE=ADMIN_CLIENT_ONLY"
echo "LAPTOP_RUNTIME_DEPENDENCY=false"
