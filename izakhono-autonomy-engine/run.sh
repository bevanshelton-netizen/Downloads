#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
STATE="${IZAKHONO_AUTONOMY_STATE_DIR:-/var/lib/izakhono-autonomy-engine}"
EXECUTOR="/opt/izakhono-infrastructure-executor/run-once.sh"
AUTHORITY="$ROOT/IZAKHONO-INFRASTRUCTURE-AUTHORITY.json"

mkdir -p "$STATE"
chmod 0700 "$STATE"

bash "$ROOT/izakhono-infrastructure-executor/host-eligibility.sh" >"$STATE/host.txt"
grep -q '^INFRASTRUCTURE_HOST_ELIGIBLE=true$' "$STATE/host.txt"

node - "$AUTHORITY" <<'NODE'
const fs=require("fs");
const a=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const l=a.laptop||{}, c=a.communication_policy||{}, e=a.execution_policy||{};
if(l.role!=="ADMIN_CLIENT_ONLY"||l.runtime_dependency!==false||l.deployment_target!==false||l.scheduler!==false||l.public_ingress!==false||l.payment_processor!==false)process.exit(2);
for(const k of ["platform_to_laptop","customer_traffic_to_laptop","runtime_callback_to_laptop","health_check_dependency_on_laptop","worker_queue_traffic_to_laptop","data_sync_to_laptop"]) if(c[k]!=="DENY")process.exit(3);
if(e.production_scheduler!=="IZAKHONO_INFRASTRUCTURE_EXECUTOR"||e.arbitrary_command_from_control_allowed!==false||e.allowlisted_deployment_targets_only!==true)process.exit(4);
NODE

test -x "$EXECUTOR"
"$EXECUTOR"

node - "$STATE/status.json" <<'NODE'
const fs=require("fs");
fs.writeFileSync(process.argv[2],JSON.stringify({
 schema:"izakhono.autonomy-engine/v1",
 ok:true,
 authority:"IZAKHONO_INFRASTRUCTURE",
 laptopRole:"ADMIN_CLIENT_ONLY",
 laptopRuntimeDependency:false,
 arbitraryCommands:false,
 allowlistedTargetsOnly:true,
 externalResiliencePreserved:true,
 checkedAt:new Date().toISOString()
},null,2)+"\n",{mode:0o600});
NODE
