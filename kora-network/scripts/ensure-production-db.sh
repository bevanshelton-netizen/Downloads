#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then echo "SUPABASE_DB_URL is required." >&2; exit 1; fi
if ! command -v psql >/dev/null 2>&1; then echo "psql is required." >&2; exit 1; fi
if ! command -v node >/dev/null 2>&1; then echo "node is required to verify the pinned KORA production project." >&2; exit 1; fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
EXPECTED_SUPABASE_REF="$(node -e "const p=require('./production-instance.json'); process.stdout.write(String(p.supabaseProjectRef||''))")"
if [[ -z "$EXPECTED_SUPABASE_REF" ]]; then echo "production-instance.json does not contain a Supabase project reference." >&2; exit 1; fi
if [[ "$SUPABASE_DB_URL" != *"$EXPECTED_SUPABASE_REF"* ]]; then echo "Refusing activation: SUPABASE_DB_URL does not identify the pinned KORA production project." >&2; exit 1; fi
echo "Confirmed database URL identifies pinned KORA project $EXPECTED_SUPABASE_REF."
profiles_exists="$(psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select to_regclass('public.profiles') is not null;")"
if [[ "$profiles_exists" != "t" ]]; then KORA_DB_BOOTSTRAP_CONFIRM="BOOTSTRAP FRESH KORA DATABASE" bash scripts/bootstrap-production-db.sh; fi
version="$(psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select schema_version from public.platform_release_state where singleton=true;")"
if [[ "$version" == "14" ]]; then psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/015_live_event_applications.sql; version=15; fi
if [[ "$version" == "15" ]]; then psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/016_ticketing_hub.sql; version=16; fi
if [[ "$version" == "16" ]]; then echo "Applying incremental schema 17 KORA artist discovery migration."; psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/017_artist_discovery.sql; version="$(psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select schema_version from public.platform_release_state where singleton=true;")"; fi
if [[ "$version" != "17" ]]; then echo "KORA production database is not at schema version 17: ${version:-missing}." >&2; exit 1; fi
public_launch="$(psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select public_launch_enabled::text from public.platform_release_state where singleton=true;")"
if [[ "$public_launch" != "false" && "$public_launch" != "f" ]]; then echo "Refusing private-beta activation because the database public-launch switch is already enabled." >&2; exit 1; fi
channel_count="$(psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select count(*) from public.live_channels where is_active=true;")"
if ! [[ "$channel_count" =~ ^[0-9]+$ ]] || (( channel_count < 1 )); then echo "KORA production database has no active seeded channel." >&2; exit 1; fi
release_name="$(psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select release_name from public.platform_release_state where singleton=true;")"
echo "KORA database verified: schema=17, release=${release_name:-unknown}, active_channels=$channel_count, public_launch=false."
