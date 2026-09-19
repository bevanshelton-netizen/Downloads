# IZAKHONO GROWTH OS v2

**One command centre. Every growth channel.**

Growth OS is IZAKHONO's owned marketing operating system. It is designed to go beyond paid-ad account management by combining:

- paid media across Google, Meta, TikTok, LinkedIn, Amazon and Microsoft;
- organic social planning and publishing adapters;
- multilingual campaign localization;
- creative production workflows;
- landing pages and UTM governance;
- lead pipeline visibility;
- cross-channel attribution;
- compliance preflight;
- budget planning and approval controls.

## Safety model

1. Read before write.
2. New campaigns are drafts / paused by default.
3. Budget changes require explicit approval.
4. Account credentials never belong in source control.
5. Platform OAuth and API adapters are added behind server-side secrets.
6. Demo/sandbox data is always labelled.

## Connector roadmap

Each provider implements the same internal adapter contract:

- list accounts
- read campaigns and metrics
- create paused campaign
- update paused campaign
- propose budget change
- activate only after explicit approval
- log every mutation
- revoke connection

## Current launch state

Growth OS v2 is the production application. The UI, planner, provider readiness APIs, measurement ingestion and owned DATA integration run together in this Next.js application. Provider cards remain disconnected until each provider's OAuth/app credentials and approvals are configured.

The production target is the IZAKHONO owner-controlled stack:

```text
ISN-01 -> IZAKHONO CODE -> IZAKHONO RUNTIME -> IZAKHONO EDGE -> growth.izakhonoafrica.co.za
```

Run `START-GROWTH-OS-V2-ON-IZAKHONO.cmd` on the owner machine. The deployment is health-gated at `/api/health`, preserves the approval-before-write policy, and records a deployment receipt. Vercel is not required.


## Owner authentication and approvals

Growth OS v2 uses IZAKHONO AUTH NODE for owner/admin sessions. Browser credentials are posted to the Growth OS server, which forwards them to AUTH NODE and stores the returned opaque session only in an HttpOnly cookie. Sensitive Growth OS APIs check `growth.read` or `growth.write` before reading owned stats or creating/deciding approval records in IZAKHONO DATA NODE.

Protected routes include `/api/stats`, `/api/approvals` and `/api/approvals/[id]/decision`. Approval decisions remain separate from provider execution; live ad writes stay disabled until the provider adapter and execution gate are explicitly enabled.
