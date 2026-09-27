#!/usr/bin/env bash
set -euo pipefail
[ "${EUID:-$(id -u)}" -eq 0 ] || exec sudo -E bash "$0" "$@"
NAME="${1:-izakhono-runtime-01}"
BASE=/var/lib/izakhono-cloud
IMG="$BASE/images/ubuntu-24.04-server-cloudimg-amd64.img"
DISK="$BASE/vms/$NAME.qcow2"
SEED="$BASE/seed/$NAME-seed.iso"
URL=https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
install -d -m 0750 "$BASE"/{images,vms,seed,status}
[ -f "$IMG" ] || curl -fL "$URL" -o "$IMG"
[ -f "$DISK" ] || { qemu-img create -f qcow2 -F qcow2 -b "$IMG" "$DISK" 60G; qemu-img resize "$DISK" 60G; }
cp /opt/izakhono-source/Downloads/izakhono-vm/cloud-init.yaml "$BASE/seed/user-data"
cat >"$BASE/seed/meta-data" <<EOF
instance-id: $NAME
local-hostname: $NAME
EOF
cloud-localds "$SEED" "$BASE/seed/user-data" "$BASE/seed/meta-data"
if ! virsh dominfo "$NAME" >/dev/null 2>&1; then
 virt-install --name "$NAME" --memory 8192 --vcpus 4 --cpu host --disk "path=$DISK,format=qcow2,bus=virtio" --disk "path=$SEED,device=cdrom" --network network=default,model=virtio --graphics none --import --noautoconsole
fi
virsh autostart "$NAME"
echo "IZAKHONO_RUNTIME_VM=$NAME"
