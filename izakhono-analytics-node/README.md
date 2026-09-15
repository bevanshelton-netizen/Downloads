# IZAKHONO ANALYTICS NODE

Owned, privacy-first product and marketing analytics for IZAKHONO platforms.

## V1

- site registration and collect-key rotation;
- consent-aware browser tracker;
- no raw IP storage;
- HMAC-hashed visitor and session identifiers;
- origin allowlists;
- collection rate limiting;
- PII-like property-name rejection;
- pageviews, visitors, sessions and events;
- campaign/UTM attribution;
- conversion and net-revenue reporting;
- top pages, sources, campaigns, referrers, countries and languages;
- hourly/daily time series;
- ordered session funnels;
- private reporting/admin API;
- SQLite WAL;
- zero runtime npm dependencies.

## Browser tracking

The tracker sends nothing until consent is granted.

Example:

    <script
      src="https://analytics.example.com/tracker.js"
      data-site="SITE_ID"
      data-key="COLLECT_KEY">
    </script>

After your consent layer approves analytics:

    window.izakhonoAnalytics.consent(true)

Custom events:

    window.izakhonoAnalytics.track("lead", { form: "hero" })

Do not send names, email addresses, phone numbers, passwords, access tokens, card information or postal addresses as analytics properties. The collector rejects common sensitive property names.

## Privacy boundary

ANALYTICS NODE is analytics, not identity. AUTH NODE owns user identity. Applications should avoid copying personal identity into analytics events.

## Reporting

Private endpoints support overview, top dimensions, time series and sequential funnel analysis.

This service does not require Google Analytics, Mixpanel, Amplitude or another hosted analytics subscription.
