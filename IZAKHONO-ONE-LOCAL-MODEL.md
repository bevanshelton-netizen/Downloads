# IZAKHONO ONE — Local Model Activation

This is the owner-host bridge from the already-built AI control plane to an actual local model engine.

## One-click owner path

On the Windows owner machine:

```
START-IZAKHONO-ONE-AI-LOCAL-MODEL.cmd
```

The launcher targets the existing Ubuntu 24.04 WSL owner host.

## What it does

1. Updates the owner-host source checkout to canonical `main`.
2. Pulls an Ollama-compatible container image.
3. Binds the model engine to **127.0.0.1 only**.
4. Pulls the configured bootstrap model (default: `qwen2.5:3b`).
5. Maps it as the internal `izakhono-small` model.
6. Restarts IZAKHONO MODEL WORKER.
7. Verifies registration in IZAKHONO GPU COMPUTE.
8. Runs an actual inference proof through the AI Gateway.
9. Sets `IZAKHONO_ONE_CHAT_READY=true` only if the proof succeeds.
10. Deploys IZAKHONO ONE to the owned runtime.
11. Writes a secret-free receipt to `/var/lib/izakhono-deploy/izakhono-one-local-model.json`.

## GPU vs CPU

If NVIDIA GPU support is available to Docker, the launcher uses it. Otherwise the small bootstrap model may run on CPU. CPU mode is for getting the owned route functional; it is not a claim of production-scale performance.

## External dependency boundary

The model image and model weights are downloaded from an external registry once. After they are local, ONE AI does not require a per-request external AI API for this route.

## Safety

- no privileged container;
- engine is loopback-only;
- no direct public model endpoint;
- model access remains behind AI Gateway → GPU Compute → Model Worker;
- chat does not flip ready until the inference proof succeeds;
- public signup is separately gated by verified email delivery.
