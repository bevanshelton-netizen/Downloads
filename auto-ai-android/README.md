# AUTO AI Android

Native Android launch edition of AUTO AI.

## Package
`za.co.autoai.app`

## Play target
- compileSdk: 36
- targetSdk: 36
- minSdk: 26
- Java: 17
- Android Gradle Plugin: 8.13.2
- Gradle: 8.13

## Native features
- vehicle symptom and warning-light triage;
- diagnostic trouble-code explanation;
- repair-quote second opinion;
- used-car risk screening;
- safety-first network-failure fallback;
- HTTPS-only networking;
- no location, contacts, microphone, advertising-ID or camera permissions in v1.

## Backend
The build reads `AUTO_AI_API_BASE`.

Temporary default:
`https://auto-ai-eosin.vercel.app/`

Production target after owned-host cutover:
`https://autoai.izakhonoafrica.co.za/`

GitHub Actions can set the repository variable `AUTO_AI_API_BASE` to the production endpoint without changing source code.

## Play signing
Never commit an upload keystore.

The CI workflow supports these encrypted GitHub secrets:
- `AUTO_AI_KEYSTORE_B64`
- `AUTO_AI_KEYSTORE_PASSWORD`
- `AUTO_AI_KEY_ALIAS`
- `AUTO_AI_KEY_PASSWORD`

When signing secrets are absent, CI builds an unsigned release AAB for validation. A signed AAB is required for Play submission.

## Billing boundary
The initial Play build has no external-payment button and no in-app purchase flow. This keeps v1 separate from the website's current payment path while Play-compliant billing is implemented.

## Safety
AUTO AI is vehicle decision support, not a roadworthy certificate or confirmed mechanical diagnosis. Safety-critical symptoms always instruct the driver to stop safely and seek qualified assistance.
