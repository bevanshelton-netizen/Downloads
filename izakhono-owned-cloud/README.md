# IZAKHONO OWNED CLOUD

Self-hosted infrastructure stack for IZAKHONO platforms.

## Included services

1. **IZAKHONO DATA NODE** — owned application/event persistence.
2. **IZAKHONO RUNTIME NODE** — owned app process/runtime/deployment layer.
3. **IZAKHONO EDGE NODE** — HTTPS ingress, rate limiting and routing.
4. **IZAKHONO OBJECT NODE** — owned files/object storage.
5. **IZAKHONO QUEUE NODE** — owned jobs, retries and scheduling.

All five services are designed to run on Linux hardware you control and use Node.js built-ins plus SQLite. They do not require a hosted database, object-store or queue subscription.

## Install

From the repository root:

    cd izakhono-owned-cloud
    sudo bash install-owned-stack.sh

The installer validates Node 22.13+, installs DATA, RUNTIME, OBJECT and QUEUE, and installs EDGE only when a TLS certificate/key already exist. It never creates paid cloud resources and never prints generated service secrets.

## TLS

EDGE NODE expects:

    /etc/izakhono/tls/fullchain.pem
    /etc/izakhono/tls/privkey.pem

If these do not exist, the installer leaves EDGE disabled and reports `EDGE_PENDING_TLS`. This prevents accidental self-signed production certificates.

## Growth OS

After installation:

    sudo bash configure-growth-os.sh

This creates `/etc/izakhono/apps/growth-os.env`, points Growth OS to the owned nodes, and generates a separate measurement-ingest key. Secrets are written with restrictive permissions and are not echoed.

## Status

    sudo bash stack-status.sh

Owned Cloud eliminates the software subscription requirement for these five infrastructure layers, but running infrastructure still requires hardware, disks, backups, power and internet connectivity.

Public DNS registration, a certificate authority relationship, upstream ISP connectivity and large-scale DDoS scrubbing are external network realities; this stack does not pretend otherwise.