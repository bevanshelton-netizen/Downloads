# KORA GOSPEL TV — Hybrid Distribution

## Principle

**IZAKHONO is the origin and control plane. External services are distribution lanes.**

The owned platform keeps the authoritative programme schedule, live master feed, content approvals, submissions, prayer intake, analytics handoff, and channel identity. External platforms are retained for reach, discovery, redundancy, and audience acquisition.

## Broadcast flow

```
Cameras / studio / remote feeds
          ↓
IZAKHONO Gospel ingest + master encode
          ↓
IZAKHONO primary player / HLS
          ↓
Simulcast fan-out
   ↙        ↓        ↘
YouTube   Facebook   other approved destinations
```

The fan-out script is `izakhono-owned-cloud/kora-gospel-tv-simulcast.sh`.

It reads secrets only from `/etc/izakhono/kora-gospel-tv-simulcast.env` by default. Real stream keys must never be committed to GitHub.

## Distribution roles

- **IZAKHONO owned runtime** — authoritative origin and master channel.
- **KORA / Vercel** — discovery, web distribution, audience handoff and resilience.
- **GitHub Pages** — lightweight public mirror/fallback.
- **YouTube / Facebook / other video platforms** — optional simulcast endpoints once channel credentials and rights are cleared.
- **Instagram / TikTok / short-form social** — promotional clips and approved live/short-form distribution where the account/platform supports it.
- **Smart TV / OTT partners** — consume the owned HLS/DASH feed or an approved partner feed when added.

## Rights and editorial boundary

No external platform may bypass KORA GOSPEL TV editorial approval. Every music video, sermon, service, interview, concert or third-party feed must have the relevant publication/broadcast rights before distribution.

Commercial sponsorship does not automatically approve editorial content.

## Failure model

If an external service fails, the IZAKHONO channel remains the source of truth.

If the public owned hostname is temporarily unavailable, KORA/Vercel and the public mirror remain discovery/fallback surfaces.

External platform failures must be treated as degraded distribution, not as loss of ownership or loss of the master channel.
