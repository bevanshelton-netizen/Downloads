# IZAKHONO OWNED CLOUD

Self-hosted infrastructure stack for IZAKHONO platforms.

## Included services

1. **IZAKHONO DATA NODE** — owned application/event persistence.
2. **IZAKHONO RUNTIME NODE** — owned app process/runtime/deployment layer.
3. **IZAKHONO EDGE NODE** — HTTPS ingress, rate limiting and routing.
4. **IZAKHONO OBJECT NODE** — owned files/object storage.
5. **IZAKHONO QUEUE NODE** — owned jobs, retries and scheduling.
6. **IZAKHONO AUTH NODE** — owned users, sessions, roles, permissions, MFA and service identities.
7. **IZAKHONO ANALYTICS NODE** — owned consent-aware traffic, campaign, conversion and revenue analytics.

All seven services are designed to run on Linux hardware you control and use Node.js built-ins plus SQLite. They do not require hosted database, object-store, queue, authentication or analytics subscriptions.

## Install

From the repository root:

    cd izakhono-owned-cloud
    sudo bash install-owned-stack.sh

The installer validates Node 22.13+, installs DATA, RUNTIME, OBJECT, QUEUE, AUTH and ANALYTICS, and installs EDGE only when a TLS certificate/key already exist. It never creates paid cloud resources and never prints generated service secrets.

## TLS

EDGE NODE expects:

    /etc/izakhono/tls/fullchain.pem
    /etc/izakhono/tls/privkey.pem

If these do not exist, the installer leaves EDGE disabled and reports `EDGE_PENDING_TLS`.

## First owner

After AUTH NODE is installed:

    sudo bash bootstrap-owner.sh

The script asks for owner email, display name and password interactively. The bootstrap key is read internally from the protected server environment file and is never printed.

## Growth OS

After installation:

    sudo bash configure-growth-os.sh

This creates `/etc/izakhono/apps/growth-os.env`, points Growth OS to the owned nodes, and generates a separate measurement-ingest key. AUTH NODE is exposed through its loopback URL; ANALYTICS NODE is available through its loopback URL and private admin key.

## Status

    sudo bash stack-status.sh

Owned Cloud eliminates the software subscription requirement for these seven infrastructure layers, but running infrastructure still requires hardware, disks, backups, power and internet connectivity.

Public DNS registration, a certificate authority relationship, upstream ISP connectivity and large-scale DDoS scrubbing remain external network realities.
