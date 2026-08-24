-- Read-only verification after V22 bootstrap.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('learner_passports','learning_events','beta_invites','consent_receipts','account_deletion_requests')
order by tablename;

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('learner_passports','learning_events','beta_invites','consent_receipts','account_deletion_requests')
order by tablename, policyname;

select indexname, indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('learning_events','consent_receipts','account_deletion_requests')
order by tablename,indexname;
