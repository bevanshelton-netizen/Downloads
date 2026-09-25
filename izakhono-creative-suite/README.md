# IZAKHONO Creative Suite v1

Independent, privacy-first design workspace for IZAKHONO AFRICA (PTY) LTD.

## Status

**BUILT / VERIFIED LOCALLY** is the intended status after browser verification. This branch does not claim a public deployment.

The package is intentionally isolated under `izakhono-creative-suite/` so it cannot alter other portfolio products.

## What v1 includes

- Responsive browser design workspace
- Original editable templates for social, flyer, merch and presentations
- Text layers with size, colour, weight and alignment controls
- User image upload
- Drag positioning and basic layer inspector
- Duplicate and delete layer actions
- Undo / redo history
- Browser-local project save
- PNG export
- Brand kit controls
- Offline-capable PWA shell
- Local natural-language command layer for safe deterministic commands
- No telemetry, ad IDs, behavioural profiling or silent uploads

## AI boundary

The Creator panel is deliberately honest: v1 supports deterministic local commands only. It does not claim generative AI or silently call a third-party model.

The next AI milestone should connect an IZAKHONO-owned creative agent adapter that can return a structured scene graph. Model providers remain replaceable adapters; generated output must remain editable.

Target scene response shape:

```json
{
  "canvas": {"width": 1080, "height": 1080, "background": "#111111"},
  "objects": [
    {"type": "text", "text": "Campaign headline", "x": 80, "y": 120, "width": 900}
  ]
}
```

## Infrastructure inheritance

Primary target:

`ISN-01 / NODE01 → CODE / Forge → Runtime → FORTRESS → EDGE/TLS → IZAKHONO DNS`

External hosting may be used as a reversible public bridge. Do not remove a verified fallback until the owned route independently passes HTTPS, health, backup/restore, rollback and security gates.

Current public route: **NOT YET PUBLIC**  
External fallback route: **not assigned in this branch**  
Data dependency: browser localStorage only  
Authentication dependency: none in v1  
Payment dependency: none in v1

## Commercial direction

Core suite target: **US$5/month**, with a useful included AI allowance and optional AI top-ups rather than promising unlimited high-cost generation.

A separate gamer/creator power tier can remain **US$15/month** when the 3D, game-asset, animation and higher-compute toolset is ready.

No checkout is enabled in this branch.

## Run locally

Serve this directory with any static HTTP server and open `index.html`.

For example:

```bash
python -m http.server 8080 -d izakhono-creative-suite
```

Then open `http://localhost:8080`.

## Next build gates

1. Browser QA on desktop and mobile.
2. Add resize/rotate handles and proper object ordering.
3. Add SVG/vector drawing and path editing.
4. Add video timeline and audio tracks.
5. Connect the IZAKHONO-owned creative agent scene-graph API.
6. Add team projects, version history, brand memory and approvals.
7. Add publishing/scheduling adapters.
8. Package for NODE01 and establish a reversible external resilience route.
9. Verify public HTTPS before using any live-status label.
