# IZAKHONO NOTIFY NODE

Owned notification control plane for IZAKHONO platforms.

## V1

- templates with simple variables;
- recipient channel configuration;
- AES-256-GCM encrypted email/phone/webhook destinations;
- consent/preferences;
- suppression lists using keyed destination hashes;
- idempotent sends;
- scheduled delivery through IZAKHONO QUEUE NODE;
- retries and dead-letter behavior inherited from QUEUE NODE;
- fully owned in-app inbox;
- email, SMS, WhatsApp and webhook adapter interfaces;
- delivery-attempt ledger;
- SQLite WAL;
- zero runtime npm dependencies.

## Last-mile reality

NOTIFY NODE owns notification policy, templates, scheduling, retries, preferences and audit.

**In-app notification delivery is fully owned.**

Email, SMS and WhatsApp ultimately require a delivery network:
- email can point to an owned mail relay or another SMTP/HTTP adapter;
- SMS requires a mobile-network/SMS gateway relationship;
- WhatsApp requires an approved WhatsApp transport/provider relationship.

The architecture keeps those transports replaceable so the platform is not locked to one vendor.

## Adapter contract

Configured email/SMS/WhatsApp adapters receive JSON:

    {
      "messageId": "...",
      "recipientRef": "...",
      "channel": "email",
      "to": "destination",
      "subject": "...",
      "body": "...",
      "payload": {}
    }

Optional header:

    x-izakhono-adapter-key: ...

Webhook notifications can post directly to allowlisted destination hostnames.

## Privacy

Contact destinations are encrypted at rest. Suppression matching uses keyed hashes. Raw addresses are decrypted only during delivery.
