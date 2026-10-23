# KORA AI

KORA AI is the intelligence and companion layer across the KORA ecosystem.

## Architecture

`KORA AI → LEARN / NAV / SPORT / NEWS / MUSIC / TV / RADIO`

KORA AI provides a unified conversational and decision-support experience while each domain retains its own safety, editorial, licensing and playback policies.

## Core capabilities

- Natural-language KORA assistant
- Cross-domain questions and routing
- Learner-driver tutoring and readiness guidance
- Road-safety and navigation assistance
- Sports information and safe audio summaries
- News discovery with verification-aware responses
- Music discovery and catalogue assistance
- TV/radio programme and live-session assistance
- Multilingual African-first interaction
- Context-aware, low-distraction driver mode

## Safety boundary

KORA AI must not override domain policy. It cannot turn unverified news into verified news, an unofficial learner exam into an official government test, stale sports data into live data, or an unverified live stream into an ON_AIR state.

For driving contexts, safety takes priority over conversational convenience and responses should minimise distraction.

## Provider architecture

KORA owns the orchestration, user experience, business rules, routing and control plane. External AI models may be connected as replaceable adapters. No single model provider is treated as the KORA system itself.
