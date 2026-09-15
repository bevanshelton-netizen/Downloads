#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_DIR=/var/lib/izakhono-deploy
REPORT="$REPORT_DIR/primary-deployment.txt"
mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"

echo "IZAKHONO OWNED CLOUD PRIMARY DEPLOYMENT" | tee "$REPORT"
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$REPORT"

bash "$HERE/install-owned-stack.sh" | tee -a "$REPORT"
bash "$HERE/configure-growth-os.sh" | tee -a "$REPORT"
bash "$HERE/configure-stack-backup.sh" | tee -a "$REPORT"

if [ ! -f /etc/izakhono/code-source.env ]; then
  echo "Migrating bootstrap source into IZAKHONO CODE..." | tee -a "$REPORT"
  bash "$HERE/migrate-source-to-code.sh" | tee -a "$REPORT"
else
  echo "IZAKHONO CODE source already configured; migration skipped." | tee -a "$REPORT"
fi

bash "$HERE/first-host-proof.sh" | tee -a "$REPORT"

echo | tee -a "$REPORT"
bash "$HERE/stack-status.sh" | tee -a "$REPORT"

{
  echo
  echo "DEPLOYMENT_STATE=PRIMARY_NODE_PROVED"
  echo "GITHUB_RUNTIME_DEPENDENCY=NO"
  echo "VERCEL_RUNTIME_DEPENDENCY=NO"
  echo "PUBLIC_EDGE=$([ -f /etc/izakhono/tls/fullchain.pem ] && echo READY_FOR_DNS || echo PENDING_TLS)"
  echo "PHYSICAL_REPLICA=REQUIRES_SEPARATE_HOST"
  echo "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} | tee -a "$REPORT"

echo
echo "Primary node software deployment and proof complete."
echo "Report: $REPORT"
