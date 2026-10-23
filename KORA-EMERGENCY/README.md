# KORA EMERGENCY

KORA EMERGENCY is the emergency response layer connected to KORA NAV, KORA CONNECT and FORTRESS.

## Architecture

`KORA NAV → KORA EMERGENCY → VERIFIED RESPONSE CHANNELS`

## Core capabilities

- emergency incident creation
- hijacking/security event workflow
- SOS and assisted-response states
- location and vehicle context references
- trusted-contact notification references
- emergency-service routing references
- resilient communication through KORA CONNECT
- offline/degraded-mode handling
- incident timeline and audit metadata
- explicit confirmation of response actions

## Safety boundary

KORA must distinguish between **requested**, **sent**, **acknowledged** and **confirmed** emergency actions. The system must never tell a user that police, medical, rescue or another responder has been contacted unless that action is actually confirmed by the relevant channel.

KORA EMERGENCY is an orchestration and safety layer. It does not replace government emergency services, private security providers or other authorised responders.
