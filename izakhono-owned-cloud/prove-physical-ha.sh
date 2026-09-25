#!/usr/bin/env bash
set -euo pipefail

PRIMARY="${IZAKHONO_HA_PRIMARY_SSH:-}"
STANDBY="${IZAKHONO_HA_STANDBY_SSH:-}"
WITNESS="${IZAKHONO_HA_WITNESS_SSH:-}"
MAX_AGE_MINUTES="${IZAKHONO_HA_MAX_REPLICA_AGE_MINUTES:-1440}"
REPORT="${IZAKHONO_HA_REPORT:-./IZAKHONO-PHYSICAL-HA-PROOF.json}"

[ -n "$PRIMARY" ] || { echo "IZAKHONO_HA_PRIMARY_SSH is required."; exit 2; }
[ -n "$STANDBY" ] || { echo "IZAKHONO_HA_STANDBY_SSH is required."; exit 3; }
[ -n "$WITNESS" ] || { echo "IZAKHONO_HA_WITNESS_SSH is required."; exit 4; }
[[ "$MAX_AGE_MINUTES" =~ ^[0-9]+$ ]] || { echo "IZAKHONO_HA_MAX_REPLICA_AGE_MINUTES must be an integer."; exit 5; }

for cmd in ssh node sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 6; }
done

remote(){
  local target="$1"; shift
  ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 "$target" "$@"
}

check_remote(){
  local label="$1" target="$2"
  remote "$target" "sudo -n true" >/dev/null 2>&1 || {
    echo "$label does not allow non-interactive sudo over the configured SSH path."
    exit 7
  }
}

check_remote PRIMARY "$PRIMARY"
check_remote STANDBY "$STANDBY"
check_remote WITNESS "$WITNESS"

PRIMARY_MACHINE="$(remote "$PRIMARY" "cat /etc/machine-id")"
STANDBY_MACHINE="$(remote "$STANDBY" "cat /etc/machine-id")"
WITNESS_MACHINE="$(remote "$WITNESS" "cat /etc/machine-id")"

[ -n "$PRIMARY_MACHINE" ] && [ -n "$STANDBY_MACHINE" ] && [ -n "$WITNESS_MACHINE" ] || {
  echo "Could not read machine identity from all three hosts."
  exit 8
}
if [ "$PRIMARY_MACHINE" = "$STANDBY_MACHINE" ] || [ "$PRIMARY_MACHINE" = "$WITNESS_MACHINE" ] || [ "$STANDBY_MACHINE" = "$WITNESS_MACHINE" ]; then
  echo "HA certification refused: primary, standby and witness are not three distinct machine identities."
  exit 9
fi

hash_id(){ printf '%s' "$1" | sha256sum | awk '{print $1}'; }
PRIMARY_HASH="$(hash_id "$PRIMARY_MACHINE")"
STANDBY_HASH="$(hash_id "$STANDBY_MACHINE")"
WITNESS_HASH="$(hash_id "$WITNESS_MACHINE")"
unset PRIMARY_MACHINE STANDBY_MACHINE WITNESS_MACHINE

PRIMARY_FIRST="$(remote "$PRIMARY" "sudo -n cat /var/lib/izakhono-deploy/proofs/first-host-proof.txt")" || {
  echo "Primary first-host proof missing."; exit 10;
}
grep -q '^STATUS=PASS$' <<<"$PRIMARY_FIRST" || {
  echo "Primary first-host proof is not PASS."; exit 11;
}

PRIMARY_WITNESS="$(remote "$PRIMARY" "sudo -n cat /var/lib/izakhono-deploy/proofs/witness-primary-enforce.json")" || {
  echo "Primary witness enforce proof missing."; exit 12;
}
PRIMARY_RUNTIME="$(remote "$PRIMARY" "curl -fsS http://127.0.0.1:8790/health")" || { echo "Primary RUNTIME health failed."; exit 13; }
PRIMARY_EDGE="$(remote "$PRIMARY" "curl -fsS http://127.0.0.1:8795/health")" || { echo "Primary EDGE health failed."; exit 14; }
PRIMARY_FORTRESS="$(remote "$PRIMARY" "curl -fsS http://127.0.0.1:18109/health")" || { echo "Primary FORTRESS health failed."; exit 15; }

STANDBY_PREPARED="$(remote "$STANDBY" "sudo -n cat /var/lib/izakhono-deploy/proofs/warm-standby.json")" || {
  echo "Warm-standby proof missing."; exit 16;
}
STANDBY_RESTORE="$(remote "$STANDBY" "sudo -n cat /var/lib/izakhono-deploy/proofs/standby-restore-staged.json")" || {
  echo "Standby staged-restore proof missing."; exit 17;
}
STANDBY_WITNESS="$(remote "$STANDBY" "sudo -n cat /var/lib/izakhono-deploy/proofs/witness-standby-enforce.json")" || {
  echo "Standby witness enforce proof missing."; exit 18;
}
STANDBY_ROLE="$(remote "$STANDBY" "sudo -n cat /var/lib/izakhono-deploy/proofs/standby-service-role.json")" || {
  echo "Standby passive-role proof missing."; exit 181;
}
STANDBY_RUNTIME="$(remote "$STANDBY" "curl -fsS http://127.0.0.1:8790/health")" || { echo "Standby RUNTIME health failed."; exit 19; }
STANDBY_EDGE="$(remote "$STANDBY" "curl -fsS http://127.0.0.1:8795/health")" || { echo "Standby EDGE health failed."; exit 20; }

STANDBY_MUTATORS="$(remote "$STANDBY" "for s in izakhono-ci-worker-node izakhono-notify-node izakhono-backup-node izakhono-model-worker-node izakhono-gpu-compute-node izakhono-mail-relay-adapter; do if systemctl is-active --quiet \$s 2>/dev/null; then echo \$s; fi; done")"
[ -z "$STANDBY_MUTATORS" ] || {
  echo "Standby passive-role refused: autonomous mutators are active: $STANDBY_MUTATORS"
  exit 201
}

WITNESS_HEALTH="$(remote "$WITNESS" "sudo -n sh -c 'source /etc/izakhono/witness-node.env; curl -fsS http://${HOST:-127.0.0.1}:${PORT:-8930}/health'")" || {
  echo "Witness health failed."; exit 21;
}
WITNESS_COLOCATION="$(remote "$WITNESS" "for s in izakhono-data-node izakhono-runtime-node izakhono-edge-node; do if systemctl is-active --quiet $s 2>/dev/null; then echo $s; fi; done")"
[ -z "$WITNESS_COLOCATION" ] || {
  echo "Witness independence refused: application services are active on witness host: $WITNESS_COLOCATION"
  exit 22
}

PRIMARY_CLUSTER="$(remote "$PRIMARY" "sudo -n awk -F= '$1=="IZAKHONO_WITNESS_CLUSTER_ID"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/witness-member/member.env")"
STANDBY_CLUSTER="$(remote "$STANDBY" "sudo -n awk -F= '$1=="IZAKHONO_WITNESS_CLUSTER_ID"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/witness-member/member.env")"
PRIMARY_WITNESS_URL="$(remote "$PRIMARY" "sudo -n awk -F= '$1=="IZAKHONO_WITNESS_URL"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/witness-member/member.env")"
STANDBY_WITNESS_URL="$(remote "$STANDBY" "sudo -n awk -F= '$1=="IZAKHONO_WITNESS_URL"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/witness-member/member.env")"

[ -n "$PRIMARY_CLUSTER" ] && [ "$PRIMARY_CLUSTER" = "$STANDBY_CLUSTER" ] || {
  echo "Primary and standby are not enrolled in the same witness cluster."
  exit 23
}
[ -n "$PRIMARY_WITNESS_URL" ] && [ "$PRIMARY_WITNESS_URL" = "$STANDBY_WITNESS_URL" ] || {
  echo "Primary and standby do not reference the same witness URL."
  exit 24
}

PRIMARY_FIRST="$PRIMARY_FIRST" PRIMARY_WITNESS="$PRIMARY_WITNESS" PRIMARY_RUNTIME="$PRIMARY_RUNTIME" PRIMARY_EDGE="$PRIMARY_EDGE" PRIMARY_FORTRESS="$PRIMARY_FORTRESS" STANDBY_PREPARED="$STANDBY_PREPARED" STANDBY_RESTORE="$STANDBY_RESTORE" STANDBY_WITNESS="$STANDBY_WITNESS" STANDBY_ROLE="$STANDBY_ROLE" STANDBY_MUTATORS="$STANDBY_MUTATORS" STANDBY_RUNTIME="$STANDBY_RUNTIME" STANDBY_EDGE="$STANDBY_EDGE" WITNESS_HEALTH="$WITNESS_HEALTH" PRIMARY_HASH="$PRIMARY_HASH" STANDBY_HASH="$STANDBY_HASH" WITNESS_HASH="$WITNESS_HASH" CLUSTER_ID="$PRIMARY_CLUSTER" WITNESS_URL="$PRIMARY_WITNESS_URL" MAX_AGE_MINUTES="$MAX_AGE_MINUTES" REPORT="$REPORT" node - <<'NODE'
const fs=require("fs");

function parse(name){
  try{return JSON.parse(process.env[name]);}
  catch(error){console.error("Invalid JSON from "+name);process.exit(31);}
}
function fail(message,code){
  console.error(message);
  process.exit(code);
}

const primaryWitness=parse("PRIMARY_WITNESS");
const primaryRuntime=parse("PRIMARY_RUNTIME");
const primaryEdge=parse("PRIMARY_EDGE");
const primaryFortress=parse("PRIMARY_FORTRESS");
const standbyPrepared=parse("STANDBY_PREPARED");
const standbyRestore=parse("STANDBY_RESTORE");
const standbyWitness=parse("STANDBY_WITNESS");
const standbyRole=parse("STANDBY_ROLE");
const standbyRuntime=parse("STANDBY_RUNTIME");
const standbyEdge=parse("STANDBY_EDGE");
const witnessHealth=parse("WITNESS_HEALTH");

if(primaryWitness.mode!=="enforce" || primaryWitness.role!=="primary" || primaryWitness.write_fencing_enabled!==true) fail("Primary witness enforcement proof invalid.",32);
if(primaryWitness.runtime?.lease_valid!==true || primaryWitness.edge?.lease_valid!==true) fail("Primary does not hold valid witness leadership in both RUNTIME and EDGE.",33);
if(!primaryWitness.runtime?.fencing_token || primaryWitness.runtime.fencing_token!==primaryWitness.edge?.fencing_token) fail("Primary RUNTIME/EDGE fencing tokens do not match.",34);
if(primaryRuntime.witness?.mode!=="enforce" || primaryRuntime.witness?.leaseValid!==true || primaryRuntime.witness?.receiptVerified!==true) fail("Primary RUNTIME live witness state invalid.",35);
if(primaryEdge.witness?.mode!=="enforce" || primaryEdge.witness?.leaseValid!==true || primaryEdge.witness?.receiptVerified!==true) fail("Primary EDGE live witness state invalid.",36);
if(Number(primaryRuntime.witness?.fencingToken)!==Number(primaryEdge.witness?.fencingToken)) fail("Primary live fencing-token mismatch.",37);
if(primaryFortress.status!=="healthy" || primaryFortress.product!=="FORTRESS") fail("FORTRESS is not healthy on primary.",38);

if(standbyPrepared.status!=="PREPARED" || standbyPrepared.public_route_changed!==false || standbyPrepared.dns_changed!==false || standbyPrepared.writes_fail_closed_without_lease!==true) fail("Warm-standby preparation proof invalid.",39);
if(standbyRestore.status!=="STAGED_AND_VERIFIED" || standbyRestore.live_directories_modified!==false || standbyRestore.promotion_performed!==false) fail("Standby restore staging safety proof invalid.",40);
const age=Number(standbyRestore.replica?.age_minutes);
if(!Number.isFinite(age) || age<0 || age>Number(process.env.MAX_AGE_MINUTES)) fail("Standby recovery point exceeds accepted RPO age.",41);
if(standbyWitness.mode!=="enforce" || standbyWitness.role!=="standby" || standbyWitness.write_fencing_enabled!==true || standbyWitness.standby_fail_closed_probe!==true) fail("Standby witness enforcement proof invalid.",42);
if(standbyRuntime.witness?.mode!=="enforce" || standbyEdge.witness?.mode!=="enforce") fail("Standby RUNTIME/EDGE are not in witness enforce mode.",43);
if(standbyRuntime.witness?.leaseValid===true || standbyEdge.witness?.leaseValid===true) fail("Standby unexpectedly holds leadership while primary is certified active.",44);
if(standbyRole.status!=="PASS" || standbyRole.role!=="PASSIVE" || standbyRole.mutators_stopped!==true || standbyRole.automatic_activation!==false) fail("Standby autonomous mutators are not proven passive.",441);
if(String(process.env.STANDBY_MUTATORS||"").trim()!=="") fail("Standby autonomous mutators are live despite PASSIVE receipt.",442);

if(witnessHealth.product!=="IZAKHONO WITNESS NODE" || witnessHealth.status!=="healthy") fail("Witness health contract invalid.",45);
if(witnessHealth.independentFailureDomainRequired!==true || witnessHealth.leaseReceipts!=="Ed25519") fail("Witness arbitration safety flags invalid.",46);
if(witnessHealth.automaticFailover!==false) fail("Automatic witness failover must remain disabled during physical acceptance.",47);

const report={
  product:"IZAKHONO PHYSICAL HA ACCEPTANCE",
  status:"PASS",
  certification:"READY_FOR_CONTROLLED_FAILOVER_DRILL",
  destructive_cutover_performed:false,
  automatic_dns_failover_enabled:false,
  failure_domains:{
    primary_machine_sha256:process.env.PRIMARY_HASH,
    standby_machine_sha256:process.env.STANDBY_HASH,
    witness_machine_sha256:process.env.WITNESS_HASH,
    distinct:true
  },
  witness:{
    cluster_id:process.env.CLUSTER_ID,
    url:process.env.WITNESS_URL,
    signed_receipts:"Ed25519",
    primary_fencing_token:Number(primaryRuntime.witness.fencingToken),
    primary_leadership_valid:true,
    standby_leadership_valid:false
  },
  primary:{
    first_host_proof:"PASS",
    runtime:"healthy",
    edge:"healthy",
    fortress:"healthy",
    witness_mode:"enforce"
  },
  standby:{
    state:"PREPARED",
    witness_mode:"enforce",
    writes_fail_closed_without_lease:true,
    replica_restore:"STAGED_AND_VERIFIED",
    replica_age_minutes:age,
    max_rpo_age_minutes:Number(process.env.MAX_AGE_MINUTES),
    live_directories_modified:false,
    service_role:"PASSIVE",
    background_mutators_stopped:true
  },
  next_gate:"CONTROLLED_PHYSICAL_FAILOVER_DRILL",
  proved_at:new Date().toISOString()
};

fs.writeFileSync(process.env.REPORT,JSON.stringify(report,null,2)+"\n",{mode:0o600});
process.stdout.write(JSON.stringify(report,null,2)+"\n");
NODE

chmod 0600 "$REPORT"
echo
echo "IZAKHONO PHYSICAL HA ACCEPTANCE: PASS"
echo "No destructive cutover was performed."
echo "Report: $REPORT"
