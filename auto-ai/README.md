# AUTO AI by IZAKHONO

## PUBLIC BETA — LIVE

AUTO AI is published as a public browser beta at:

https://bevanshelton-netizen.github.io/Downloads/auto-ai/

Current public-beta capabilities:
- symptom safety triage;
- fault-code explanation;
- repair-quotation review;
- used-car buyer risk screening;
- mobile-first PWA shell.

Public beta does **not** yet represent final Google Play production readiness, physical OBD connectivity, or a confirmed mechanical diagnosis.

---

**Understand your car before you spend.**

AUTO AI is an AI-first vehicle decision-support MVP for motorists outside motor/service plans, owners seeking a second layer of understanding before repairs, and used-car buyers.

## MVP
- Symptom triage with safety-first escalation.
- Fault-code explanation.
- Repair-quotation clarity review.
- Used-car buyer risk screen.
- Installable PWA shell.
- Provider-neutral AI gateway hook.
- Local safety fallback if no AI gateway is configured.
- /api/health for IZAKHONO node verification.

## Local run
Node 20+:
    cd auto-ai
    PORT=18120 node server.mjs

Open http://127.0.0.1:18120

## Optional AI gateway
AUTO AI works without an LLM. To enable conversational reasoning, configure an approved OpenAI-compatible chat endpoint with:
- AI_CHAT_URL
- AI_API_KEY
- AI_MODEL

Secrets stay outside source control.

## Deployment target
First runtime: IZAKHONO ISN-01, loopback/private beta. Public DNS, customer traffic and live payments remain unchanged until an explicit launch gate passes.

## Google Play path
The PWA is the mobile beta shell. After validation: final privacy/data-safety declarations; production adaptive PNG icons/screenshots; Android Trusted Web Activity or native shell; Play Billing for digital subscriptions where required; closed testing; production review.

## Safety principle
AUTO AI distinguishes possible cause, probable area and confirmed fault. It must never tell consumers to bypass safety systems or replace costly components solely because one trouble code appeared.
