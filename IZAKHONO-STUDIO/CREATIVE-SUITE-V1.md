# IZAKHONO CREATIVE SUITE — $5 PRODUCT DEFINITION

**Product:** IZAKHONO CREATIVE SUITE  
**Workspace:** `IZAKHONO-STUDIO`  
**Operator / legal merchant:** IZAKHONO AFRICA (PTY) LTD  
**List price:** USD $5.00 per month  
**Current repository status:** BUILT / VERIFIED LOCALLY only after build checks pass. Do not call public/live without route verification.

## Product decision

IZAKHONO STUDIO becomes the foundation for one original, unified creative suite covering the customer jobs commonly split across design, photo, vector, desktop publishing, video, motion graphics, audio, PDF/document, asset, AI and publishing products.

The product does **not** copy Adobe names, trademarks, icons or interface layouts.

## Commercial model

### Core
- USD $5/month.
- One core subscription unlocks all core creative tools as they ship.
- No separate subscription per core module.
- Browser-first to reduce device and infrastructure requirements.
- Local processing is preferred where practical.

### AI and expensive compute
The $5 subscription must not promise unlimited high-cost inference/rendering.

Commercial rule:
- include a starter AI allowance;
- measure real provider cost before fixing the public credit quantity;
- allow optional top-ups for high-cost image/video/audio generation;
- keep providers interchangeable through an IZAKHONO gateway;
- never expose provider secrets in the browser.

### South African payment route
The current portfolio payment registry is ZAR/iKhokha-first. Therefore:
- $5 is the approved **list price**;
- do not invent a ZAR conversion in source control;
- configure the local checkout amount separately when settlement rules are confirmed;
- do not describe checkout as live until legal pages, product registration, redirect, webhook/reconciliation and end-to-end payment testing pass.

## Tool families

1. **Canvas** — design, social, posters, thumbnails, templates and brand kits.
2. **Photo Lab** — photo adjustments and raster editing.
3. **Campaign Engine** — bulk creative generation, placements and copy.
4. **Vector** — logos, SVG illustration, paths and reusable symbols.
5. **Layout** — multi-page publishing and print.
6. **Cut** — video editing.
7. **Motion** — animation and compositing.
8. **Wave** — audio editing and multitrack.
9. **DocFlow** — PDF and document workflows.
10. **AI Lab** — provider-portable AI creative tools.
11. **Assets** — fonts, media, brand kits and templates.
12. **Publish** — packaging, resizing and authorised distribution.

## V0.3 working scope

- Existing IZAKHONO design editor.
- Existing portfolio-scale campaign engine.
- Existing PNG export and native share/fallback.
- New unified suite launcher.
- New working local-first Photo Lab:
  - upload from device;
  - brightness;
  - contrast;
  - saturation;
  - grayscale;
  - blur;
  - rotate;
  - horizontal/vertical flip;
  - PNG export.
- $5 subscription positioning and payment gating language.

## Why this is designed to be better

- One price and one project universe instead of a separate app subscription for every job.
- Shared assets and brand kits across all tools.
- Local-first browser features where practical.
- One marketing/campaign engine built into the creative product itself.
- Owned-first IZAKHONO infrastructure with reversible external fallback.
- Interchangeable AI providers.
- African and global design/language support as a first-class requirement.
- Lower-compute workflows for small businesses, students, creators and older hardware.

## Authoritative infrastructure inheritance

Follow `IZAKHONO-PLATFORM-INFRASTRUCTURE-DIRECTIVE.md`.

Target:

`ISN-01 / NODE01 → CODE / Forge → Data/Auth/Storage/Queue/Analytics → Runtime → FORTRESS → EDGE/TLS → IZAKHONO DNS`

External routes may remain available as reversible production bridges and failover. Never remove a verified external route until the owned route passes every public gate.

## Next engineering sequence

1. Add shared project schema and save/open.
2. Add reusable brand kits/assets.
3. Add vector/SVG surface.
4. Add non-destructive Photo Lab layers, crop, masks and background removal.
5. Add multi-page Layout/DocFlow.
6. Add video/audio worker pipeline with proxy media.
7. Add AI provider gateway with spend controls and audit logs.
8. Add account/auth/storage.
9. Register the $5 product with IZAKHONO Pay after local settlement mapping is approved.
10. Verify owned deployment; retain external fallback until cutover passes.
