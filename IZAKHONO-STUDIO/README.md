# IZAKHONO CREATIVE SUITE

**Create. Edit. Publish. One suite.**

IZAKHONO CREATIVE SUITE is the unified evolution of IZAKHONO STUDIO: an original browser-first creative platform spanning design, photo, campaign automation and the shared foundation for vector, publishing, video, motion, audio, PDF/document, AI, asset and distribution tools.

## Commercial model

- **USD $5/month** list price for the complete core suite.
- No separate core-app subscriptions.
- Expensive AI generation is controlled through a starter allowance plus optional top-ups so the $5 plan remains sustainable.
- Public checkout is not considered live until the selected gateway, legal pages, reconciliation and end-to-end payment flow are verified.
- The current South African portfolio gateway is ZAR-first, so local settlement mapping must be configured separately rather than hard-coding an invented conversion.

## Working v0.3 features

- Unified Creative Suite launcher.
- Existing responsive design editor.
- Social/campaign size presets: Instagram, Stories/Reels, Facebook, LinkedIn, YouTube and A4.
- Editable text layers with typography, sizing, alignment and colour controls.
- Image upload and drag positioning.
- Template starters for launches, offers, music, education and automotive campaigns.
- Browser-side `Instant Design` starter.
- Brand name, accent colour and background controls.
- Duplicate/delete layer actions.
- PNG export and native mobile sharing with fallback.
- Portfolio-scale Campaign Engine for bulk creative packs, captions and placement manifests.
- **Photo Lab v1** with local browser processing:
  - upload from device;
  - brightness;
  - contrast;
  - saturation;
  - grayscale;
  - blur;
  - rotate;
  - horizontal/vertical flip;
  - PNG export.

## Suite tool families

- **Canvas** — design, social, posters, thumbnails and templates.
- **Photo Lab** — raster/photo editing.
- **Campaign Engine** — portfolio-scale advertising production.
- **Vector** — SVG illustration, logos and paths.
- **Layout** — multi-page publishing and print.
- **Cut** — video editing.
- **Motion** — animation and compositing.
- **Wave** — audio editing and multitrack.
- **DocFlow** — PDF and document workflows.
- **AI Lab** — provider-portable creative AI.
- **Assets** — fonts, media, templates and brand kits.
- **Publish** — packaging, resizing and authorised distribution.

The product does **not** copy Adobe names, trademarks, icons or interface layouts. It targets the same broad creative customer jobs using original IZAKHONO product design and architecture.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Infrastructure policy

The suite inherits `IZAKHONO-PLATFORM-INFRASTRUCTURE-DIRECTIVE.md`.

Primary target:

`ISN-01 / NODE01 → CODE / Forge → Data/Auth/Storage/Queue/Analytics → Runtime → FORTRESS → EDGE/TLS → IZAKHONO DNS`

Verified external routes may remain as reversible bridges and failover. Do not remove a verified external route until the owned route passes every public cutover gate.

## Current status

The v0.3 code has passed the repository CI build. That is **not** a public-live claim. A public status must still be earned through a verified external route or the full IZAKHONO owned-route gates.

## Next build layer

- Save/open projects and shared project schema.
- Reusable brand kits and asset library.
- SVG/vector surface.
- Non-destructive photo layers, crop, masks and background removal.
- Multi-page Layout and DocFlow.
- Video/audio worker pipeline with proxy media.
- AI provider gateway with spend controls.
- Collaboration/comments.
- Authorised social publishing queue and analytics.
- $5 product registration in IZAKHONO Pay after settlement mapping and end-to-end checkout verification.
