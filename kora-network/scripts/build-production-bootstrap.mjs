import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const supabaseDir = join(root, 'supabase');
const outputDir = join(root, 'artifacts');
const outputPath = join(outputDir, 'kora-production-bootstrap-schema22.sql');

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

const parts = [];
parts.push(`-- KORA NETWORK — ONE-SHOT PRODUCTION DATABASE BOOTSTRAP (SCHEMA 22)
-- GENERATED FILE. DO NOT EDIT BY HAND.
-- Use ONLY on a brand-new, empty dedicated KORA Supabase project.
-- The first guard refuses to run if public.profiles already exists.

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'KORA bootstrap refused: public.profiles already exists. Use incremental migrations instead.';
  END IF;
END
$$;
`);

for (const source of sources) {
  const sql = await readFile(join(supabaseDir, source), 'utf8');
  parts.push(`
-- ============================================================
-- BEGIN CANONICAL SOURCE: ${source}
-- ============================================================
${sql.trim()}
-- END CANONICAL SOURCE: ${source}
`);
}

parts.push(`
DO $$
DECLARE v_schema integer;
BEGIN
  SELECT schema_version INTO v_schema FROM public.platform_release_state WHERE singleton=true;
  IF COALESCE(v_schema,0) <> 22 THEN
    RAISE EXCEPTION 'KORA bootstrap incomplete: expected schema version 22, found %', COALESCE(v_schema,0);
  END IF;
END
$$;
`);

await mkdir(outputDir,{recursive:true});
await writeFile(outputPath,parts.join('\n'),'utf8');
console.log(`Generated ${outputPath}`);
