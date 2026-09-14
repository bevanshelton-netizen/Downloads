# IZAKHONO Analytics Command Centre

Owner-controlled first-party analytics for the IZAKHONO fleet.

It measures page views, unique visitors, sessions, per-platform traffic, top pages, sign-ups, checkout starts, purchases, revenue events, and bot traffic.

Privacy defaults: raw IP addresses are not stored. Browser visitor/session identifiers are HMAC-hashed before storage. Referrers are reduced to hostname only. User-agent strings are classified into device/bot status and discarded. Retention defaults to 180 days.

Browser beacon:

```html
<script defer src="https://YOUR-ANALYTICS-ORIGIN/beacon.js?platform=allegro-vibez"></script>
```

Conversion events:

```js
window.izakhonoTrack?.('signup')
window.izakhonoTrack?.('checkout_start')
window.izakhonoTrack?.('purchase', { value_minor: 39900 })
```

The initial ISN-01 pilot binds only to 127.0.0.1:18112. Public sites require a separate HTTPS publication and origin gate before browsers outside the owner machine can send events.
