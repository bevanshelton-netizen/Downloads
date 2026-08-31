# IZAKHONO CLOUD v1.4 — Zero-Touch First Server

## Added
- provider-neutral cloud-init bootstrap
- one-command first-server installer
- immutable release payload split into repository-hosted text chunks
- pinned installer and payload commit references
- SHA-256 release verification before extraction
- fail-closed production proof gate
- persistent READY / FAILED server state markers
- root-only copy of Owner Console credentials
- durable bootstrap log
- stricter core-container startup verification

## Installation model
A compatible Ubuntu 24.04 host can receive `cloud-init.yaml` as user-data at creation time. The cloud-init file fetches an immutable installer commit. The installer reconstructs the release from repository-hosted chunks pinned to an immutable payload commit, verifies SHA-256, installs Docker and IZAKHONO CLOUD, runs the live production proof, and records READY only after every proof passes.

## Current validation
The packaged v1.4 release checksum has been verified as:

`3df20c679d0ce8956ccfba7f4deb7528e221b9f112a2ceb238a22b045e9d939f`

Static shell/Python validation and the packaged launch gate pass in the build workspace. Runtime Docker execution remains deliberately unclaimed until the first real Docker-capable Linux host runs the proof.

## External boundary
The owner machine or cloud-provider VM itself must exist and be reachable. Provider-side network/security rules must permit inbound TCP 80 and 443, and SSH 22 only where required. There is currently no connected infrastructure provider available in this ChatGPT session that can create that machine on the owner's behalf.

## Truth rule
Do not call IZAKHONO CLOUD commercially live until `/var/lib/izakhono-cloud/READY` exists on a real public host and the public endpoints have been independently checked.
