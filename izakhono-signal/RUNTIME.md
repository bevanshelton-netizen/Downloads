# IZAKHONO SIGNAL runtime

The GitHub scheduler runs at **08:00, 13:00 and 19:00 Africa/Johannesburg** (06:00, 11:00 and 17:00 UTC).

Each run creates per-campaign, per-provider dispatch receipts.

Status meanings:
- `POSTED` — a configured outbound connector accepted the payload.
- `READY_FOR_CONNECTION` — the campaign is ready, but that network has no secured connector configured.
- `FAILED` — a configured connector returned an error; the workflow fails visibly.
- `DRY_RUN` — validation only.

No social credentials are stored in source control.
