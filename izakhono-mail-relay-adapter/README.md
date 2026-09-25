# IZAKHONO MAIL RELAY ADAPTER

Owned, replaceable SMTP last-mile adapter for IZAKHONO NOTIFY and portfolio business mail.

It accepts the existing NOTIFY email-adapter contract on `POST /v1/send` and sends mail through a configured SMTP relay. The control plane does not persist message bodies.

## Platform sender identities

The adapter now loads the approved portfolio sender export in `sender-identities.json`.

Clients select a sender by stable `senderId`; they may not supply arbitrary From addresses.

Example:

```json
{
  "messageId": "kora-001",
  "channel": "email",
  "senderId": "kora",
  "to": "partner@example.com",
  "subject": "KORA partnership",
  "body": "Hello"
}
```

For a transactional sender, pass `"transactional": true` and the adapter uses the platform's approved no-reply identity.

Examples of approved identities include:

- `kora` -> `kora@izakhonoafrica.co.za`
- `faisready` -> `info@faisready.co.za`
- `edubuild` -> `info@edubuildshelton.org.za`
- `doxasure` -> `info@doxahosting.co.za`

The canonical portfolio identity source is maintained in `bevanshelton-netizen/izakhono-builder` at `infra/mail-stack/platform-identities.json`. This runtime file is a generated/exported copy and must be refreshed when the canonical registry changes.

## Why it exists

IZAKHONO owns notification policy, templates, queues and recovery flows. SMTP delivery still needs an email transport. This adapter keeps that transport replaceable: an IZAKHONO-owned SMTP server, the organisation's hosting mail server, or another SMTP provider can be swapped without changing platform engines.

## Security

- loopback bind by default;
- adapter key required;
- STARTTLS/TLS supported;
- SMTP credentials only in the server environment;
- approved sender IDs only;
- arbitrary From-address injection rejected;
- header injection stripped;
- no behavioural tracking;
- no email-body database.

Do not reuse a hosting-control-panel password as an SMTP password. Use a dedicated mailbox/app credential.

## Verification

```
npm run check
```

This self-test confirms sender allowlisting, SMTP envelope/header identity selection, adapter authentication, dot-stuffing and fail-closed behaviour.

A successful local self-test does not prove public email deliverability. MX, SPF, DKIM, DMARC, relay authorisation, external send and external reply must still be verified before an identity is called LIVE VERIFIED.
