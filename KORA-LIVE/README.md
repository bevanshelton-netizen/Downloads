# KORA LIVE

**Status:** BUILT / VERIFIED (package level only)

KORA LIVE is the session-orchestration layer above KORA CONNECT. It turns available network links into a managed live contribution session without binding the product to a single connectivity vendor.

## Pipeline

`Source → KORA LIVE Session → KORA CONNECT Links → Selected/Ranked Paths → Stream Output → KORA TV / RADIO / NAV / EMERGENCY`

## Core responsibilities

- Create and track a live contribution session.
- Bind a session to a KORA CONNECT profile.
- Track source, destination, protocol and latency targets.
- Consume deterministic link-health scores from KORA CONNECT.
- Select a primary link and maintain ordered failover candidates.
- Move between `STARTING`, `LIVE`, `DEGRADED`, `FAILOVER`, `RECOVERING`, `STOPPING` and `ENDED` states.
- Record health snapshots without making a connectivity vendor authoritative.
- Expose a vendor-neutral control contract for future encoders, SRT/RTMP/WebRTC adapters and KORA-owned edge runtimes.

## Safety rules

KORA LIVE never claims a session is publicly live merely because a session object exists. A session is `LIVE` only when its runtime reports an accepted output path and health evidence. Public availability still requires the IZAKHONO infrastructure verification gates.

## Planned adapters

- `KORA CONNECT` bonded-link adapter
- SRT contribution adapter
- RTMP contribution adapter
- WebRTC contribution adapter
- future satellite and dedicated IP adapters

Adapters are replaceable. KORA session state remains authoritative.
