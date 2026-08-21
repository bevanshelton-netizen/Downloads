#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is required." >&2
  exit 1
fi

if [[ "${KORA_DB_BOOTSTRAP_CONFIRM:-}" != "BOOTSTRAP FRESH KORA DATABASE" ]]; then
  echo "Refusing to modify a database without KORA_DB_BOOTSTRAP_CONFIRM='BOOTSTRAP FRESH KORA DATABASE'." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "node is required to verify the pinned KORA production project." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXPECTED_SUPABASE_REF="$(node -e "const p=require('./production-instance.json'); process.stdout.write(String(p.supabaseProjectRef||''))")"
if [[ -z "$EXPECTED_SUPABASE_REF" ]]; then
  echo "production-instance.json does not contain a Supabase project reference." >&2
  exit 1
fi
if [[ "$SUPABASE_DB_URL" != *"$EXPECTED_SUPABASE_REF"* ]]; then
  echo "Refusing bootstrap: SUPABASE_DB_URL does not identify the pinned KORA production project." >&2
  exit 1
fi

echo "Confirmed target database URL identifies the pinned KORA production project."

files=(
  "supabase/000_fresh_install.sql"
  "supabase/006_broadcast_rewards.sql"
  "supabase/007_trust_rights.sql"
  "supabase/008_creator_economy_family.sql"
  "supabase/009_family_pin_privacy.sql"
  "supabase/010_creator_revenue_reserve_hardening.sql"
  "supabase/011_launch_analytics_ads.sql"
  "supabase/012_ppv_entitlements.sql"
  "supabase/013_production_activation.sql"
  "supabase/014_launch_security_and_recurring.sql"
  "supabase/015_live_event_applications.sql"
)

for file in "${files[@]}"; do
  [[ -f "$file" ]] || { echo "Missing migration: $file" >&2; exit 1; }
done

echo "Checking that target database does not already contain KORA public.profiles..."
exists="$(psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select to_regclass('public.profiles') is not null;")"
if [[ "$exists" == "t" ]]; then
  echo "Refusing fresh bootstrap: public.profiles already exists. Use the documented incremental/manual review process instead." >&2
  exit 1
fi

for file in "${files[@]}"; do
  echo "Applying $file"
  psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f "$file"
done

echo "Verifying KORA schema version..."
version="$(psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select schema_version from public.platform_release_state where singleton=true;")"
if [[ "$version" != "15" ]]; then
  echo "Unexpected schema version: ${version:-missing}" >&2
  exit 1
fi

echo "KORA fresh production database bootstrap completed at schema version 15."
