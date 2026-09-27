#!/usr/bin/env bash
set -euo pipefail
[ "${EUID:-$(id -u)}" -eq 0 ] || exec sudo -E bash "$0" "$@"
grep -qiE 'vmx|svm' /proc/cpuinfo || { echo "FATAL: CPU virtualization unavailable"; exit 20; }
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y qemu-kvm libvirt-daemon-system libvirt-clients virtinst cloud-image-utils bridge-utils nftables curl jq ca-certificates
systemctl enable --now libvirtd nftables
install -d -m 0750 /var/lib/izakhono-cloud/{images,vms,seed,status,replication}
cat >/etc/sysctl.d/99-izakhono-private-cloud.conf <<'EOF'
net.ipv4.ip_forward=1
kernel.kptr_restrict=2
kernel.dmesg_restrict=1
EOF
sysctl --system
cat >/var/lib/izakhono-cloud/status/node02.json <<'EOF'
{"node":"NODE02","authority":"IZAKHONO_INFRASTRUCTURE","role":"PRIVATE_CLOUD_FAILOVER","laptopDependency":false,"arbitraryRemoteShell":false,"readyForVMProvisioning":true}
EOF
echo NODE02_PRIVATE_CLOUD_BASE=READY
