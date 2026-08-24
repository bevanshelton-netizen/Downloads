# NexTradeFinX V20 Release Evidence Standard

Every controlled-beta release should have one immutable evidence record containing:
- release version and Git commit
- Terms / Privacy / Risk versions
- applied migration IDs
- two-user RLS isolation result
- test counts and critical-defect state
- invite-only cohort cap
- latest V19 go/no-go result
- hard-off state of every real-money capability

The record is canonicalised and SHA-256 hashed. If any field changes after approval, validation fails.

This is an operational integrity record, not a regulatory approval and not proof of trading performance.
