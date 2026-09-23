import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),failures=[];let passed=0;
function read(relative){return fs.readFileSync(path.join(root,relative),'utf8');}
function check(name,condition){if(condition){passed++;console.log('PASS  '+name);}else{failures.push(name);console.error('FAIL  '+name);}}

const migration=read('supabase/023_partner_gateway.sql');
const pilotMigration=read('supabase/024_partner_pilot.sql');
const lib=read('lib/partner-gateway.ts');
const handoff=read('app/go/[partner]/[asset]/route.ts');
const catalogue=read('app/api/partners/catalogue/route.ts');
const conversions=read('app/api/partners/conversions/route.ts');
const dashboard=read('app/partner/page.tsx');
const pilotDashboard=read('app/partner/pilot/page.tsx');
const pilotPublic=read('app/partners/pilot/page.tsx');
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
check('Security-definer membership helper lives outside exposed public schema',migration.includes('create schema if not exists kora_private')&&migration.includes('function kora_private.is_partner_member')&&migration.includes("security definer set search_path=''"));
check('Partner audit trigger helper lives in private schema',migration.includes('function kora_private.kora_partner_audit_trigger')&&migration.includes('revoke all on function kora_private.kora_partner_audit_trigger() from public'));
check('Rights resolver pins an empty search path',migration.includes("function public.partner_asset_access")&&migration.includes("language plpgsql stable security definer set search_path='' as $kora$"));
check('Partner RLS policies declare caller roles',migration.includes('to anon,authenticated')&&migration.includes('to authenticated'));
check('Partner audit identity sequence is explicitly service-role accessible',migration.includes('grant usage,select on sequence public.partner_audit_log_id_seq to service_role'));
check('Partner gateway avoids storing IP addresses',!migration.includes('ip_address')&&!migration.includes('user_agent'));
check('Dedicated production bootstrap includes schema 024',productionBootstrap.includes('"023_partner_gateway.sql"')&&productionBootstrap.includes('"024_partner_pilot.sql"')&&productionBootstrap.includes('schema24'));
check('Shared Supabase bootstrap includes schema 024',sharedBootstrap.includes('"023_partner_gateway.sql"')&&sharedBootstrap.includes('"024_partner_pilot.sql"')&&sharedBootstrap.includes('schema24'));
check('Fresh production DB bootstrap includes migration 024',freshDb.includes('supabase/023_partner_gateway.sql')&&freshDb.includes('supabase/024_partner_pilot.sql')&&freshDb.includes('"24"'));
check('Production DB activation advances through migration 024',ensureDb.includes('supabase/023_partner_gateway.sql')&&ensureDb.includes('supabase/024_partner_pilot.sql')&&ensureDb.includes('schema=24'));
check('Pilot records are partner-scoped under RLS',pilotMigration.includes('partners read own pilots')&&pilotMigration.includes('kora_private.is_partner_member(partner_id)'));
check('Pilot attribution extends referrals and conversions without replacing gateway evidence',pilotMigration.includes('alter table public.partner_referrals')&&pilotMigration.includes('alter table public.partner_conversions')&&pilotMigration.includes('pilot_id'));
check('Pilot dashboard counts only verified conversions as commercial evidence',pilotDashboard.includes("status === 'verified'")&&pilotDashboard.includes('verified attributable revenue'));
check('Public pilot page does not misrepresent prospects as signed partners',pilotPublic.includes('prospective partnership framework only')&&pilotPublic.includes('does not represent CANAL+, MultiChoice, DStv'));

console.log('\nKORA Partner Gateway guard: '+passed+' passed, '+failures.length+' failed.');
if(failures.length){failures.forEach(x=>console.error('- '+x));process.exit(1);}
