-- KORA shared Supabase Data API exposure.
-- Assumes every KORA table has RLS enabled and security advisors were reviewed.

grant usage on schema kora to anon, authenticated, service_role;

grant select on all tables in schema kora to anon;
grant select, insert, update, delete on all tables in schema kora to authenticated;
grant all on all tables in schema kora to service_role;

grant usage, select on all sequences in schema kora to authenticated, service_role;

alter default privileges for role postgres in schema kora
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema kora
  revoke execute on functions from public;
alter default privileges for role postgres in schema kora
  revoke usage, select on sequences from anon, authenticated, service_role;

-- Preserve currently used application schemas while adding KORA.
alter role authenticator set pgrst.db_schemas = 'public,yenzanow,kora';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
