# DOXA-SURE WhatsApp Business Assistant

This package is the automation engine for DOXA-SURE enquiries routed to **066 298 2213**. It is designed for the Meta WhatsApp Business Platform / Cloud API and deliberately starts in a zero-AI-token rules mode so the pilot can validate demand before paying for an LLM.

## What it does

- Verifies the Meta webhook challenge.
- Validates `X-Hub-Signature-256` on incoming webhook POSTs.
- Parses incoming WhatsApp text messages.
- Automatically handles:
  - home / bond pressure;
  - vehicle finance / repossession risk;
  - income loss or reduction;
  - Section 129, summons, court papers, repossession and auction keywords;
  - DOXA-SURE Free Asset Risk Check results;
  - R199 Rescue Readiness Pack enquiries;
  - R99/month Shield enquiries;
  - human-review requests.
- Refuses passwords, PINs, OTPs, online-banking logins and ID numbers.
- Uses urgent safety wording where legal/enforcement documents may already exist.
- Never represents DOXA-SURE as an insurer, attorney, debt counsellor or financial adviser.

## Zero-cost-first operating mode

The current assistant is deterministic. That is intentional: it can answer the core pilot questions automatically without paying an AI provider for every message. Once the business produces revenue, a language-model adapter can be added behind the same safety rules.

## Required activation values

The code contains **no live credentials**. To switch the assistant on, a Meta WhatsApp Business Platform app must supply these secret environment variables:

- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `META_APP_SECRET`
- `META_GRAPH_VERSION`

Use the Graph API version displayed in the Meta developer dashboard rather than hard-coding an old version.

## Deployment target

The folder is self-contained and can be deployed as its own small Vercel project with this folder as the project root. The public Meta callback URL becomes:

`https://<assistant-host>/webhook`

Do **not** deploy it inside the existing KORA project merely to avoid creating a separate service. DOXA-SURE customer messaging should stay isolated.

## Meta activation checklist

1. Create or use the correct Meta Business / Developer app for DOXA-SURE.
2. Add the WhatsApp Business Platform product.
3. Connect the business number intended for the assistant and obtain the phone-number ID.
4. Put the five required values into the hosting provider's secret environment variables.
5. Set the webhook callback URL to `/webhook` and use the same `WHATSAPP_VERIFY_TOKEN` as the verify token.
6. Subscribe the app to WhatsApp message webhook events.
7. Send `hello` from a test phone. The assistant should return the numbered DOXA-SURE menu.
8. Test `Section 129`, `summons`, `PACK`, `SHIELD`, and a website risk-result message before public activation.

## Important business-number note

Do not migrate or disconnect the existing WhatsApp Business number blindly. Confirm the onboarding path shown by Meta for the account/number being used before changing how 066 298 2213 is registered. The code is ready independently of that account-level activation step.

## Test locally

```bash
npm test
npm run check
```

## What remains intentionally manual

The assistant cannot activate itself inside Meta because that requires the account owner's Meta Business permissions and secret credentials. Those values must never be committed to GitHub or pasted into the public website.

Once the webhook is connected, the bot can automatically handle first-response triage. Critical or regulated matters must still be escalated to appropriately qualified people.
