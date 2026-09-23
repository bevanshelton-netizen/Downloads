# IZAKHONO ONE AI

The owned intelligence layer for **IZAKHONO ONE**.

IZAKHONO ONE is the unified product family intended to replace the core Google-style ecosystem with IZAKHONO-owned services. IZAKHONO ONE AI is not a separate chatbot bolted onto each app. It is the common AI operating layer used by every product.

## Architecture

```
IZAKHONO ONE apps
  -> IZAKHONO ONE AI
    -> IZAKHONO AI GATEWAY
      -> IZAKHONO GPU COMPUTE / local model servers (primary)
      -> approved external inference (overflow/fallback only)
```

Supporting owned services include IZAKHONO Account/Auth, Data, Queue, Code, Cloud, EDGE/TLS and FORTRESS.

## API

- `GET /health` — service status.
- `GET /v1/capabilities` — the canonical Google-replacement capability registry.
- `POST /v1/chat/completions` — OpenAI-compatible chat surface, routed through IZAKHONO AI Gateway.
- `POST /v1/plan` — capability-aware planning without pretending to execute unavailable actions.

Protected endpoints require `Authorization: Bearer <IZAKHONO_ONE_AI_KEY>`.

## Privacy rule

The control plane stores no prompt or response bodies. It does not add tracking, behavioural profiling or advertising identifiers.

## Ownership rule

Owned compute is primary. External AI is optional, reversible overflow/fallback. A planned app is never represented as live merely because IZAKHONO ONE AI understands its target capability.

## Product map

See `capabilities.json`. The registry covers Search, Mail, Drive, Docs, Sheets, Slides, Calendar, Meet, Maps, Photos, Video, Classroom, Forms, Translate, Notes, Contacts, Cloud, Code, Account, Data, Business and News.
