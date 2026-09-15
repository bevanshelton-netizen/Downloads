# Growth OS OAuth Token Vault

Provider OAuth access and refresh tokens are **never** stored in source control, browser storage, logs or plaintext database fields.

## Encryption

Growth OS uses AES-256-GCM envelopes before persistence.

Required server secret:

`OAUTH_TOKEN_ENCRYPTION_KEY`

The value must be a Base64-encoded 32-byte random key. It belongs only in the deployment/runtime secret store.

## Persistence contract

A future persistence adapter stores only:
- provider ID
- account/user owner ID
- encrypted envelope
- token expiry metadata
- granted scopes
- created/rotated/revoked timestamps

It must never store:
- raw provider passwords
- plaintext access tokens
- plaintext refresh tokens
- client secrets in database rows

## Activation gate

Live provider writes remain disabled until:
1. provider application approval is complete;
2. OAuth client credentials are configured server-side;
3. the token vault is ready;
4. OAuth authorization succeeds;
5. accessible ad accounts are selected;
6. conversion measurement is mapped;
7. explicit write approval is recorded.

Campaign creation defaults to PAUSED even after the connector is active.
