# IZAKHONO Warm Standby Handoff

This is a **warm snapshot standby**, not synchronous hot replication.

## Prepare the standby host

Use a physically separate Linux host and an approved private/VPN address.

Transfer only:
- the WITNESS standby member credential;
- the WITNESS public-key JSON.

Then run:

    export IZAKHONO_STANDBY_BIND_HOST=<private-vpn-ip>
    export IZAKHONO_STANDBY_NODE_ID=standby-01
    export IZAKHONO_STANDBY_WITNESS_CREDENTIAL=/secure/standby.env
    export IZAKHONO_WITNESS_PUBLIC_KEY_JSON=/secure/public-key.json
    sudo bash deploy-standby-node.sh

The script installs the owned stack with no public route, binds the RUNTIME proxy to loopback, exposes only the REPLICA receiver on the specified private/VPN interface, enrolls the host as the WITNESS standby and enables fail-closed write fencing.

A standby that accidentally holds the leadership lease during preparation is **not certified**.

## Replicate the encrypted recovery image

On the primary, register the recovery host as a REPLICA peer and sync encrypted `.izbk` archives. REPLICA never transfers the backup decryption recovery key.

Keep the recovery key on a separate offline medium.

## Stage a recovery point

Temporarily attach the offline recovery-key medium to the standby and run:

    sudo bash stage-standby-replica.sh /media/offline/izakhono-backup-recovery.env 60

The optional `60` means the newest replica must be no older than 60 minutes.

The staging flow:
1. chooses the newest replicated archive;
2. rejects it when older than the recovery-point limit;
3. asks REPLICA NODE to recompute and verify SHA-256;
4. verifies the digest against the selected object metadata;
5. decrypts the archive using the separately supplied recovery key;
6. extracts only beneath `/var/lib/izakhono-standby/restores/`;
7. produces a proof receipt.

It does **not** overwrite `/etc/izakhono`, `/var/lib/izakhono-*`, change DNS, move a public route or promote the standby.

## Promotion boundary

A controlled promotion still needs:
- primary fencing;
- current WITNESS leadership on the standby;
- an accepted recovery point;
- a controlled state cutover from staging into live service paths;
- service validation;
- explicit FAILOVER approval;
- explicit route/DNS cutover.

The repository now includes a separate guarded live-state tool:

    sudo bash /opt/izakhono-owned-cloud/promote-standby-state.sh plan

After the original primary is fenced and the standby holds a newer verified WITNESS fencing token, execution requires:

    export IZAKHONO_STANDBY_PROMOTION_CONFIRM=PROMOTE-STAGED-STATE
    export IZAKHONO_PROMOTION_PREVIOUS_TOKEN=<old-primary-token>
    export IZAKHONO_PROMOTION_CURRENT_TOKEN=<standby-token>
    sudo bash /opt/izakhono-owned-cloud/promote-standby-state.sh execute

The promotion transaction restores only authoritative mutable state for DATA, OBJECT, QUEUE, AUTH, ANALYTICS, NOTIFY, AI GATEWAY and CODE. It also restores the matching service environment files so encryption/signing keys remain compatible with the recovered databases.

It deliberately preserves node-specific standby configuration: RUNTIME, EDGE, REPLICA, FAILOVER, WITNESS enrollment and local routing state are not replaced.

The tool does not change DNS or the public route. It stops the affected stateful services, applies an atomic local directory swap, restarts and health-checks them, and automatically restores the standby's previous local state if the cutover fails.

**Failback boundary:** a real production failback after users have written data on the promoted standby still requires state reconciliation back to the original primary. The existing controlled failback drill must not be treated as a general-purpose data-safe production failback until that reconciliation path is proven.