# IZAKHONO MODEL WORKER NODE

Sidecar that attaches an OpenAI-compatible model engine to **IZAKHONO GPU COMPUTE**.

It works with replaceable engines such as Ollama, vLLM, llama.cpp server, or another compatible local inference service.

## Path

```
IZAKHONO ONE AI
 -> AI GATEWAY
 -> GPU COMPUTE
 -> MODEL WORKER
 -> local model engine
```

The worker reports GPU VRAM/utilisation when `nvidia-smi` is available and can permit CPU fallback for smaller models.

It stores no prompts or responses. The only persistent control-plane usage data remains aggregate accounting in the upstream services.

## Example model mapping

```
IZAKHONO_MODEL_WORKER_MODELS=[{"alias":"izakhono-small","upstreamModel":"local-model-name"}]
```

Installing the worker does not install a model or create physical GPU capacity. A real model engine and model weights must be present before `ready=true`.
