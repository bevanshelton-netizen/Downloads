# IZAKHONO Infrastructure Executor

Production deployment executor for the IZAKHONO infrastructure fabric.

## Authority

- Runtime authority: `IZAKHONO_INFRASTRUCTURE`
- Source authority: IZAKHONO CODE first
- External source: replaceable bootstrap/freshness mirror only
- Laptop eligible: **no**
- WSL eligible: **no**
- Platform-to-laptop traffic: **DENY**

The executor is intentionally different from a GitHub self-hosted runner. GitHub Actions may validate source and observe public state, but production deployment does not wait for GitHub runner availability.

## Execution model

A systemd timer invokes `run-once.sh`. The executor:

1. synchronizes the approved source into the infrastructure checkout, preferring IZAKHONO CODE;
2. validates `IZAKHONO-INFRASTRUCTURE-AUTHORITY.json`;
3. reads `infrastructure/control/portfolio-desired-state.json`;
4. accepts only `deploy-platform` requests whose platform is registered as IZAKHONO infrastructure-owned;
5. maps the platform to a fixed command in `targets.json`;
6. executes only an allow-listed Linux deployer under `izakhono-owned-cloud/`;
7. writes root-only request receipts under `/var/lib/izakhono-infrastructure-executor/requests/`.

No arbitrary command is accepted from the control document.

## Host eligibility

Installation fails closed on WSL, portable/laptop chassis types, and systems exposing a laptop battery. The executor is for managed infrastructure hosts or managed virtual machines only.

## Current migration boundary

Linux-native portfolio targets are allow-listed now. Historical IZAKHONO Windows/ISN-01 deployers are explicitly blocked and must be migrated to Linux-native infrastructure deployers before the executor will accept them. EDU-BUILD/ECD360 is not part of the IZAKHONO portfolio and is intentionally outside this executor.

A successful executor receipt proves infrastructure execution only. It does **not** create an `OWNED LIVE VERIFIED` claim; public DNS, TLS, EDGE, backup/restore, product and payment gates remain separate.
