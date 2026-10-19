# KORA Broadcast Engine

The KORA Broadcast Engine is the provider-independent control layer for linear television delivery.

## Engines

1. **Stream Registry** — resolves a channel to its production HLS URL without coupling KORA to a single media vendor.
2. **Playback Gate** — distinguishes `planned`, `configured`, and `verified`; a configured URL is never presented as a verified live feed.
3. **EPG Engine** — calculates NOW/NEXT from the schedule using absolute timestamps and Africa/Johannesburg presentation.
4. **Channel Router** — keeps channel identity independent from the media provider so streams can be replaced without changing public channel URLs.
5. **Health Plane** — exposes broadcast-engine state through `/api/broadcast/health`.
6. **Guide API** — exposes the current channel guide through `/api/broadcast/guide`.

## Production contract

Each channel may be configured with `KORA_STREAM_URL_<CHANNEL>`. Example: `KORA_STREAM_URL_KORA_ONE`.

A URL alone is **not** enough to mark a stream verified. The production runtime must explicitly set `KORA_STREAM_<CHANNEL>_VERIFIED=true` only after the HLS manifest and playback path have been independently tested.

This deliberately prevents a false `LIVE` state.

## Channel set

- KORA One
- KORA Drama
- KORA Family
- KORA Faith
- KORA Music
- KORA Kids
- KORA Creators

## Provider independence

The engine accepts HLS output from an owned media stack or an external reversible fallback. The application does not require a specific streaming vendor.

## Readiness gate

Broadcast is considered verified only when the required production channel has a reachable HLS manifest, a functioning player path, current EPG data, and explicit runtime verification. Until then the public UI remains in standby/configured state.
