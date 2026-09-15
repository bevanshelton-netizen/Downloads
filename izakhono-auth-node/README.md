# IZAKHONO AUTH NODE

Owned identity and access management for IZAKHONO platforms.

## V1 capabilities

- email/password identities;
- Node built-in scrypt password hashing with per-user random salt;
- opaque session tokens stored only as SHA-256 hashes;
- persistent account lockout after repeated failures;
- in-memory login rate limiting;
- roles and permissions;
- service accounts and hashed API keys;
- AES-256-GCM encrypted TOTP secrets;
- optional TOTP MFA;
- session revocation/logout;
- bootstrap-once owner creation;
- audit ledger with hashed IP/user-agent fingerprints;
- private loopback bind by default;
- SQLite WAL persistence;
- zero runtime npm dependencies.

## Security properties

Passwords, raw session tokens and raw service API keys are never stored in the database.

TOTP secrets are encrypted at rest with `IZAKHONO_AUTH_ENCRYPTION_KEY`.

The initial owner endpoint requires `IZAKHONO_AUTH_BOOTSTRAP_KEY` and permanently refuses bootstrap after the first user exists.

## Application integration

Apps can validate human sessions through `/v1/me` or use service API keys for server-to-server identity.

Later Growth OS integration can put the browser session behind the app's own HttpOnly cookie and use AUTH NODE as the identity authority.

## Boundaries

AUTH NODE does not replace legal identity verification/KYC for regulated financial activity. It authenticates platform users and services; regulated identity proofing is a separate workflow.
