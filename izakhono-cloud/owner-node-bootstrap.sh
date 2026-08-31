#!/usr/bin/env bash
set -euo pipefail

VERIFIED_INSTALLER_REF=${IZAKHONO_INSTALLER_REF:-e60b86413207b12f39f2b3782954aedfb8cea26a}
INSTALLER_URL="https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/${VERIFIED_INSTALLER_REF}/izakhono-cloud/install-first-server.sh"

fail() { echo "ERROR: $*" >&2; exit 1; }

[ "$(uname -s)" = "Linux" ] || fail "owner-node bootstrap currently requires Linux"
[ -r /etc/os-release ] || fail "cannot identify Linux distribution"
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || fail "Ubuntu 24.04 LTS is required"
case "${VERSION_ID:-}" in 24.04|24.04.*) ;; *) fail "Ubuntu 24.04 LTS is required" ;; esac

ARCH=$(uname -m)
case "$ARCH" in x86_64|aarch64|arm64) ;; *) fail "unsupported architecture: $ARCH" ;; esac

RAM_KB=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
[ "${RAM_KB:-0}" -ge 3800000 ] || fail "at least 4 GB RAM is required"

FREE_KB=$(df -Pk / | awk 'NR==2 {print $4}')
[ "${FREE_KB:-0}" -ge 20000000 ] || fail "at least 20 GB free disk space is required for the first proof node"

for tool in curl sudo; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing required tool: $tool"
done

echo "IZAKHONO owner-node preflight: PASS"
echo "os=Ubuntu ${VERSION_ID}"
echo "arch=${ARCH}"
echo "ram_kb=${RAM_KB}"
echo "free_root_kb=${FREE_KB}"
echo "installer_ref=${VERIFIED_INSTALLER_REF}"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
curl -fsSL "$INSTALLER_URL" -o "$tmp"
chmod 700 "$tmp"
sudo -E bash "$tmp"

if sudo test -f /var/lib/izakhono-cloud/READY; then
  echo "IZAKHONO owner-hosted node: READY"
  sudo /opt/izakhono-cloud/check-first-server.sh
else
  echo "IZAKHONO owner-hosted node did not produce READY; no production claim is permitted." >&2
  sudo cat /var/lib/izakhono-cloud/status 2>/dev/null || true
  exit 1
fi
