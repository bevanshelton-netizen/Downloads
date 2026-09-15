# IZAKHONO REPLICA NODE

Second-host replication for encrypted IZAKHONO BACKUP archives.

## V1 capabilities

- sender and receiver roles in one service;
- streams large archives rather than buffering them in memory;
- only .izbk files below the BACKUP archive root can be sent;
- SHA-256 computed on the primary and independently recomputed by the receiver;
- immutable receiver objects;
- duplicate delivery is idempotent;
- conflicting content for an existing object key is rejected;
- remote receiver keys encrypted at rest on the sender;
- peer hostname allowlist;
- HTTPS required for non-local peers;
- admin and replication audit ledgers;
- zero runtime npm dependencies.

## Critical security property

REPLICA NODE transfers already-encrypted BACKUP NODE archives.

It does not read, store or transmit the BACKUP encryption recovery key. A replica host can hold disaster-recovery archive copies without also holding the decryption recovery key.

## Recovery host

Install the same REPLICA NODE software on a physically separate machine.

The default bind is 127.0.0.1. On a recovery host, bind only to a dedicated private/VPN interface or place the receive endpoint behind an HTTPS edge. Do not expose an unaudited plain-HTTP receiver to the public internet.

Export its receive credential to an offline file:

    sudo bash export-receiver-credential.sh /media/offline/recovery-node.env

Transfer that credential securely to the primary-node administrator and register the recovery peer. Never commit it.

## Primary host

The primary host reads encrypted archives from:

    /var/lib/izakhono-backup/archives

A peer's receive credential is AES-256-GCM encrypted in REPLICA NODE metadata.

Replica metadata is stored under /var/lib/izakhono-replica. Received encrypted archive objects are stored separately under /srv/izakhono-replica-objects so the metadata can be backed up without recursively backing up replicated archives.

POST /v1/peers/:id/sync scans all local .izbk archives and sends them to the selected recovery host. Already-present archives return as duplicates rather than being overwritten.

## Physical boundary

A local second process is sufficient for automated testing, but not disaster recovery. Production resilience requires a physically separate disk/server/site with independent power/failure exposure.
