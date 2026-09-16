# IZAKHONO Accessible Owner Host

This package turns the owner-controlled ISN-01 machine into the primary application host while keeping the existing public providers available as rollback paths until each platform is proven.

## Architecture

Internet -> Cloudflare Tunnel -> loopback-only IZAKHONO EDGE origin on 127.0.0.1:8780 -> IZAKHONO RUNTIME -> active platform process.

FORTRESS remains a private defensive control plane. EDGE keeps rate limits, request-size limits and payment-route guards in front of RUNTIME.

The tunnel is an ingress transport only. Application compute, runtime state, code, queues, auth, analytics, backups and deployment execution remain on the owner host.

## One-click Windows bootstrap

Run START-IZAKHONO-OWNER-HOST.cmd as Administrator on the owner machine.

The launcher enables WSL/Ubuntu when required, enables systemd inside WSL, installs the Linux prerequisites, pulls the current main branch, installs the thirteen-service owned stack in tunnel-origin mode, deploys FORTRESS, creates/validates the encrypted backup set, migrates the bootstrap source into IZAKHONO CODE and runs the first-host proof.

## Public ingress

A production Cloudflare Tunnel needs one remotely-managed tunnel token. Store only the token text in:

/etc/izakhono/cloudflare-tunnel.token

Then run:

sudo bash owner-host/install-cloudflare-tunnel.sh

In the Cloudflare Tunnel dashboard, point every platform hostname to:

http://127.0.0.1:8780

Do not point the public Internet directly at RUNTIME, FORTRESS, DATA, AUTH or the other private node ports.

## Cutover policy

Deploy and health-check a platform on the owner host first. Keep its current public deployment live. Move its hostname only after the owner-host route, application readiness, payment callbacks and rollback path have been proved. KORA's production-readiness gates remain authoritative; moving compute does not bypass them.
