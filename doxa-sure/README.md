# DOXA-SURE

**Public promise:** Protect What Matters Most.  
**Operating rule:** Membership instant. Insurance delayed. Rescue audited.

DOXA-SURE is a South African early-warning, rescue-readiness and case-organisation platform. The public experience is live while regulated insurance, legal and debt-counselling activities remain outside the pilot unless handled by appropriately authorised professionals.

## Live public experience

- Premium black / purple / silver public site
- Free Asset Risk Check with Green / Amber / Red / Critical urgency bands
- Human-style voice Help Desk avatar
- Microphone input and spoken replies in supported browsers
- Guarded DOXA-SURE guidance for high-risk and regulated topics
- Optional device-local Enhanced AI using WebLLM on compatible WebGPU browsers
- Secure email-first service-request intake
- No personal phone number or WhatsApp dependency
- R199 once-off Rescue Readiness Pack founding offer
- R99/month Shield founding offer
- Pilot Terms, Privacy & POPIA Notice, and Refund & Cancellation Policy

Public route:

`https://bevanshelton-netizen.github.io/Downloads/doxa-sure/site/`

## Live backend

DOXA-SURE uses isolated `doxa_*` objects inside the shared **IZAKHONO WebStart** Supabase project.

Current live backend includes:

- `doxa_profiles`
- `doxa_memberships`
- `doxa_assets`
- `doxa_documents`
- `doxa_rescue_cases`
- `doxa_rescue_actions`
- `doxa_action_logs`
- `doxa_consents`
- `doxa_admins`
- `doxa_pilot_leads`
- private `doxa-vault-docs` storage bucket

The browser uses a publishable Supabase key only. Row Level Security is the security boundary. Internal SECURITY DEFINER helpers are not executable by public/anon users; only the intended customer RPCs are exposed.

## Secure public intake

The public form submits through `doxa_submit_pilot_lead`.

Controls include:

- explicit consent
- email validation
- honeypot spam control
- per-email rate limiting
- bounded free-text input
- no public read access to lead records
- risk-band context from the Free Asset Risk Check
- IZAKHONO APP FABRIC owned-first intake routing with configured resilience fallback

The public form does not request banking passwords, PINs, full ID numbers or online-banking credentials.

## Shield dashboard

The authenticated dashboard provides:

- Shield Score
- asset tracking
- employment / income resilience profile
- private document metadata and vault uploads
- SAVE MY ASSET Rescue Cases
- dated action plans
- customer action completion
- consent records
- audit history

Magic-link authentication is handled by Supabase Auth.

## AI architecture

Core risk and regulatory questions use deterministic DOXA-SURE guarded guidance so urgent or regulated matters are not delegated blindly to a small model.

Visitors may optionally enable Enhanced AI. The optional Quick model downloads to the user's device through WebLLM/Hugging Face distribution infrastructure and then performs inference on-device. This is deliberately optional because the first model load can use substantial data.

The owned IZAKHONO sovereign AI route remains the long-term primary server-side architecture; external/model-distribution components remain replaceable.

## Payment boundary

Online checkout is **not represented as live for DOXA-SURE** until a merchant route is specifically approved for this website and verified end to end.

The codebase already contains:

- IZAKHONO PAY intent adapter
- signature-verified payment callback
- replay protection
- entitlement storage
- payment health gating

The existing PayFast account 12848922 is currently nominated to **FAISReady** as its single website under PayFast's one-website-per-account instruction. DOXA-SURE therefore needs a separately approved merchant route or an explicit provider-approved change before PayFast checkout can be activated here.

## Regulatory boundary

DOXA-SURE's founding pilot is not:

- an insurance policy or insurer
- legal representation
- formal debt counselling / debt review
- financial-product advice
- a debt-cancellation service
- a guarantee that a lender will stop enforcement
- a guarantee that an asset can be saved

Summons, court papers, repossession notices and sale-in-execution matters may carry running deadlines and should be escalated to suitably qualified professionals urgently.

## Infrastructure

Primary architecture remains IZAKHONO-owned and independently deployable:

`CODE → RUNTIME → EDGE/TLS → DNS`

GitHub Pages is the current external resilience/public route. DOXA-SURE also has its own Dockerfile, owner service, IZAKHONO deployment descriptor and Central Alpha workflow so it does not depend on another product's engine.

## Launch definition

The build is considered technically launch-ready when:

1. public risk check is reachable;
2. Help Desk works without a personal phone number;
3. secure lead intake writes behind RLS;
4. private vault remains non-public;
5. CI safety gates pass;
6. an external resilience deployment is verified;
7. regulated/payment functions remain truthfully gated until their external approvals exist.

Commercial validation target: 25 completed risk checks and at least 10 genuine Rescue Readiness Pack purchases after verified checkout activation.
