# IZAKHONO AUTOMATIONS

Owner-controlled automation and monitoring engine for IZAKHONO AFRICA.

## What this solves

ChatGPT Tasks and other hosted schedulers may impose plan-level slot limits. IZAKHONO AUTOMATIONS has **no application-level task count limit**. Practical capacity depends on the machine, database size, network connections and workload complexity.

The scheduler is designed to run on an IZAKHONO-controlled Linux node, VM, server or container.

## v1 capabilities

- one-time jobs
- every-N-minute jobs
- daily jobs
- weekly jobs
- condition watches
- incoming webhook triggers
- outgoing HTTP/API actions
- manual "run now"
- pause/resume
- task deletion
- persistent SQLite/WAL task store
- run history
- condition deduplication so an alert fires once per state change
- owner dashboard
- bearer-token admin protection
- health endpoint
- Docker deployment
- systemd deployment
- zero Python package dependencies

## Schedule modes

### Interval
```json
{
  "title": "Ping customer portal",
  "mode": "interval",
  "schedule": {"interval_minutes": 15},
  "action": {"type": "http", "url": "https://example.com/hook", "method": "POST"}
}
```

### Daily
```json
{
  "title": "Morning report",
  "mode": "daily",
  "schedule": {"time": "08:00", "timezone": "Africa/Johannesburg"},
  "action": {"type": "http", "url": "https://example.com/report", "method": "POST"}
}
```

### Weekly
Weekdays use Python/ISO numbering: Monday = 0 through Sunday = 6.

```json
{
  "title": "Monday operating review",
  "mode": "weekly",
  "schedule": {"days": [0], "time": "08:00", "timezone": "Africa/Johannesburg"},
  "action": {"type": "log", "message": "Prepare weekly operating review"}
}
```

### Condition watch
The engine checks the condition on its own cadence. When it changes from not-matched to matched, the action fires once. It does not repeatedly notify while the condition stays matched.

```json
{
  "title": "Production health watch",
  "mode": "condition",
  "schedule": {"interval_minutes": 5},
  "condition": {
    "type": "http",
    "url": "https://example.com/health",
    "expect_status": 200,
    "contains": "READY"
  },
  "action": {
    "type": "http",
    "url": "https://example.com/notify",
    "method": "POST",
    "body": {"message": "Production is ready"}
  }
}
```

### Incoming webhook
Create a webhook-mode task and the API returns a random `webhook_token`. Trigger it with:

```
POST /hook/<webhook_token>
```

The posted JSON payload is made available in the action context.

## Security

Production must set a persistent high-entropy admin token:

```bash
export IZA_AUTOMATIONS_ADMIN_TOKEN='replace-with-long-random-secret'
```

If the variable is omitted, the process generates a temporary secret at startup and prints it to the server console. The API is therefore never intentionally left unauthenticated.

All task administration endpoints require:

```
Authorization: Bearer <admin-token>
```

Webhook tasks use separate randomly generated webhook tokens.

The v1 engine intentionally does **not** execute arbitrary shell commands. This prevents the scheduler from becoming a remote-command-execution service. External systems are called through explicit HTTP(S) actions.

## Run locally

Python 3.11+ is recommended.

```bash
cd izakhono-automations
export IZA_AUTOMATIONS_ADMIN_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
python3 app.py
```

Open:

```
http://localhost:8787
```

Health:

```
http://localhost:8787/health
```

## Docker

```bash
docker build -t izakhono-automations .
docker run -d \
  --name izakhono-automations \
  --restart unless-stopped \
  -p 8787:8787 \
  -e IZA_AUTOMATIONS_ADMIN_TOKEN='YOUR_SECRET' \
  -e IZA_AUTOMATIONS_TZ='Africa/Johannesburg' \
  -v izakhono-automations-data:/app/data \
  izakhono-automations
```

## Linux systemd

Copy the folder to `/opt/izakhono-automations`, create `/etc/izakhono-automations.env`, then install the supplied service:

```bash
sudo cp deploy/izakhono-automations.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-automations
sudo systemctl status izakhono-automations
```

Example environment file:

```bash
IZA_AUTOMATIONS_ADMIN_TOKEN=replace-with-long-random-secret
IZA_AUTOMATIONS_TZ=Africa/Johannesburg
IZA_AUTOMATIONS_HOST=0.0.0.0
IZA_AUTOMATIONS_PORT=8787
IZA_AUTOMATIONS_DB=/opt/izakhono-automations/data/automations.db
```

Keep the environment file readable only by root:

```bash
sudo chmod 600 /etc/izakhono-automations.env
```

## Backup

The authoritative state is the SQLite database under `data/automations.db`. Use the supplied backup script or a normal SQLite backup.

```bash
./deploy/backup.sh
```

## Adapter model

The scheduler core is independent of vendors. Add thin HTTP adapters for:

- Gmail / mailbox watches
- GitHub PR and CI watches
- Vercel or IZAKHONO deployment watches
- PayFast / iKhokha status checks
- market/news monitoring
- weather/event feeds
- AI-agent prompts
- Slack / WhatsApp / email notifications
- IZAKHONO PAY and other internal services

This keeps task capacity and scheduling under IZAKHONO control while credentials stay inside the adapter that needs them.

## Honest capacity statement

There is no hard-coded count such as "5 tasks". A single small node can hold thousands of task definitions, but how many can run reliably at the same instant depends on network latency, CPU, memory and the frequency of each task. Scale horizontally or add worker queues when concurrent workload grows.

## Current v1 limits

- HTTP conditions only
- HTTP/log actions only
- no multi-user RBAC yet
- no encrypted secret vault yet
- single-node scheduler ownership; do not run two scheduler processes against the same DB without leader election

Those are deliberate safety boundaries for the first owner-node release.
