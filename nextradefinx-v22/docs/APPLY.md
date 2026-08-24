# Apply V22 bootstrap

1. Create the dedicated NexTradeFinX Supabase project.
2. Open SQL Editor.
3. Run `supabase/000_bootstrap.sql` once. It is designed to be safely re-runnable for policy setup.
4. Run `supabase/verify.sql`. Confirm all five tables report RLS=true and only expected policies exist.
5. Configure verified-email authentication and allowed redirect URLs.
6. Run V17 two-user isolation with normal user access tokens. Never use the service-role key for the isolation test.
7. Record the result in V20 release evidence.

Do not invite a real learner if any cross-user access occurs.
