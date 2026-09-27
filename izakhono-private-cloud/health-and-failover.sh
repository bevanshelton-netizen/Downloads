#!/usr/bin/env bash
set -euo pipefail
POLICY=/opt/izakhono-source/Downloads/izakhono-private-cloud/cluster-policy.json
test -f "$POLICY"
jq -e '.authority=="IZAKHONO_INFRASTRUCTURE" and .laptop.productionEligible==false and .control.arbitraryRemoteShell==false and .control.allowlistedWorkloadsOnly==true and .failover.paymentFailClosed==true and .failover.fortressRequired==true' "$POLICY" >/dev/null
systemctl is-active --quiet libvirtd
COUNT=$(virsh list --state-running --name | sed '/^$/d' | wc -l)
jq -n --arg node "$(hostname)" --argjson running "$COUNT" '{ok:true,node:$node,runtime:"izakhono-owned-private-cloud",runningVMs:$running,laptopDependency:false,arbitraryRemoteShell:false}'
