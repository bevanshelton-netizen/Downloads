#!/usr/bin/env bash
set -u

echo "=== IZAKHONO OWNER HOST ==="
date -u +"UTC %Y-%m-%dT%H:%M:%SZ"
echo

if [ -f /var/lib/izakhono-deploy/owner-host.json ]; then
  cat /var/lib/izakhono-deploy/owner-host.json
else
  echo "owner-host receipt: missing"
fi

echo
echo "=== SERVICES ==="
bash "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/izakhono-owned-cloud/stack-status.sh" || true

echo
echo "=== PUBLIC TUNNEL ==="
if systemctl is-active --quiet izakhono-owner-tunnel 2>/dev/null; then
  echo "izakhono-owner-tunnel=ACTIVE"
else
  echo "izakhono-owner-tunnel=INACTIVE"
fi

echo
echo "=== GROWTH OS v2 ==="
if [ -f /var/lib/izakhono-deploy/growth-os-v2.json ]; then
  cat /var/lib/izakhono-deploy/growth-os-v2.json
else
  echo "growth-os-v2 receipt: missing"
fi
