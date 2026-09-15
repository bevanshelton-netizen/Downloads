# IZAKHONO AI GATEWAY NODE

Owned AI routing and governance plane for IZAKHONO platforms.

## V1 capabilities

- OpenAI-compatible `POST /v1/chat/completions` endpoint;
- model aliases decoupled from provider/model names;
- multiple routes per alias;
- ordered failover;
- provider circuit breaking;
- local-first providers;
- optional external providers;
- outbound provider host allowlist;
- AES-256-GCM encrypted provider API keys;
- hashed client keys;
- per-client model allowlists;
- daily request/token quotas;
- usage accounting;
- request audit ledger;
- no prompt/response body persistence;
- HMAC prompt hashes for duplicate/correlation analysis without storing prompt text;
- SQLite WAL;
- zero runtime npm dependencies.

## Local-first path

The gateway itself does not generate model output. For no per-request AI API bill, run a compatible model server on hardware you control and register it as a local provider.

Example provider registration concept:

    {
      "name": "owned-local",
      "baseUrl": "http://127.0.0.1:11434",
      "isLocal": true
    }

The exact local inference engine is replaceable. The gateway only requires a compatible HTTP chat-completions endpoint.

## External providers

External providers are optional. Their host must be explicitly added to `IZAKHONO_AI_PROVIDER_ALLOWLIST`, and non-local providers require HTTPS. Provider keys are encrypted at rest and are never returned by the admin API.

## Privacy

Prompts and generated answers are proxied in memory and are **not stored** in the gateway database.

The ledger stores model alias, selected provider/model, status, latency, token counts and a keyed prompt hash.

## Quotas

Each service/client receives its own API key, allowed model aliases, daily request limit and daily token limit. Client keys are returned once and stored only as SHA-256 hashes.

## Boundaries

Running large models locally still requires suitable CPU/GPU/RAM and electricity. AI GATEWAY NODE removes routing/provider lock-in; it does not make model compute physically free.
