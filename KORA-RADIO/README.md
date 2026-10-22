# KORA RADIO

KORA RADIO is the audio broadcast layer built on the resilient KORA media stack.

## Architecture

`KORA CONNECT → KORA LIVE → KORA RADIO`

- **KORA CONNECT** selects and ranks available network paths.
- **KORA LIVE** manages contribution sessions, health, failover and recovery.
- **KORA RADIO** owns station identity, audio programming, source routing, output policy and emergency broadcast control.

## Source types

- studio
- phone
- field
- vehicle
- encoder
- podcast
- emergency

## Output types

- web
- mobile
- smart-speaker
- radio-visual
- partner
- archive

## Operating principles

1. Audio-first, with optional visual companion outputs.
2. Reuse KORA LIVE transport and failover rather than creating a separate streaming stack.
3. Emergency broadcasts can override normal programming, but only an accepted upstream live session may be represented as ON_AIR.
4. Keep the control plane vendor-neutral and portable.
5. Never claim a station is live until the upstream session and accepted output have been verified.
6. Design for low-connectivity and graceful degradation across African operating conditions.
