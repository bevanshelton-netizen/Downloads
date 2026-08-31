#!/usr/bin/env bash
set -euo pipefail
STATE=/var/lib/izakhono-cloud/status
LOG=/var/log/izakhono-cloud-bootstrap.log
if [ -f "$STATE" ]; then cat "$STATE"; else echo "status=pending"; fi
if [ -f /var/lib/izakhono-cloud/READY ]; then
  echo "proof=pass"
  exit 0
fi
if [ -f /var/lib/izakhono-cloud/FAILED ]; then
  echo "proof=fail"
  tail -n 80 "$LOG" || true
  exit 1
fi
echo "proof=pending"
exit 2
