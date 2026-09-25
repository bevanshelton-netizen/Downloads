# ALLEGRO-VIBEZ DROP 01 — NODE01 milestone watch

This watcher replaces a ChatGPT scheduled task for DROP 01 milestone alerts. It does **not** consume a ChatGPT automation slot.

## Goal

Alert the owner once, and only once, when verified DROP 01 paid sales first cross:

- R10,000
- R20,000
- R30,000
- R40,000
- R50,000
- R60,000
- R70,000
- R80,000
- R90,000
- R100,000

## Owned scheduling

The existing **IZAKHONO NODE01 Autopilot** already runs every five minutes from Windows Task Scheduler.

On every autopilot heartbeat it invokes:

`owner-host/drop01-milestone-watch.mjs`

The watcher itself enforces a one-hour minimum check interval, so the sales source is not polled every five minutes.

State is stored locally at:

`/var/lib/izakhono-deploy/allegro-drop01-milestones.json`

Previously reported milestones are persisted there and are never intentionally repeated.

## Sales source

The source order is:

1. **IZAKHONO DATA NODE** on loopback — owned primary.
2. Existing public ALLEGRO aggregate progress RPC — reversible resilience fallback while the owned payment event feed is not yet authoritative.

The DATA NODE endpoint is loopback-only:

`GET /v1/local/campaigns/AV-DROP-01/sales?brand=ALLEGRO-VIBEZ`

It exposes aggregate campaign totals only and does not expose customer identities or payment references.

When verified iKhokha payment/refund events are fully mirrored into DATA NODE, set:

`ALLEGRO_DROP01_OWNED_AUTHORITATIVE=true`

At that point the watcher can operate exclusively from IZAKHONO-owned data.

## Alerts

For each new milestone the watcher:

1. attempts an IZAKHONO NOTIFY NODE in-app message when `IZAKHONO_NOTIFY_KEY` is available;
2. attempts a Windows owner-session message through the local Windows host from WSL;
3. records the milestone locally even when a secondary notification adapter is unavailable, preventing notification storms.

NOTIFY NODE uses an idempotency key per milestone.

## Privacy and integrity

- No tracking or behavioural profiling is introduced.
- No payment references are included in public or owner alerts.
- Unpaid carts are not sales.
- Refunds reduce verified paid sales.
- The R100,000 figure is a gross-sales target, not a profit claim.
- External fallback never becomes infrastructure authority.

## Verification

The NODE01 Autopilot CI gate validates:

- Bash syntax;
- watcher JavaScript syntax;
- watcher milestone self-test;
- DATA NODE JavaScript syntax;
- presence of the loopback-only campaign aggregate;
- existing independent HTTPS/live-claim safeguards.

## Manual force check

On NODE01:

```bash
sudo node /opt/izakhono-source/Downloads/owner-host/drop01-milestone-watch.mjs --force
```

The normal hourly throttle remains in effect when `--force` is omitted.
