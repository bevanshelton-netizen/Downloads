# Controlled-beta activation

Gate 0 — Dedicated repository
- V23 installed at repo root
- tests pass
- public-secret scan passes

Gate 1 — Supabase
- dedicated project created
- `000_bootstrap.sql` applied
- `verify.sql` confirms tables/RLS/policies
- verified-email auth enabled
- production redirect URL configured

Gate 2 — Privacy
- create two disposable normal users
- V17 isolation harness must allow A→A and B→B
- it must deny A→B and B→A
- any cross-user access = HALT BETA

Gate 3 — Learner #1
- invite approved
- email verified
- Terms / Privacy / Risk accepted
- Learning Passport created
- first lesson, paper practice and journal completed
- logout/login persistence confirmed

Gate 4 — Evidence
- V19 GO/HOLD/STOP review
- V20 release evidence recorded
- expand only after GO

No gate enables real-money trading.
