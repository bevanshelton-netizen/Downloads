#!/usr/bin/env bash
set -euo pipefail
[ "${EUID:-$(id -u)}" -eq 0 ] || exec sudo -E bash "$0" "$@"
NAME="${1:-izakhono-runtime-01}"
OUT=/var/lib/izakhono-cloud/replication
install -d -m 0700 "$OUT"
DISK=$(virsh domblklist "$NAME" --details | awk '$3=="disk"{print $4; exit}')
test -n "$DISK" && test -f "$DISK"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
qemu-img convert -p -O qcow2 "$DISK" "$OUT/$NAME-$STAMP.qcow2"
sha256sum "$OUT/$NAME-$STAMP.qcow2" > "$OUT/$NAME-$STAMP.qcow2.sha256"
chmod 0600 "$OUT/$NAME-$STAMP.qcow2" "$OUT/$NAME-$STAMP.qcow2.sha256"
echo "BACKUP=$OUT/$NAME-$STAMP.qcow2"
