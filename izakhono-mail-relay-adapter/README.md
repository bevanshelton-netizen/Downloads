# IZAKHONO MAIL RELAY ADAPTER

Owned, replaceable SMTP last-mile adapter for IZAKHONO NOTIFY.

It accepts the existing NOTIFY email-adapter contract on `POST /v1/send` and sends mail through a configured SMTP relay. The control plane does not persist message bodies.

## Why it exists

IZAKHONO owns notification policy, templates, queues and recovery flows. SMTP delivery still needs an email transport. This adapter keeps that transport replaceable: an IZAKHONO-owned SMTP server, the organisation's hosting mail server, or another SMTP provider can be swapped without changing AUTH or ONE AI.

## Security

- loopback bind by default;
- adapter key required;
- STARTTLS/TLS supported;
- SMTP credentials only in the server environment;
- header injection stripped;
- no behavioural tracking;
- no email-body database.

Do not reuse a hosting-control-panel password as an SMTP password. Use a dedicated mailbox/app credential.
