# IZAKHONO CODE NODE

Self-hosted Git source-control core for IZAKHONO.

## V1 capabilities

- real Git smart HTTP using the operating system git-http-backend;
- normal git clone, git fetch and git push;
- bare repositories under an owned storage root;
- private repositories by default;
- optional public-read repositories;
- one-time read/write repository tokens;
- token hashes only in the database;
- token expiry and revocation;
- repository ref, branch and tag inspection;
- commit-history API;
- HMAC-signed push webhooks;
- webhook host allowlists;
- admin and audit API on the private node;
- SQLite WAL metadata;
- zero runtime npm dependencies.

## Git access

Create a repository and issue a scoped token through the private admin API.

Git clients authenticate using HTTP Basic auth. The username is ignored and the token is the password.

In production, expose only the /git/* surface through EDGE NODE. Keep /v1/* administration on the private service network.

## Storage

Repository data:

    /var/lib/izakhono-code/repos/*.git

Metadata and audit:

    /var/lib/izakhono-code/code.sqlite

Back up both.

## Webhooks

Push webhooks contain changed Git refs only, not source-code bodies. Each delivery carries:

    X-IZAKHONO-Event: push
    X-IZAKHONO-Signature: sha256=<HMAC>

Webhook targets must be on IZAKHONO_CODE_WEBHOOK_ALLOWLIST. Non-local targets require HTTPS.

## Security boundaries

CODE NODE does not execute repository code. Build and test execution belongs in a separate isolated CI worker or a controlled RUNTIME/QUEUE workflow.

Do not expose the admin key to browser applications or repository users.
