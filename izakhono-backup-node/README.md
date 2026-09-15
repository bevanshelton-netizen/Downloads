# IZAKHONO BACKUP NODE

Encrypted backup and recovery control for IZAKHONO OWNED CLOUD.

## V1 capabilities

- named backup sets;
- source allowlists;
- AES-256-GCM encryption before archives land on disk;
- SHA-256 archive integrity hashes;
- authenticated-decryption verification;
- configurable retention;
- optional mirror copies to additional mounted storage;
- mirror checksum sidecars;
- scheduled execution interval;
- restore into an isolated staging root;
- audit ledger;
- SQLite WAL metadata;
- zero runtime npm dependencies.

## Why the service runs as root

The stack contains root-owned service configuration and secrets under /etc/izakhono. BACKUP NODE requires read access to those files.

The systemd unit therefore runs as root but is constrained with a localhost bind, admin key, NoNewPrivileges, a read-only system filesystem and a single writable backup root. Backup source paths must also be explicitly allowlisted.

## Backup roots

Primary encrypted archives:

    /var/lib/izakhono-backup/archives

Restore staging:

    /var/lib/izakhono-backup/restores

Optional second disks or NAS mounts should be mounted below:

    /var/lib/izakhono-backup/mirrors/

and then listed in IZAKHONO_BACKUP_MIRROR_ROOTS.

## Recovery key

The archive encryption key is intentionally not stored inside the encrypted archive.

After installation, copy it to a separate offline medium:

    sudo bash export-recovery-key.sh /media/offline/izakhono-backup-recovery.env

If both the server and the separately stored recovery key are lost, encrypted archives cannot be recovered.

## Restore policy

Restore never writes directly over live service data. It extracts into a new directory beneath the restore staging root. An operator must verify the restored data before a controlled cutover.

## Boundaries

BACKUP NODE provides encrypted snapshots and local/mounted-mirror replication. True disaster resilience still requires at least one physically separate storage device or second machine.
