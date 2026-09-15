# IZAKHONO DATA NODE

Owned persistence for IZAKHONO platforms without Supabase or another hosted database bill.

## What it provides

- file-backed SQLite database using Node's built-in `node:sqlite`;
- WAL mode and idempotent event ingestion;
- leads / conversions / payments / refunds;
- campaign approval queue;
- activity ledger;
- provider-connection metadata;
- conversion mappings;
- private API protected by `IZAKHONO_DATA_KEY`;
- local backups;
- systemd service for an owned Linux node.

## Zero-third-party-database mode

Growth OS connects to this service using:

- `IZAKHONO_DATA_URL`
- `IZAKHONO_DATA_KEY`

The service itself runs on hardware you control. There is no Supabase subscription requirement.

## Quick test

Requires Node 22.13+.

```bash
npm run check
```

## Production

Run it behind your own reverse proxy / TLS gateway. Bind the service to `127.0.0.1` unless a private network overlay is being used.

Never expose `IZAKHONO_DATA_KEY` in browser code, GitHub, or a public log.

## Scale path

SQLite is the first owned single-node persistence engine. The API contract is deliberately database-independent so a future IZAKHONO distributed Postgres-compatible engine can replace SQLite without changing Growth OS.
