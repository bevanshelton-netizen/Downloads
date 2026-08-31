#!/usr/bin/env bash
set -euo pipefail

fail() { echo "ORACLE A1 PREFLIGHT: FAIL — $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

[ "$(id -u)" -eq 0 ] || fail "run with sudo/root"

ARCH=$(uname -m)
case "$ARCH" in
  aarch64|arm64) pass "Arm64 architecture detected ($ARCH)" ;;
  *) fail "expected Oracle Ampere A1 Arm64 host; detected $ARCH" ;;
esac

if [ -r /etc/os-release ]; then
  . /etc/os-release
  [ "${ID:-}" = "ubuntu" ] || fail "Ubuntu is required; detected ${ID:-unknown}"
  case "${VERSION_ID:-}" in
    24.04|24.04.*) pass "Ubuntu ${VERSION_ID}" ;;
    *) fail "Ubuntu 24.04 is the validated first-host target; detected ${VERSION_ID:-unknown}" ;;
  esac
else
  fail "/etc/os-release is unavailable"
fi

MEM_KB=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
[ -n "$MEM_KB" ] || fail "could not read total memory"
MEM_GB=$(( MEM_KB / 1024 / 1024 ))
[ "$MEM_GB" -ge 10 ] || fail "at least ~10 GiB usable RAM is required for the 12 GB A1 target; detected ${MEM_GB} GiB"
pass "memory ${MEM_GB} GiB"

ROOT_KB=$(df -Pk / | awk 'NR==2 {print $2}')
ROOT_GB=$(( ROOT_KB / 1024 / 1024 ))
[ "$ROOT_GB" -ge 45 ] || fail "root filesystem must be at least 45 GiB; detected ${ROOT_GB} GiB"
pass "root filesystem ${ROOT_GB} GiB"

for tool in curl awk grep sed df ss; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing required tool: $tool"
done
pass "base operating-system tools present"

for port in 80 443; do
  if ss -H -ltn "sport = :$port" 2>/dev/null | grep -q .; then
    fail "TCP port $port is already bound locally"
  fi
done
pass "TCP 80/443 are free locally"

PUBLIC_IP=$(curl -4fsS --max-time 10 https://api.ipify.org || true)
if ! echo "$PUBLIC_IP" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
  fail "public IPv4 could not be detected; ensure the OCI VNIC has a public IPv4 and outbound HTTPS works"
fi
pass "public IPv4 detected: $PUBLIC_IP"

echo
echo "ORACLE A1 PREFLIGHT: PASS"
echo "Host is suitable to attempt the IZAKHONO CLOUD v1.4 production proof."
echo "Provider security-list / NSG rules must still allow inbound TCP 80 and 443."
