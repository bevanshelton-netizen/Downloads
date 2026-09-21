# KORA GOSPEL TV — Hybrid Intake

## Operating rule

Public acquisition uses **IZAKHONO first** and external infrastructure as resilience, never as the system of record.

### Primary route

`https://gospel.domains.izakhonoafrica.co.za/api/submissions`

- runs on the IZAKHONO-owned Gospel runtime;
- is authoritative;
- stores the Gospel intake record in the owned runtime;
- applies the Gospel editorial, rights and owner-control boundaries.

### External resilience route

`https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/kora-gospel-intake`

- runs on the existing IZAKHONO WebStart Supabase project;
- is a non-authoritative public buffer;
- is used only when the owned intake route is unavailable;
- validates payload size, category and required fields;
- applies a per-source rate limit;
- stores only a truncated hash of the source IP, never the raw IP;
- writes to a table that denies direct anonymous/authenticated browser access.

Buffered records remain **pending IZAKHONO review** until reconciled into the owned Gospel operation.

## Public surfaces

- KORA / Vercel: global acquisition and discovery.
- GitHub Pages: lightweight static fallback.
- IZAKHONO Gospel TV: owned public channel and authoritative intake.
- Supabase Edge Function: resilience buffer only.

## Rights and commercial boundary

A submission, sponsorship enquiry or payment never equals editorial approval. Content, music, participant, territory and platform rights must be cleared before broadcast.

## Failure behaviour

- If IZAKHONO is reachable, forms use the owned route.
- If IZAKHONO returns a validation response, that response is respected; it is not bypassed by external fallback.
- Only network failures, 404/405 route loss, or server-side 5xx failures trigger the external buffer.
- If both routes are unavailable, the user receives a clear failure rather than a false success.
