# IZAKHONO OWNED CLOUD

Self-hosted infrastructure stack for IZAKHONO platforms.

## SHELTON FORTRESS — THEE PROTECTOR

FORTRESS is now the mandatory private defensive control plane for the primary owner node. It runs on loopback only, with its own PostgreSQL volume and generated secrets. It is not exposed directly to customers and does not store iKhokha credentials. IZAKHONO EDGE remains the public ingress and enforces the FORTRESS sensitive-route policy for payment APIs, including stricter rate limits, smaller request bodies and method/content-type guards.

This integration uses FORTRESS as an internal protection and incident-readiness layer while its separate commercial release gates remain intact.

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
12. **IZAKHONO CI WORKER NODE** — owned CODE/QUEUE build execution with commit pinning, signed triggers and production sandbox policy.\n13. **IZAKHONO REPLICA NODE** — second-host streaming replication for already-encrypted BACKUP archives.\n14. **IZAKHONO DNS NODE** — owned authoritative DNS for delegated IZAKHONO zones, with recursion disabled.
15. **IZAKHONO PACKAGE NODE** — owned npm-compatible package metadata/tarball cache for builds.
16. **IZAKHONO FAILOVER NODE** — owned active/standby monitoring and fenced promotion control.

All sixteen services are designed to run on Linux hardware you control and use Node.js built-ins plus SQLite. They do not require hosted database, object-store, queue, authentication or analytics subscriptions.

## Install

From the repository root:

    cd izakhono-owned-cloud
    sudo bash install-owned-stack.sh

The installer validates Node 22.13+, installs DATA, RUNTIME, OBJECT, QUEUE, AUTH, ANALYTICS, NOTIFY, AI GATEWAY, CODE, PACKAGE, CI WORKER, BACKUP, REPLICA and FAILOVER, and installs EDGE only when a TLS certificate/key already exist. It never creates paid cloud resources and never prints generated service secrets.

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

This creates `/etc/izakhono/apps/growth-os.env`, points Growth OS to the owned nodes, and generates a separate measurement-ingest key. AUTH NODE is exposed through its loopback URL; ANALYTICS NODE is available through its loopback URL and private admin key; NOTIFY NODE is available through its loopback URL and service key. AI GATEWAY is exposed by URL only until a limited app client key is provisioned. CODE NODE is exposed by URL only until a repository-scoped Git token is provisioned. BACKUP NODE is exposed by URL only; its admin and recovery secrets remain server-side. PACKAGE NODE provides the owned npm registry cache used by network-enabled CI builds. CI WORKER is exposed by URL only; pipeline administration stays private. REPLICA NODE is exposed by URL only; peer administration and receiver credentials remain server-side. FAILOVER NODE monitors configured active/standby services but never promotes or changes DNS automatically in V1; fencing evidence and explicit route-switch confirmation are mandatory.

## AI client provisioning

After a local model provider and model alias are configured in AI GATEWAY:

    sudo bash provision-ai-client.sh growth-os /etc/izakhono/apps/growth-os.env nexai-default

The script reads the gateway admin key internally, creates a limited client key, writes it into the protected app environment file, and never prints the secret.

## CODE token provisioning

After a repository exists in CODE NODE:

    sudo bash provision-code-token.sh my-repo write growth-os /etc/izakhono/apps/growth-os.env GROWTH_OS_GIT_TOKEN

The script reads the CODE admin key internally, creates a repository-scoped Git token, stores it directly in the protected application environment file, and never prints the secret.

## CI execution

CI WORKER connects CODE NODE to QUEUE NODE and runs repository checks from disposable workspaces. Production installs use the `systemd` executor with repository code running as the dedicated `izakhono-ci` account, network disabled by default, workspace-only write access and resource limits.

The control-plane test is complete in CI. The first physical IZAKHONO Linux node must still prove transient `systemd-run` sandbox execution before GitHub Actions can be retired for critical repositories.

## Stack backups

After installation:

    sudo bash configure-stack-backup.sh

This registers the core stack state under `/etc/izakhono` and the owned service data directories, including CI metadata/logs, as one encrypted backup set. BACKUP NODE's own archive directory is intentionally excluded to prevent recursion.

The installer creates the encrypted primary backup store, but **a backup on the same physical disk is not disaster recovery**. Mount a separate disk or NAS below `/var/lib/izakhono-backup/mirrors/`, add that mount to `IZAKHONO_BACKUP_MIRROR_ROOTS`, and restart BACKUP NODE.

Export the recovery key to a separate offline medium:

    sudo bash ../izakhono-backup-node/export-recovery-key.sh /media/offline/izakhono-backup-recovery.env

Never store that recovery-key file only on the server being backed up.

## Replica recovery host

Primary-node installation includes REPLICA NODE, but true disaster recovery requires a physically separate Linux host.

On the recovery host install REPLICA NODE only, bind it to an approved private/VPN interface or hardened HTTPS ingress, export its receive credential, and register that peer on the primary node. REPLICA transfers encrypted .izbk files only; it never needs the BACKUP decryption key.

Replica metadata under /var/lib/izakhono-replica is included in the core backup. Replicated archive objects live separately under /srv/izakhono-replica-objects and are deliberately excluded from the backup source set.

## One-command primary deployment

From the repository root on the primary Linux server:

    cd izakhono-owned-cloud
    sudo bash deploy-primary-node.sh

That command now deploys and health-gates the private FORTRESS Protector before the first-host proof can pass.

That installs the full stack, configures Growth OS, creates the encrypted core backup set, runs the first-host production proof and prints a deployment report. Public DNS/TLS activation remains separate because it requires your actual domain/network authority.

## Status

    sudo bash stack-status.sh

Owned Cloud eliminates the software subscription requirement for these sixteen infrastructure layers, but running infrastructure still requires hardware, disks, backups, power and internet connectivity.

IZAKHONO DNS NODE can own authoritative DNS after the parent/registrar delegates a zone to it. Public domain registration/delegation authority, a trusted certificate authority relationship, upstream ISP connectivity and large-scale DDoS scrubbing remain external network realities. The first safe cutover uses the child zone domains.izakhonoafrica.co.za so existing apex mail/TXT/web records are not disturbed.


## Live failover safety

FAILOVER NODE listens on loopback port 8920. It automatically observes primary and standby health and can create a failover candidate after repeated primary failures, but it deliberately refuses silent promotion.

A promotion requires the old primary to be fenced, explicit `PROMOTE` confirmation, and later explicit `ROUTE_SWITCHED` evidence. This reduces split-brain risk until a separate witness/quorum node and two physical production hosts have been proven.


## Independent witness host

WITNESS NODE is an HA companion, **not** part of the primary-node sixteen-service install. Putting it on the primary would destroy its arbitration value.

On a separate Linux host/failure domain:

    export IZAKHONO_WITNESS_BIND=<private-or-vpn-ip>
    cd izakhono-owned-cloud
    sudo bash deploy-witness-node.sh
    sudo bash bootstrap-ha-cluster.sh

The deployment script refuses a normal production install when DATA, RUNTIME or EDGE are already active on the same host. The cluster bootstrap creates separate primary and standby member credentials without printing their secrets.

WITNESS uses exclusive 15-second leases, monotonic fencing tokens and Ed25519-signed lease receipts. Automatic failover still remains disabled until the primary and standby RUNTIME/EDGE layers enforce witness lease expiry/fencing on real physical hosts.


## Enrol primary and standby with WITNESS

After the witness host creates the HA cluster, transfer only the matching member credential plus the witness public-key JSON to each application host.

Primary:

    sudo bash configure-witness-member.sh primary /secure/primary.env /secure/public-key.json

Standby:

    sudo bash configure-witness-member.sh standby /secure/standby.env /secure/public-key.json

Enrollment pins the Ed25519 witness key, verifies the live witness exposes that same key, validates the member credential, configures both RUNTIME and EDGE, and starts in **observe** mode only. The primary must prove that both layers hold the same valid fencing token. The standby may remain lease-inactive while primary leadership is valid.

### Deliberately enable write fencing

After observe-mode enrollment has been proven on the real primary/witness/standby path:

    sudo bash set-witness-mode.sh primary enforce

and on the standby:

    sudo bash set-witness-mode.sh standby enforce

Primary enforcement is refused unless RUNTIME and EDGE both hold a valid signed lease with matching fencing tokens. A standby without leadership is expected to fail closed for write methods. The script proves that behavior against RUNTIME before reporting success.

Rollback to observation without removing witness enrollment:

    sudo bash set-witness-mode.sh primary observe
    sudo bash set-witness-mode.sh standby observe

Changing witness mode does **not** enable automatic DNS or route failover. FAILOVER NODE remains the promotion/control plane and public route switching stays explicit until the physical multi-host cutover has been proven.
