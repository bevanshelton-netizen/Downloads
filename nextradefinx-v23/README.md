# NexTradeFinX V23 — Dedicated Repository Seed

This clean repository seed consolidates the controlled-beta application, Supabase bootstrap and critical beta safety controls into one product-shaped repository.

## Current scope
Education + paper trading only.

Hard boundaries:
- live execution OFF
- client funds OFF
- leverage OFF
- personalised advice OFF
- broker connectivity OFF
- profit promises prohibited

## Start
1. Create a dedicated private GitHub repository named `nextradefinx`.
2. Put the contents of this package at the repository root.
3. Run `npm test`.
4. Run `npm run security:scan`.
5. Create the dedicated Supabase project.
6. Apply `supabase/000_bootstrap.sql`.
7. Run `supabase/verify.sql`.
8. Configure only the public Supabase URL and anon key.
9. Run `npm run activation:check`.
10. With two short-lived normal-user access tokens, run `npm run rls:test`.
11. Invite exactly one beta learner.

Never commit or paste a Supabase service-role key into the client, GitHub, Netlify public variables or chat.
