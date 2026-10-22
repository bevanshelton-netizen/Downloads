# KORA TV

KORA TV is the broadcast/channel layer above KORA LIVE.

Architecture:

`KORA CONNECT → KORA LIVE → KORA TV`

KORA LIVE handles contribution transport, link selection, health and failover. KORA TV owns channel identity, programme scheduling, source routing, playback policy and distribution metadata.

## Design principles

- Vendor-neutral contribution and distribution adapters.
- One channel can receive studio, field, event or emergency sources.
- A channel is not considered live merely because a source exists; output acceptance must be verified.
- Scheduled programming and live interruption are first-class modes.
- Emergency/public-safety override is explicit and auditable.
- The channel control plane remains portable across owned and approved external infrastructure.
- No customer-facing route is called live until the IZAKHONO verification gates pass.

## Initial channel modes

- `scheduled` — programme schedule drives output.
- `live` — an accepted KORA LIVE session is on air.
- `simulcast` — one source is distributed to multiple approved outputs.
- `emergency` — authorised emergency bulletin or public-safety feed takes priority.
- `offline` — no accepted output; the channel must not claim live status.

The next integration target is a KORA TV player/distribution adapter that consumes this channel manifest without coupling the control plane to a specific CDN, encoder or broadcaster.
