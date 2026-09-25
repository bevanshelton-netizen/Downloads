# IZAKHONO Command Library

**Operator:** IZAKHONO AFRICA (PTY) LTD  
**Status:** BUILT / VERIFIED LOCALLY only after `npm run verify` passes. Do not call it public until IZAKHONO EDGE/TLS/DNS or an approved external fallback has been independently verified.

The Command Library turns short slash commands into structured, model-agnostic instructions that any IZAKHONO platform can send to its approved AI adapter.

## Why this is a platform capability

A blank AI box forces every user to become a prompt engineer. This service gives every platform a common vocabulary:

- reasoning: `/devilsadvocate`, `/contrarian`, `/assumptions`, `/risks`, `/factcheck`, `/verify`, `/logic`, `/alternative`
- execution: `/rootcause`, `/debug`, `/solution`, `/launch`
- business: `/cashflow`, `/funding`, `/marketing`, `/sales`, `/pricing`
- regulated work: `/compliance`, `/contractreview`, `/sars`, `/payroll`
- portfolio: `/ecd`, `/admissions`, `/fraudcheck`, `/security`, `/website`

Aliases are supported, commands may be chained, and unknown commands return suggestions.

Example:

```text
/assumptions /risks /solution Launch ECD360 to the first five pilot centres.
```

## API

```text
GET  /healthz
GET  /v1/commands
GET  /v1/commands/:name
POST /v1/expand
```

Example request:

```json
{
  "input": "/risks /solution Launch this product",
  "platform": "FAISReady",
  "language": "English",
  "context": "Optional caller-supplied context"
}
```

The response includes a single structured `instruction` plus command metadata and guardrails.

## Privacy and security

- No behavioural tracking.
- No prompt logging by default.
- No external analytics.
- No secrets are required by this service.
- Cross-origin browser access is denied by default.
- To allow approved platform origins, set `IZAKHONO_COMMAND_ALLOWED_ORIGINS` to a comma-separated allowlist.
- The engine **does not execute external actions**. A platform must use its normal authenticated/approved action path.
- High-consequence commands explicitly require current verification/human approval where relevant.
- The service is model-agnostic; external LLMs remain replaceable adapters.

## Run

```bash
npm run verify
npm start
```

Then open `http://127.0.0.1:8788/`.

## Owned deployment

This package carries its own `.izakhono.json`, Dockerfile and `/healthz` endpoint. It is intended to run as its own independently deployable engine on the portfolio path:

`ISN-01 / NODE01 → CODE / Forge → Runtime → FORTRESS → EDGE/TLS → IZAKHONO DNS`

Preserve any last verified external route until the owned public route passes the portfolio cutover gates.
