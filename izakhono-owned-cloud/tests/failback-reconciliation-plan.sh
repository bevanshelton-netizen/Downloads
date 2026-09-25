#!/usr/bin/env bash
set -euo pipefail

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
REPORT="$ROOT/drill.json"

cat >"$REPORT" <<'JSON'
{
  "product":"IZAKHONO CONTROLLED FAILOVER DRILL",
  "status":"PASS",
  "state":"STANDBY_ACTIVE",
  "route_switched":true,
  "primary_fenced":true,
  "fencing":{"previous":11,"active":12},
  "cluster_id":"test-cluster"
}
JSON

OUT="$(IZAKHONO_HA_DRILL_REPORT="$REPORT" bash izakhono-owned-cloud/reconcile-failback-state.sh plan)"

OUT="$OUT" node - <<'NODE'
const x=JSON.parse(process.env.OUT);
if(x.product!=="IZAKHONO DATA-SAFE FAILBACK RECONCILIATION") process.exit(2);
if(x.mode!=="PLAN_ONLY") process.exit(3);
if(x.standby_fencing_token!==12) process.exit(4);
if(x.multi_master_merge!==false) process.exit(5);
if(x.public_write_freeze_required!==true) process.exit(6);
if(x.automatic_dns_change!==false) process.exit(7);
if(x.automatic_failback!==false) process.exit(8);
if(x.destructive_actions_performed!==false) process.exit(9);
if(!x.sequence.some(v=>/encrypted/i.test(v))) process.exit(10);
if(!x.sequence.some(v=>/SHA-256/i.test(v))) process.exit(11);
console.log("IZAKHONO FAILBACK RECONCILIATION PLAN TEST: PASS");
NODE
