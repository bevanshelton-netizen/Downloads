# IZAKHONO QUEUE NODE

Owned jobs, retries and scheduling for IZAKHONO platforms.

## V1 capabilities

- named queues;
- scheduled `runAt` jobs;
- worker leases with expiry/recovery;
- retries;
- max-attempt dead-lettering;
- recurring interval jobs;
- unique-key idempotency;
- job cancellation;
- queue statistics;
- activity ledger;
- private service-key authentication;
- SQLite WAL persistence;
- zero runtime npm dependencies.

## Use cases

- Growth OS reporting and account polling;
- approved social/ad publishing;
- webhook retries;
- email/notification jobs;
- backups;
- periodic data synchronization;
- platform maintenance tasks.

Workers pull jobs using a lease. If a worker dies, the lease expires and the job becomes available again.

This replaces the core scheduled-job/queue portion of hosted workflow services when installed on an IZAKHONO-controlled node.
