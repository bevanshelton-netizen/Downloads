# KORA OTT API Contract v0.1

Base path: `/api/ott`

## Core resources

### GET /channels
Returns published live/FAST channels with id, title, logo, stream URL/reference, genre, language and availability.

### GET /channels/{channelId}/schedule
Returns EPG entries with start/end time, programme, description, artwork and playback reference.

### GET /vod
Returns searchable VOD assets with title, synopsis, artwork, duration, genre, language, age rating and entitlement.

### GET /vod/{assetId}
Returns a single VOD asset and playback metadata.

### GET /me
Returns authenticated profile and active entitlements.

### POST /entitlements/check
Input: `{ "assetId": "...", "profileId": "..." }`
Returns `{ "allowed": true|false, "reason": "..." }`.

### GET /ads/slots
Returns eligible sponsor/ad inventory for a device, placement and content context.

### POST /analytics/events
Accepts normalized playback and engagement events. Device clients must send the same event schema regardless of platform.

## Device capability contract
Clients identify themselves with: platform, OS/runtime, app version, screen class, DRM capability, casting capability and connectivity state.

## Security requirements
- No secret credentials in device clients.
- Playback authorization is server-side.
- Entitlement responses are short-lived where appropriate.
- Personal data collection is minimized.
- Device telemetry is separated from payment credentials.

## Architecture rule
Business rules remain server-side and platform-neutral. TV, mobile and web clients are presentation/adaptation layers over these contracts.
