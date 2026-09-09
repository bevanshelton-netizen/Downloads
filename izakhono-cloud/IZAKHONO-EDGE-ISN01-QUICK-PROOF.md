# IZAKHONO EDGE — ISN-01 Temporary HTTPS Proof

## Purpose

This layer proves that the owner-controlled ISN-01 KORA runtime can serve a public HTTPS request without using Vercel compute.

It is **not** the final IZAKHONO EDGE network. The temporary proof uses Cloudflare Quick Tunnel only as an external transport test because ISN-01 may be behind NAT and may not yet have a directly routable public address.

## Preconditions

The proof refuses to run unless all of the following already exist:

- `/var/lib/izakhono-cloud/SOVEREIGN-NODE.json`
- verified KORA workload proof on ISN-01
- `/var/lib/izakhono-cloud/runtime/kora-network.json`
- KORA persistent loopback runtime healthy at `127.0.0.1:18080`
- explicit one-time `/etc/izakhono-cloud/ALLOW_EDGE_QUICK_PROOF` marker

## Windows action

The repository provides:

- `START-ISN-01-EDGE-PROOF.cmd`
- `izakhono-cloud/PROVE-ISN-01-EDGE-WINDOWS.ps1`

The Windows action:

1. confirms the ISN-01 identity and persistent runtime files exist;
2. confirms KORA is healthy on `http://127.0.0.1:18080/api/health`;
3. installs `cloudflared` from Cloudflare's signed Ubuntu APT repository if it is not already installed;
4. checks out the pinned reviewed IZAKHONO edge-proof code;
5. creates the one-time edge-proof activation marker;
6. starts a temporary Quick Tunnel to the loopback KORA runtime;
7. captures the random `trycloudflare.com` HTTPS URL;
8. makes a real HTTPS request through that public route to KORA's health endpoint;
9. records `kora-quick-proof.json`;
10. terminates the temporary tunnel;
11. removes the activation marker;
12. copies the proof receipt to `C:\ProgramData\IZAKHONO\ISN-01\EDGE-QUICK-PROOF.json`.

## Truth boundary

A passing receipt means:

- owner-controlled compute path: proven by prior ISN-01 receipts;
- persistent KORA runtime: proven locally;
- public HTTPS round trip: proven through a temporary external transport;
- Vercel compute: not required for this proof.

It does **not** mean:

- stable public hostname;
- owner-controlled global edge transport;
- public production readiness;
- commercial readiness;
- permission to switch DNS away from the existing live route.

The proof receipt therefore fixes:

- `external_transport_owner_controlled=false`
- `stable_hostname=false`
- `production_eligible=false`
- `public_ready=false`
- `commercial_ready=false`

## Next after this proof

The production cutover remains separate:

1. assign a stable approved KORA hostname;
2. choose either direct owner-controlled Caddy ingress on a genuinely public ISN node, or a stable bootstrap tunnel while the sovereign relay network is being built;
3. independently verify the stable HTTPS hostname from outside the owner node;
4. retain rollback to the existing provider route;
5. only then consider DNS cutover away from Vercel.
