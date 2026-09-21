import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),failures=[];let passed=0;
function read(relative){return fs.readFileSync(path.join(root,relative),'utf8');}
function check(name,condition){if(condition){passed++;console.log('PASS  '+name);}else{failures.push(name);console.error('FAIL  '+name);}}

const migration=read('supabase/023_partner_gateway.sql');
const lib=read('lib/partner-gateway.ts');
const handoff=read('app/go/[partner]/[asset]/route.ts');
const catalogue=read('app/api/partners/catalogue/route.ts');
const conversions=read('app/api/partners/conversions/route.ts');
const dashboard=read('app/partner/page.tsx');
const productionBootstrap=read('scripts/build-production-bootstrap.mjs');
const sharedBootstrap=read('scripts/build-shared-supabase-bootstrap.mjs');
const freshDb=read('scripts/bootstrap-production-db.sh');
const ensureDb=read('scripts/ensure-production-db.sh');

check('Direct playback requires a verified rights grant',migration.includes("v_required:=case when v_asset.access_mode='authenticated' then 'authenticated' else 'stream' end")&&migration.includes("r.status='verified'"));
check('Unverified direct/authenticated access is blocked',migration.includes("return query select 'blocked','verified_rights_grant_required'"));
check('Catalogue destinations reject direct media manifests',migration.includes('m3u8|mpd')&&catalogue.includes('isDirectMediaUrl'));
check('Catalogue ingestion cannot assign playback rights',catalogue.includes("access_mode: 'handoff'")&&!catalogue.includes('partner_rights_grants'));
check('Partner webhook credentials are stored as hashes',migration.includes('key_hash text not null unique')&&lib.includes("createHash('sha256')"));
check('Conversion webhook requires partner key header',conversions.includes("x-kora-partner-key"));
check('Reported conversions are not automatically verified revenue',conversions.includes("status: 'reported'"));
check('External handoff is gated by the rights decision RPC',handoff.includes('getPartnerAccess')&&handoff.includes("decision.action !== 'handoff'"));
check('External handoff logs attribution before redirect',handoff.indexOf("from('partner_referrals')")>=0&&handoff.lastIndexOf('NextResponse.redirect(destination')>handoff.indexOf("from('partner_referrals')"));
check('Partner dashboard separates verified from reported conversions',dashboard.includes("status === 'verified'")&&dashboard.includes('Verified attributable revenue'));
check('No public client can read partner webhook keys',migration.includes('revoke all on public.partner_webhook_keys from anon,authenticated'));
check('Rights resolver is server-only',migration.includes('revoke all on function public.partner_asset_access(uuid,text) from public,anon,authenticated')&&migration.includes('grant execute on function public.partner_asset_access(uuid,text) to service_role'));
check('Partner gateway avoids storing IP addresses',!migration.includes('ip_address')&&!migration.includes('user_agent'));
check('Dedicated production bootstrap includes schema 023',productionBootstrap.includes('"023_partner_gateway.sql"')&&productionBootstrap.includes('schema23'));
check('Shared Supabase bootstrap includes schema 023',sharedBootstrap.includes('"023_partner_gateway.sql"')&&sharedBootstrap.includes('schema23'));
check('Fresh production DB bootstrap includes migration 023',freshDb.includes('supabase/023_partner_gateway.sql')&&freshDb.includes('"23"'));
check('Production DB activation advances through migration 023',ensureDb.includes('supabase/023_partner_gateway.sql')&&ensureDb.includes('schema=23'));

console.log('\nKORA Partner Gateway guard: '+passed+' passed, '+failures.length+' failed.');
if(failures.length){failures.forEach(x=>console.error('- '+x));process.exit(1);}
