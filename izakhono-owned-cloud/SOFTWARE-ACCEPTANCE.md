# IZAKHONO OWNED CLOUD — Software Acceptance

## Completion definition

The software build is **complete** when the release workflow passes all of the following on the same commit:

1. all 17 owned node packages pass their own `npm run check`;
2. all deployment, backup, witness, physical-HA, failover and failback scripts pass shell syntax;
3. Growth OS completes a production build;
4. FAILOVER remains non-automatic until physical acceptance;
5. WITNESS requires an independent failure domain;
6. RUNTIME and EDGE contain fail-closed witness write fencing;
7. FORTRESS remains private and does not store payment credentials;
8. DNS/PACKAGE/FAILOVER/WITNESS control ports remain collision-free.

A passing release is reported as:

`SOFTWARE_COMPLETE_PHYSICAL_ACTIVATION_PENDING`

## What that status means

It means the repository has reached the end of the software-build phase. It does **not** claim that high availability, public routing, DNS delegation, trusted TLS, backup media separation or disaster recovery have been physically proven.

## Physical activation gates

Production acceptance still requires real infrastructure:

- primary Linux host installed and first-host proof PASS;
- physically separate warm standby;
- physically independent WITNESS host;
- separate backup/replica storage;
- witness enrollment on primary and standby;
- RUNTIME/EDGE witness mode moved from observe to enforce only after signed-lease proof;
- physical HA acceptance script PASS;
- controlled failover drill PASS using the real route authority;
- controlled failback PASS;
- public DNS delegation and trusted TLS using domains/network authority you control.

Those gates cannot be truthfully completed inside GitHub CI because they require distinct physical machines, networks and external routing authority.

## Acceptance commands

Repository/static acceptance:

    bash izakhono-owned-cloud/software-acceptance.sh

Physical HA acceptance after machines exist:

    bash izakhono-owned-cloud/prove-physical-ha.sh

Controlled cutover planning:

    bash izakhono-owned-cloud/controlled-failover-drill.sh plan
