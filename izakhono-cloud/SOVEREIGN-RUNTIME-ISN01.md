# IZAKHONO Sovereign Runtime — ISN-01

## Purpose

The earlier Owner Console cutover proves a workload by building it, running a constrained Docker health probe, recording receipts, and removing the probe container. This runtime layer is the next step: it keeps an approved workload continuously available on the sovereign node while remaining loopback-only.

## First workload

- Node: `ISN-01`
- Project: `kora-network`
- Container port: `3000`
- Stable owner-node loopback port: `18080`
- Health path: `/api/health`
- Local URL: `http://127.0.0.1:18080`

## Deploy

Native owner node:

```bash
sudo python3 izakhono-cloud/sovereign-runtime.py deploy \
  kora-network/.izakhono.json \
  --repo-root /opt/izakhono-isn01/apps \
  --activation-file /var/lib/izakhono-cloud/READY \
  --host-port 18080
```

Windows/WSL owner laptop:

```bash
python3 izakhono-cloud/sovereign-runtime.py deploy \
  kora-network/.izakhono.json \
  --repo-root /opt/izakhono-isn01/apps \
  --activation-file /var/lib/izakhono-cloud/LOCAL_READY \
  --host-port 18080
```

The one-click Windows activator now performs this automatically after ISN-01 owner-machine and KORA workload proof.

## Safety properties

The persistent runtime:

- builds the exact current application source into an immutable local image ID;
- first proves a candidate container on an ephemeral loopback port;
- uses a read-only root filesystem;
- drops all Linux capabilities and restores only CHOWN, SETUID and SETGID;
- applies no-new-privileges, PID, CPU and memory limits;
- binds only to `127.0.0.1`;
- uses Docker `unless-stopped` restart policy;
- records the previous image ID for rollback;
- restores the previous image if final activation fails;
- writes a deterministic runtime receipt under `/var/lib/izakhono-cloud/runtime/`;
- never changes DNS, TLS, firewall, router, or public ingress.

## Status

```bash
python3 izakhono-cloud/sovereign-runtime.py status --project kora-network
```

## Rollback

If a previous image is recorded:

```bash
sudo python3 izakhono-cloud/sovereign-runtime.py rollback \
  --project kora-network \
  --container-port 3000
```

## Truth boundary

A passing persistent runtime proves that ISN-01 can keep KORA running locally. It does **not** prove public reachability, independent HTTPS, payment readiness or commercial readiness.

The next layer is **IZAKHONO EDGE**, which may only point public traffic at the stable loopback runtime after the sovereign runtime receipt exists and the separate public-ingress gates pass.
