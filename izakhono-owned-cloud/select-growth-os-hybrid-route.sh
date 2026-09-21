#!/usr/bin/env bash
set -euo pipefail

REPORT="${IZAKHONO_HYBRID_REPORT:-/var/lib/izakhono-deploy/proofs/growth-os-hybrid-proof.json}"
[ -f "$REPORT" ] || { echo "Run prove-growth-os-hybrid.sh first." >&2; exit 2; }

node - "$REPORT" <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));

console.log("IZAKHONO HYBRID ROUTE DECISION");
console.log("MODE="+x.decision.mode);
console.log("PUBLIC_READ_PATH="+x.decision.public_read_path);
console.log("WRITE_PATH="+x.decision.write_path);
console.log("OWNED_READY="+String(x.owned.ready).toUpperCase());
console.log("TAILSCALE_READY="+String(x.external_transport.ready).toUpperCase());
console.log("VERCEL_SAFE_FALLBACK="+String(x.external_compute.ready&&x.external_compute.safe_readonly).toUpperCase());
console.log("AUTOMATIC_DNS_MUTATION=NO");
console.log("AUTOMATIC_PAYMENT_REROUTE=NO");

if(!x.owned.ready && x.external_compute.ready && x.external_compute.safe_readonly){
  console.log("ACTION=KEEP_PUBLIC_READ_ACCESS_ON_EXTERNAL_COMPUTE_AND_BLOCK_SENSITIVE_WRITES");
}else if(x.owned.ready && x.external_transport.ready){
  console.log("ACTION=PREFER_OWNED_COMPUTE_WITH_EXTERNAL_TRANSPORT_AVAILABLE");
}else if(x.owned.ready){
  console.log("ACTION=PREFER_OWNED_DIRECT_ROUTE");
}else{
  console.log("ACTION=NO_SAFE_WRITE_ROUTE");
}
NODE
