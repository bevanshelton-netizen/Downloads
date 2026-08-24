# NexTradeFinX V17 — Supabase Activation & Isolation Harness

V17 converts the remaining infrastructure handoff into executable checks.

It includes:
- safe environment validation
- privileged-secret leak detection
- hard-off checks for all real-money capabilities
- read-only SQL policy inspection
- an automated two-user RLS isolation harness using short-lived user access tokens
- launch-blocking pass/fail rules

No Supabase credential is included. No production infrastructure is activated by this package.
