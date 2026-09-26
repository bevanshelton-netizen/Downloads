#!/usr/bin/env bash
set -euo pipefail

ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
MODEL="${IZAKHONO_ONE_BOOTSTRAP_MODEL:-qwen2.5:3b}"

[ -d "$ROOT/.git" ] || { echo "Canonical IZAKHONO source missing"; exit 2; }
cd "$ROOT"

bash izakhono-infrastructure-executor/host-eligibility.sh
IZAKHONO_LOCAL_MODEL="$MODEL" bash izakhono-owned-cloud/activate-local-model-engine.sh "$MODEL"

REPORT=/var/lib/izakhono-deploy/izakhono-one-local-model.json
test -s "$REPORT"
node - "$REPORT" <<'NODE'
const fs=require('fs');
const x=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(x.schema!=='izakhono.one-local-model/v1') process.exit(2);
if(x.product!=='IZAKHONO ONE AI'||x.chat_ready!==true) process.exit(3);
if(x.per_request_external_ai_required!==false) process.exit(4);
console.log('IZAKHONO_ONE_LOCAL_MODEL=VERIFIED');
console.log('PUBLIC_HTTPS='+String(x.public_https||'NOT_VERIFIED'));
NODE

echo "LAPTOP_TARGET=false"
echo "PUBLIC_LIVE_CLAIM=false"
