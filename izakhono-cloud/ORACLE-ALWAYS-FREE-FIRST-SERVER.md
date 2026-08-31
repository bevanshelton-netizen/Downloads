# IZAKHONO CLOUD v1.4 — Oracle Always Free first server

This is the preferred **zero-new-monthly-cost** public-host path for the first independent IZAKHONO CLOUD proof.

## Recommended Oracle configuration

- Cloud: Oracle Cloud Infrastructure (OCI) Free Tier / Always Free
- Home region: **South Africa Central (Johannesburg)** (`af-johannesburg-1`) when available to the account
- Image: **Ubuntu 24.04**
- Shape: **VM.Standard.A1.Flex** (Ampere Arm)
- Target allocation: **2 OCPUs / 12 GB RAM** within the conservative Always Free tenancy allowance
- Boot volume: **50–100 GB** within the account's Always Free block-storage allowance
- Public IPv4: enabled
- Inbound TCP: **80, 443**
- SSH TCP 22: allow only from the owner's administration IP when remote shell access is required

Oracle can temporarily report insufficient Always Free A1 host capacity. That is an infrastructure-capacity condition, not an IZAKHONO application failure.

## Account boundary

Creating or verifying an OCI account may require the account owner to provide Oracle with a mobile number, payment-card verification and legal/account acceptance. Those steps are intentionally outside source control and must not be automated with fabricated identity or billing information.

## Preflight after VM creation

Copy or download `oracle-a1-preflight.sh` and run:

```bash
sudo bash oracle-a1-preflight.sh
```

It must report `ORACLE A1 PREFLIGHT: PASS` before installing IZAKHONO CLOUD.

## Zero-touch install

Preferred: provide `cloud-init.yaml` from this branch as the VM user-data at creation time.

Manual immutable fallback:

```bash
curl -fsSL https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/e25d56c37116cebca639c6d0cbf5f72b92bb301c/izakhono-cloud/install-first-server.sh | sudo bash
```

The installer pins the repaired release payload, verifies SHA-256 before extraction, installs the stack, runs `production-proof.sh`, and fails closed unless the proof succeeds.

## Success evidence

After installation:

```bash
sudo /opt/izakhono-cloud/check-first-server.sh
sudo cat /var/lib/izakhono-cloud/status
```

Do not promote PR #105 or call the platform commercially live unless all of the following are true:

1. `/var/lib/izakhono-cloud/READY` exists.
2. `/var/lib/izakhono-cloud/FAILED` does not exist.
3. `production-proof.sh` passed on the real host.
4. Public HTTPS endpoints are reachable from outside the VM.
5. ALLEGRO-VIBEZ can be provisioned through IZAKHONO Core and complete its acceptance tests.

## Official Oracle references checked for this handoff

- OCI Free Tier / Always Free: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm
- Always Free resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- OCI regions: https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm

These provider limits can change. Re-check the Oracle console before creating resources and choose only items explicitly marked **Always Free eligible**.
