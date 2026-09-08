import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const supabaseDir = join(root, 'supabase');
const outputDir = join(root, 'artifacts');
const outputPath = join(outputDir, 'kora-shared-supabase-bootstrap-schema22.sql');
const sources = [
  "000_fresh_install.sql",
  "006_broadcast_rewards.sql",
  "007_trust_rights.sql",
  "008_creator_economy_family.sql",
  "009_family_pin_privacy.sql",
  "010_creator_revenue_reserve_hardening.sql",
  "011_launch_analytics_ads.sql",
  "012_ppv_entitlements.sql",
  "013_production_activation.sql",
  "014_launch_security_and_recurring.sql",
  "015_live_event_applications.sql",
  "016_ticketing_hub.sql",
  "017_ticket_payment_hardening.sql",
  "018_artist_discovery.sql",
  "019_ticket_settlements.sql",
  "020_allegro_video_handoff.sql",
  "021_tour2screen.sql",
  "022_music_screen_release_gate.sql"
];

function isolate(sql) {
  return sql
    .replaceAll('public.', 'kora.')
    .replaceAll('on_auth_user_created', 'kora_on_auth_user_created')
    .replaceAll('zz_on_auth_legal_acceptance', 'kora_zz_on_auth_legal_acceptance');
}

const parts = [];
parts.push(`-- KORA NETWORK — SHARED SUPABASE BOOTSTRAP (SCHEMA 22)
-- Creates KORA objects only inside schema "kora".
-- Supabase Auth is intentionally shared as the IZAKHONO identity backbone.
-- The Data API is NOT exposed here; exposure happens only after RLS/security verification.

create schema if not exists kora;

DO $$
BEGIN
  IF to_regclass('kora.profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'KORA shared bootstrap refused: kora.profiles already exists.';
  END IF;
END
$$;
`);

for (const source of sources) {
  const sql = isolate(await readFile(join(supabaseDir, source), 'utf8'));
  parts.push(`
-- ============================================================
-- BEGIN ISOLATED SOURCE: ${source}
-- ============================================================
${sql.trim()}
-- END ISOLATED SOURCE: ${source}
`);
}

parts.push(`
DO $$
DECLARE v_schema integer;
BEGIN
  SELECT schema_version INTO v_schema FROM kora.platform_release_state WHERE singleton=true;
  IF COALESCE(v_schema,0) <> 22 THEN
    RAISE EXCEPTION 'KORA shared bootstrap incomplete: expected schema version 22, found %', COALESCE(v_schema,0);
  END IF;
END
$$;

-- Service role access only until post-install verification deliberately exposes kora.
grant usage on schema kora to service_role;
grant all on all tables in schema kora to service_role;
grant all on all routines in schema kora to service_role;
grant all on all sequences in schema kora to service_role;
`);

await mkdir(outputDir,{recursive:true});
await writeFile(outputPath,parts.join('\n'),'utf8');
console.log(`Generated ${outputPath}`);
