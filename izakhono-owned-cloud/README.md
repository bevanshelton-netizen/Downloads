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
8. **IZAKHONO NOTIFY NODE** — owned templates, preferences, in-app inbox and delivery orchestration.
9. **IZAKHONO AI GATEWAY NODE** — owned local-first model routing, failover, quotas and AI governance.
10. **IZAKHONO CODE NODE** — owned Git repositories, clone/fetch/push, scoped tokens and signed push webhooks.
11. **IZAKHONO BACKUP NODE** — encrypted snapshots, retention, mirror copies, verification and staged restore.

All eleven services are designed to run on Linux hardware you control and use Node.js built-ins plus SQLite. They do not require hosted database, object-store, queue, authentication or analytics subscriptions.

## Install

From the repository root:

    cd izakhono-owned-cloud
    sudo bash install-owned-stack.sh

The installer validates Node 22.13+, installs DATA, RUNTIME, OBJECT, QUEUE, AUTH, ANALYTICS, NOTIFY, AI GATEWAY, CODE and BACKUP, and installs EDGE only when a TLS certificate/key already exist. It never creates paid cloud resources and never prints generated service secrets.

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

This creates `/etc/izakhono/apps/growth-os.env`, points Growth OS to the owned nodes, and generates a separate measurement-ingest key. AUTH NODE is exposed through its loopback URL; ANALYTICS NODE is available through its loopback URL and private admin key; NOTIFY NODE is available through its loopback URL and service key. AI GATEWAY is exposed by URL only until a limited app client key is provisioned. CODE NODE is exposed by URL only until a repository-scoped Git token is provisioned. BACKUP NODE is exposed by URL only; its admin and recovery secrets remain server-side.

## AI client provisioning

After a local model provider and model alias are configured in AI GATEWAY:

    sudo bash provision-ai-client.sh growth-os /etc/izakhono/apps/growth-os.env nexai-default

The script reads the gateway admin key internally, creates a limited client key, writes it into the protected app environment file, and never prints the secret.

## CODE token provisioning

After a repository exists in CODE NODE:

    sudo bash provision-code-token.sh my-repo write growth-os /etc/izakhono/apps/growth-os.env GROWTH_OS_GIT_TOKEN

The script reads the CODE admin key internally, creates a repository-scoped Git token, stores it directly in the protected application environment file, and never prints the secret.

## Stack backups

After installation:

    sudo bash configure-stack-backup.sh

This registers the core stack state under `/etc/izakhono` and the owned service data directories as one encrypted backup set. BACKUP NODE's own archive directory is intentionally excluded to prevent recursion.

The installer creates the encrypted primary backup store, but **a backup on the same physical disk is not disaster recovery**. Mount a separate disk or NAS below `/var/lib/izakhono-backup/mirrors/`, add that mount to `IZAKHONO_BACKUP_MIRROR_ROOTS`, and restart BACKUP NODE.

Export the recovery key to a separate offline medium:

    sudo bash ../izakhono-backup-node/export-recovery-key.sh /media/offline/izakhono-backup-recovery.env

Never store that recovery-key file only on the server being backed up.

## Status

    sudo bash stack-status.sh

Owned Cloud eliminates the software subscription requirement for these eleven infrastructure layers, but running infrastructure still requires hardware, disks, backups, power and internet connectivity.

Public DNS registration, a certificate authority relationship, upstream ISP connectivity and large-scale DDoS scrubbing remain external network realities.
