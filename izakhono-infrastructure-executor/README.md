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
4. accepts only `deploy-platform` for registered platforms or `run-workload` for fixed internal workload IDs;
5. resolves both request types to fixed commands in `targets.json`; control requests never contain commands;
6. executes only an allow-listed Linux deployer under `izakhono-owned-cloud/`;
7. writes root-only request receipts under `/var/lib/izakhono-infrastructure-executor/requests/`.

No arbitrary command is accepted from the control document.

## Host eligibility

Installation fails closed on WSL, portable/laptop chassis types, and systems exposing a laptop battery. The executor is for managed infrastructure hosts or managed virtual machines only.

## Current migration boundary

Every platform currently registered in the IZAKHONO platform catalog now points to a Linux-native deployment path. Windows/ISN-01 deployers remain only as historical compatibility artifacts and are not selected by the catalog or executor.

KORA, FAISReady and IZAKHONO Analytics build from the canonical portfolio checkout. Allegro-Vibez and The Chancellor remain separate source repositories and are consumed as controlled source mirrors while their runtime stays on IZAKHONO infrastructure.

EDU-BUILD/ECD360 is not part of the IZAKHONO portfolio and is intentionally outside this executor.

A successful executor receipt proves infrastructure execution only. It does **not** create an `OWNED LIVE VERIFIED` claim; public DNS, TLS, EDGE, backup/restore, product and payment gates remain separate.
