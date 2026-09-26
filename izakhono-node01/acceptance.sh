#!/usr/bin/env bash
set -euo pipefail

HEALTH="$(curl -fsS --max-time 10 http://127.0.0.1:8940/health)"
node -e '
const x=JSON.parse(process.argv[1]);
if(x.ok!==true)process.exit(2);
if(x.service!=="izakhono-node01"||x.product!=="IZAKHONO NODE01")process.exit(3);
if(x.authority!=="IZAKHONO"||x.execution_class!=="IZAKHONO_SOVEREIGN_NODE")process.exit(4);
if(x.external_runtime_dependency!==false||x.external_provider_authority!==false)process.exit(5);
if(x.privacy?.behavioural_tracking!==false||x.privacy?.profiling!==false||x.privacy?.silent_analytics!==false)process.exit(6);
if(x.public_live_claim!==false||x.independent_public_https_verification_required!==true)process.exit(7);
' "$HEALTH"

echo "IZAKHONO NODE01 ACCEPTANCE: PASS"
echo "AUTHORITY=IZAKHONO"
echo "EXECUTION_CLASS=IZAKHONO_SOVEREIGN_NODE"
echo "EXTERNAL_RUNTIME_DEPENDENCY=false"
echo "PUBLIC_LIVE_CLAIM=false"
