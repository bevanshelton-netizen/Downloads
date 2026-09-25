#!/usr/bin/env bash
set -euo pipefail
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
DRILL="$ROOT/drill.json"
RECON="$ROOT/reconcile.json"

cat >"$DRILL" <<'JSON'
{
  "status":"PASS",
  "state":"PRIMARY_ACTIVE_AFTER_RECONCILED_FAILBACK",
  "failback":{
    "status":"PASS",
    "data_reconciled":true,
    "route_switched":true,
    "standby_requires_rebaseline":true
  },
  "next_gate":"REBASELINE_STANDBY_FROM_PRIMARY"
}
JSON

cat >"$RECON" <<'JSON'
{
  "status":"PASS",
  "state":"PRIMARY_ACTIVE_RECONCILED",
  "data_reconciled":true,
  "route_switched":true,
  "standby_requires_rebaseline":true,
  "standby_service_role":"PASSIVE",
  "standby_background_mutators_stopped":true,
  "fencing":{"standby_token":12,"primary_token":13},
  "completed_at":"2026-09-25T00:00:00Z"
}
JSON

OUT="$(IZAKHONO_HA_DRILL_REPORT="$DRILL" IZAKHONO_HA_RECONCILIATION_REPORT="$RECON" bash izakhono-owned-cloud/rebaseline-standby.sh plan)"
OUT="$OUT" node - <<'NODE'
const x=JSON.parse(process.env.OUT);
if(x.product!=="IZAKHONO STANDBY REBASELINE")process.exit(2);
if(x.mode!=="PLAN_ONLY")process.exit(3);
if(x.current_primary_fencing_token!==13)process.exit(4);
if(x.current_standby_role!=="PASSIVE")process.exit(5);
if(x.multi_master_merge!==false)process.exit(6);
if(x.public_route_change!==false||x.dns_change!==false)process.exit(7);
if(x.standby_background_activation!==false)process.exit(8);
if(x.destructive_actions_performed!==false)process.exit(9);
if(!x.sequence.some(v=>/encrypted/i.test(v)))process.exit(10);
if(!x.sequence.some(v=>/PHYSICAL_HA_ACCEPTANCE/i.test(v)))process.exit(11);
console.log("IZAKHONO STANDBY REBASELINE PLAN TEST: PASS");
NODE
