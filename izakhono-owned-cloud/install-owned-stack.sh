#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1"; exit 2; }
}

need node
need sudo
need systemctl

node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22 || (a===22 && b<13)) process.exit(1)' || {
  echo "Node.js 22.13+ is required."
  exit 3
}

install_component() {
  local name="$1"
  local dir="$ROOT/$2"
  echo "Installing $name..."
  if [ ! -f "$dir/install-linux.sh" ]; then
    echo "Installer missing for $name: $dir/install-linux.sh"
    exit 4
  fi
  (cd "$dir" && bash install-linux.sh)
}

install_component "IZAKHONO DATA NODE" "izakhono-data-node"
install_component "IZAKHONO RUNTIME NODE" "izakhono-runtime-node"
install_component "IZAKHONO OBJECT NODE" "izakhono-object-node"
install_component "IZAKHONO QUEUE NODE" "izakhono-queue-node"
install_component "IZAKHONO AUTH NODE" "izakhono-auth-node"
install_component "IZAKHONO ANALYTICS NODE" "izakhono-analytics-node"
install_component "IZAKHONO NOTIFY NODE" "izakhono-notify-node"
install_component "IZAKHONO AI GATEWAY NODE" "izakhono-ai-gateway-node"
install_component "IZAKHONO CODE NODE" "izakhono-code-node"
install_component "IZAKHONO PACKAGE NODE" "izakhono-package-node"
install_component "IZAKHONO CI WORKER NODE" "izakhono-ci-worker-node"
install_component "IZAKHONO BACKUP NODE" "izakhono-backup-node"
install_component "IZAKHONO REPLICA NODE" "izakhono-replica-node"

if [ "${IZAKHONO_EDGE_MODE:-direct}" = "tunnel" ]; then
  (cd "$ROOT/izakhono-edge-node" && IZAKHONO_EDGE_MODE=tunnel bash install-linux.sh)
  EDGE_STATUS="INSTALLED_TUNNEL_ORIGIN"
elif [ -f /etc/izakhono/tls/fullchain.pem ] && [ -f /etc/izakhono/tls/privkey.pem ]; then
  install_component "IZAKHONO EDGE NODE" "izakhono-edge-node"
  EDGE_STATUS="INSTALLED_DIRECT_TLS"
else
  EDGE_STATUS="EDGE_PENDING_TLS_OR_TUNNEL"
fi

echo
echo "IZAKHONO OWNED CLOUD INSTALL COMPLETE"
echo "DATA=INSTALLED"
echo "RUNTIME=INSTALLED"
echo "OBJECT=INSTALLED"
echo "QUEUE=INSTALLED"
echo "AUTH=INSTALLED"
echo "ANALYTICS=INSTALLED"
echo "NOTIFY=INSTALLED"
echo "AI_GATEWAY=INSTALLED"
echo "CODE=INSTALLED"
echo "PACKAGE=INSTALLED"
echo "CI_WORKER=INSTALLED"
echo "BACKUP=INSTALLED"
echo "REPLICA=INSTALLED"
echo "EDGE=$EDGE_STATUS"
echo
echo "Next:"
echo "  sudo bash $HERE/bootstrap-owner.sh"
echo "  sudo bash $HERE/configure-growth-os.sh"
echo "  sudo bash $HERE/configure-stack-backup.sh"
echo "  sudo bash $HERE/first-host-proof.sh"
