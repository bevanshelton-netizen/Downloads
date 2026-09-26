#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "INFRASTRUCTURE_HOST_ELIGIBLE=false"; echo "REASON=$1"; exit 20; }

command -v systemctl >/dev/null 2>&1 || fail "SYSTEMD_REQUIRED"
command -v systemd-detect-virt >/dev/null 2>&1 || true

KERNEL="$(uname -r 2>/dev/null || true)"
if printf '%s' "$KERNEL" | grep -Eqi 'microsoft|wsl'; then
  fail "WSL_FORBIDDEN"
fi

if compgen -G '/sys/class/power_supply/BAT*' >/dev/null 2>&1; then
  fail "PORTABLE_BATTERY_DETECTED"
fi

CHASSIS=""
if [ -r /sys/class/dmi/id/chassis_type ]; then
  CHASSIS="$(tr -dc '0-9' </sys/class/dmi/id/chassis_type)"
fi
case "$CHASSIS" in
  8|9|10|14|30|31|32) fail "PORTABLE_CHASSIS_TYPE_$CHASSIS" ;;
esac

echo "INFRASTRUCTURE_HOST_ELIGIBLE=true"
echo "WSL=false"
echo "PORTABLE_BATTERY=false"
echo "CHASSIS_TYPE=${CHASSIS:-UNKNOWN}"
echo "VIRTUALIZATION=$(systemd-detect-virt 2>/dev/null || echo none)"
