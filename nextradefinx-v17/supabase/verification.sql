-- NexTradeFinX V17 verification queries.
-- Run in Supabase SQL editor after migrations. These are read-only checks.

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'learner_passports',
    'learning_events',
    'readiness_snapshots',
    'beta_invites',
    'consent_receipts',
    'deletion_requests'
  )
order by tablename;

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'learner_passports',
    'learning_events',
    'readiness_snapshots',
    'beta_invites',
    'consent_receipts',
    'deletion_requests'
  )
order by tablename, policyname;

-- Expected principle:
-- normal authenticated users can only see/write their own learner records;
-- append-only evidence tables do not permit client-side UPDATE/DELETE;
-- server/admin actions are not exposed through public keys.
