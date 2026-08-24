# NexTradeFinX V14 — Controlled Beta Activation Checklist

## External infrastructure required
1. Create a dedicated NexTradeFinX Supabase project.
2. Apply the V12/V13 learner, consent and RLS migrations.
3. Copy only the public project URL and anon key into the hosting environment.
4. Never expose a Supabase service-role key to browser/client code.
5. Configure email verification and allowed redirect URLs for the production domain.

## Mandatory pre-launch checks
- Cross-user RLS test: learner A cannot read or mutate learner B.
- Consent receipts are append-only and contain policy version + timestamp.
- Invite-only beta gate is enforced server-side.
- Email verification is enforced.
- Account deletion request flow works without exposing admin credentials.
- Error logs do not contain auth tokens, financial secrets, OTPs or credentials.
- Terms, Privacy and Risk versions are set and published.
- Public pages clearly state education + paper trading only.

## Hard launch locks
The beta must refuse activation unless all are false:
- live execution
- client funds
- leverage
- personalized advice
- broker connectivity

## Launch sequence
1. Internal admin smoke test.
2. Two-account privacy isolation test.
3. One invited test learner.
4. Five-person closed beta.
5. Review incidents, support questions and comprehension failures.
6. Expand only after a written go/no-go review.

A passing V14 gate means the education beta is technically eligible for activation. It does not authorise regulated trading services.
