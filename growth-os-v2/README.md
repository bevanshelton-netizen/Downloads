# IZAKHONO GROWTH OS v2

A deployable front-end prototype for an AI growth platform inspired by the useful parts of ZEELY but extended into a wider small-business operating system.

## What v2 adds
- Multi-brand command centre
- AI campaign brief → campaign pack
- Batch creative concepts
- Social content autopilot
- Landing-page builder concept
- Leads/CRM workflow
- Revenue and ROAS dashboard
- Owner approval guardrails
- Meta, Google, TikTok, LinkedIn, WhatsApp Business and iKhokha connection layer
- Share button / Web Share API

## Product direction
The goal is not to clone ZEELY. It is to combine ad creation with distribution, lead capture, follow-up, landing pages, payments, attribution and portfolio management.

## Run locally
Open `index.html` in a browser.

## Production integration still required
This prototype intentionally does not embed secrets or pretend third-party APIs are connected. Production deployment needs OAuth/API credentials and server-side connectors for each selected channel, plus analytics and iKhokha callbacks.

## Folder
`growth-os-v2/`

## IZAKHONO owned-infrastructure deployment

Growth OS v2 is deployed through the owner-controlled stack, not Vercel:

```text
ISN-01 -> IZAKHONO CODE -> IZAKHONO RUNTIME -> IZAKHONO EDGE -> growth.izakhonoafrica.co.za
```

On the owner Windows machine, run `START-GROWTH-OS-V2-ON-IZAKHONO.cmd`. The launcher refreshes the current source into IZAKHONO CODE, deploys a health-gated release to RUNTIME, verifies the local EDGE route, records a deployment receipt, and only reports public HTTPS as verified when the real hostname answers successfully. It does not force a DNS cutover.
