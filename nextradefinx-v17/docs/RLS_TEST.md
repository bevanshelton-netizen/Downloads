# V17 two-user RLS isolation test

Use two disposable NexTradeFinX test learners. Sign each in normally and obtain a short-lived access token from the authenticated session.

Set only:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- RLS_TEST_USER_A_TOKEN
- RLS_TEST_USER_B_TOKEN

Never use a service-role key for this test: it bypasses RLS and would make the test meaningless.

Run:
`node scripts/rls-isolation-check.mjs`

Pass criteria:
1. User A reads A's learner passport.
2. User A cannot read B's learner passport.
3. User B reads B's learner passport.
4. User B cannot read A's learner passport.

A single cross-user read is a launch-blocking privacy failure. Trigger HALT_BETA and fix policy/configuration before inviting anyone.
