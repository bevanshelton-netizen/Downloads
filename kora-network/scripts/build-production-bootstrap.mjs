import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const supabaseDir = join(root, 'supabase');
const outputDir = join(root, 'artifacts');
const outputPath = join(outputDir, 'kora-production-bootstrap-schema17.sql');

const sources = [
  '000_fresh_install.sql', '006_broadcast_rewards.sql', '007_trust_rights.sql', '008_creator_economy_family.sql', '009_family_pin_privacy.sql', '010_creator_revenue_reserve_hardening.sql', '011_launch_analytics_ads.sql', '012_ppv_entitlements.sql', '013_production_activation.sql', '014_launch_security_and_recurring.sql', '015_live_event_applications.sql', '016_ticketing_hub.sql', '017_artist_discovery.sql',
];

const parts = [];
parts.push(`-- KORA NETWORK — ONE-SHOT PRODUCTION DATABASE BOOTSTRAP (SCHEMA 17)\n-- GENERATED FILE. DO NOT EDIT BY HAND.\n-- Use ONLY on a brand-new, empty KORA Supabase project.\n-- It installs the base schema through migration 017 in the canonical order.\n-- The first guard refuses to run if public.profiles already exists.\n\nDO $$\nBEGIN\n  IF to_regclass('public.profiles') IS NOT NULL THEN\n    RAISE EXCEPTION 'KORA bootstrap refused: public.profiles already exists. Use incremental migrations instead.';\n  END IF;\nEND\n$$;\n`);
for (const source of sources) {
  const sql = await readFile(join(supabaseDir, source), 'utf8');
  parts.push(`\n-- ============================================================\n-- BEGIN CANONICAL SOURCE: ${source}\n-- ============================================================\n${sql.trim()}\n-- END CANONICAL SOURCE: ${source}\n`);
}
parts.push(`\n-- ============================================================\n-- FINAL SCHEMA ASSERTION\n-- ============================================================\nDO $$\nDECLARE v_schema integer;\nBEGIN\n  SELECT schema_version INTO v_schema FROM public.platform_release_state WHERE singleton = true;\n  IF COALESCE(v_schema, 0) <> 17 THEN\n    RAISE EXCEPTION 'KORA bootstrap incomplete: expected schema version 17, found %', COALESCE(v_schema, 0);\n  END IF;\nEND\n$$;\n\n-- KORA schema 17 bootstrap complete. Public launch remains fail-closed.\n`);
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, parts.join('\n'), 'utf8');
console.log(`Generated ${outputPath}`);
