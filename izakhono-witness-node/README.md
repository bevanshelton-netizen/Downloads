# IZAKHONO WITNESS NODE

Independent arbitration service for future quorum-backed IZAKHONO failover.

## V1

- named availability clusters;
- primary/standby member credentials stored only as SHA-256 hashes;
- short exclusive leadership leases;
- renewal by the current holder without token change;
- takeover only after prior lease expiry/release;
- monotonically increasing fencing tokens;
- Ed25519-signed lease receipts;
- administrative cluster freeze;
- audit ledger;
- SQLite WAL with FULL synchronous durability;
- zero runtime npm dependencies.

## Critical deployment rule

**Do not place the production witness on the same physical machine, power supply or local network failure domain as either the primary or standby.**

A witness on the primary server adds no meaningful arbitration during a primary-site failure.

## Why this is not automatic failover yet

The witness creates an external source of leadership truth, but safe automatic failover also requires the application/runtime/edge layers to enforce its lease/fencing tokens. An isolated old primary must stop accepting writes after losing its witness lease.

Until that enforcement is implemented and proven on two physical application nodes plus this independent witness:

- FAILOVER NODE automatic promotion remains OFF;
- automatic DNS mutation remains OFF;
- promotion still requires explicit fencing evidence.

## Port

Default loopback API: `127.0.0.1:8930`.

For production, expose it only over an approved private/VPN network or hardened TLS ingress between the two application hosts and the witness host.

## Lease receipt

Each successful lease acquisition/renewal returns an Ed25519-signed receipt containing cluster, member, fencing token and lease expiry. The witness public key is available from `/v1/public-key`; the private signing key never leaves the witness.
