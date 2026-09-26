#!/usr/bin/env bash
set -euo pipefail

MIRROR_ROOT="/var/lib/izakhono-source-mirrors"
REPO="$MIRROR_ROOT/izakhono-builder"
REMOTE="https://github.com/bevanshelton-netizen/izakhono-builder.git"
REQUIRED="3d115c5ae5c092beb7011622fdda1534f885e68a"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/izakhono-crm-v020.json"
EVIDENCE="/opt/izakhono/evidence/IZAKHONO-CRM-V020-INFRASTRUCTURE-REPORT.json"

for c in git docker curl jq node; do command -v "$c" >/dev/null 2>&1 || { echo "$c required"; exit 2; }; done
mkdir -p "$MIRROR_ROOT" "$REPORT_DIR"
chmod 0700 "$MIRROR_ROOT" "$REPORT_DIR"

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none "$REMOTE" "$REPO"
fi
[ -z "$(git -C "$REPO" status --porcelain)" ] || { echo "IZAKHONO Builder mirror has local changes"; exit 3; }
git -C "$REPO" fetch --quiet origin main
git -C "$REPO" checkout -q main
git -C "$REPO" reset --hard -q origin/main
git -C "$REPO" merge-base --is-ancestor "$REQUIRED" HEAD || { echo "Required CRM source commit is not present"; exit 4; }

node - "$REPO/products/izakhono-crm/package.json" "$REPO/products/izakhono-crm/.izakhono.json" <<'NODE'
const fs=require('fs');
const [pkgPath,manifestPath]=process.argv.slice(2);
const p=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(p.version!=='0.2.0'||m.application_version!=='0.2.0') process.exit(2);
NODE

bash "$REPO/infra/app-fabric-runtime/activate-node01.sh" "$EVIDENCE"

docker exec izakhono-crm node - <<'NODE'
const base='http://127.0.0.1:8080';
const h=await fetch(base+'/health').then(r=>r.json());
if(h.ok!==true||h.service!=='izakhono-crm'||h.version!=='0.2.0') process.exit(2);
if(h.auth==='local-dev') process.exit(3);
const r=await fetch(base+'/api/summary',{headers:{'x-entity-id':'izakhono-africa','x-platform-id':'faisready'}});
if(r.status!==401) process.exit(4);
NODE

bash -lc 'set -a; source /opt/izakhono/secrets/app-fabric-runtime.env; set +a; docker exec izakhono-app-fabric-gateway node -e "fetch(\"http://127.0.0.1:8090/api/fabric/selftest\",{method:\"POST\",headers:{authorization:\"Bearer \"+process.env.IZAKHONO_FABRIC_INTERNAL_TOKEN}}).then(async r=>{const v=await r.json();if(!r.ok||v.ok!==true||v.mode!==\"non-writing\"||v.crm?.dry_run!==true)process.exit(1)}).catch(()=>process.exit(1))"'

jq -e '.overall=="PASS_INTERNAL_OWNED" and .crm.health=="healthy" and .fabric.health=="healthy" and .public_cutover_performed==false' "$EVIDENCE" >/dev/null
REVISION="$(git -C "$REPO" rev-parse HEAD)"

node - "$REPORT" "$REVISION" "$EVIDENCE" <<'NODE'
const fs=require('fs');
const [path,revision,evidencePath]=process.argv.slice(2);
const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
fs.writeFileSync(path,JSON.stringify({
  schema:'izakhono.crm-infrastructure-deployment/v1',
  product:'IZAKHONO CRM',version:'0.2.0',revision,
  source_authority:'CONTROLLED_EXTERNAL_SOURCE_MIRROR',
  runtime_authority:'IZAKHONO_INFRASTRUCTURE',
  overall:evidence.overall,
  crm_health:evidence.crm?.health,
  fabric_health:evidence.fabric?.health,
  public_cutover_performed:false,
  laptop_target:false,
  platform_to_laptop_traffic:'DENY',
  public_live_claim:false,
  deployed_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE
chmod 0600 "$REPORT"

echo "IZAKHONO_CRM_V020_INFRASTRUCTURE=VERIFIED"
echo "PUBLIC_LIVE_CLAIM=false"
