# IZAKHONO GPU COMPUTE NODE

Owned inference-capacity fabric for **IZAKHONO ONE AI**.

It turns one or many GPU machines into one IZAKHONO-owned OpenAI-compatible inference pool.

## Capabilities

- GPU worker registration + heartbeat
- VRAM/free-VRAM/utilisation reporting
- model alias registry
- least-loaded capacity routing
- automatic worker failover
- short circuit breaking after repeated failures
- `GET /v1/models`
- `GET /v1/capacity`
- `POST /v1/chat/completions`
- control-plane ledger stores token estimates + prompt hash, never prompt/response bodies

## Worker engines

Any OpenAI-compatible model server can be attached, including vLLM, llama.cpp server, or another local engine.

## Ownership model

Owned GPUs are primary. Temporarily rented GPU nodes may join the same pool as reversible overflow while IZAKHONO acquires more hardware.

Software pools capacity; it cannot create physical VRAM. Real capacity still depends on GPU hardware, power, cooling and memory bandwidth.
