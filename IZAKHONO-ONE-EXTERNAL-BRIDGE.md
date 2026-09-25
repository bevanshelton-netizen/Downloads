# IZAKHONO ONE — External Bridge

## Current status — 25 September 2026

**EXTERNAL PUBLIC PILOT: ACTIVE / INDEPENDENTLY VERIFIED**

The external public-pilot route is the active front door while the owned NODE 01 route remains separately gated. The latest independent `IZAKHONO ONE Public Resilience Verify` check passed the HTTPS, PWA, zero-tracking, Supabase hub, ONE Control and Device AI contracts.

This does **not** mark the full owned ONE AI route `VERIFIED LIVE`. The owned route still requires physical NODE 01 activation, SMTP/recovery proof, parent DNS restoration for `izakhonoafrica.co.za`, trusted TLS and independent owned-route HTTPS verification. GitHub issue #405 tracks that owned-route blocker.

Stable public entry:

https://bevanshelton-netizen.github.io/Downloads/one/

Canonical resilience entry:

https://bevanshelton-netizen.github.io/Downloads/izakhono-one/

Temporary public bridge:

https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-one-hub

Purpose:
- keep IZAKHONO ONE publicly reachable while the owned NODE 01 route completes activation;
- expose only public tools that are genuinely usable;
- preserve the owned-first architecture and reversible cutover;
- provide a device-local ONE AI beta on compatible WebGPU browsers without sending prompts through IZAKHONO application servers;
- keep the full owned/server ONE AI route gated until NODE 01 passes its verified runtime, SMTP/recovery and public HTTPS gates.

Privacy contract:
- no IZAKHONO application analytics;
- no UTM or campaign attribution;
- no referral identifiers;
- no behavioural profiling;
- no advertising IDs;
- no false claim that infrastructure/security logs maintained by hosting providers do not exist.

ONE Control Center: https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-one-control

ONE AI public device-local route: https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-one-device-ai

Current public AI runtime:
- WebLLM 0.2.85, pinned in the browser import;
- Quick: SmolLM2 360M;
- Balanced: SmolLM2 1.7B;
- Strong: Llama 3.2 3B;
- device-local prompt generation after model load;
- local text-file context option;
- General, Business, Writing, Study and Coding modes;
- chat copy/export/reset controls;
- no referral or campaign attribution.

The Control Center is the external workspace front door. It uses the existing ONE capability-key model, masks the key by default, supports explicit reveal/copy/recovery-file export, and does not enable the unfinished Supabase Auth identity surface.

The external ONE AI route now offers three browser-local model tiers. It remains a device-local public beta and is not equivalent to the full owned ONE AI server runtime. The external bridge is a public ecosystem hub, not the final owned AI authority. NODE 01 remains the intended authority.
