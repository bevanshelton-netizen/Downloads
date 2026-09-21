# KORA KIDS Render Worker

Owned render worker for approved **Lebo & Jabu** production manifests.

## What it does

- refuses draft/unapproved jobs;
- refuses jobs not bound to **IZAKHONO Local Render**;
- requires script, language, cultural-context, child-safety, brand and final review gates;
- converts a timed scene manifest into an actual H.264 MP4 animatic;
- generates an audio guide, WebVTT captions and language-scoped voice cues;
- produces SHA-256 checksums and a machine-readable render result;
- supports a fast CI proof mode and a full-duration production mode.

The current visual renderer is a deterministic animatic renderer. It proves the owned production pipeline and timing. It is **not yet the final broadcast animation renderer**.

The guide voice uses local `espeak-ng` when available and is explicitly marked non-final. Final voice masters must come from reviewed/approved voice production.

## Requirements

- Node.js 20+
- FFmpeg
- optional: espeak-ng for local guide narration

## Proof render

```bash
node worker.mjs --input fixtures/lebo-jabu-approved-job.json --output .render-proof --mode proof
```

## Production-duration render

Pass an approved job manifest exported by the KORA KIDS Animation Factory:

```bash
node worker.mjs --input /path/to/approved-job.json --output /path/to/output --mode production
```

Production mode uses 1920x1080 at 24fps and preserves the manifest's full scene duration. It still outputs a **guide animatic**, not a final broadcast master.

## Outputs

- `episode-silent.mp4`
- `guide.wav`
- `episode-guide.mp4`
- `captions.vtt`
- `voice-cues.json`
- `render-result.json`

The next renderer can replace the deterministic animatic frame generator without changing the approved job contract or review boundary.
