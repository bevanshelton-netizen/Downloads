# KORA KIDS Animation Factory

Owner-side production studio for the **KORA KIDS original-series slate**, with **Lebo & Jabu** as the flagship and **Tumi & Tala** retained as the next original.

## Boundary

The studio binds to `127.0.0.1` by default and is not a public child-facing product. Public KORA Kids receives only approved outputs.

## Production flow

1. Select a KORA KIDS series and episode.
2. Choose a reviewed language edition.
3. Build a production job from that series' reusable episode template.
4. Preview the original vector rigs and scene plan.
5. Queue the job to **IZAKHONO Local Render**.
6. Complete the required human review gates.
7. For Lebo & Jabu, complete the additional **cultural-context** review.
8. Publish only approved outputs to KORA Kids.
9. External burst rendering remains disabled until an operator explicitly configures and approves a provider.

## Current series support

### Lebo & Jabu
- flagship KORA KIDS original;
- 10-episode Africa-focused Season 1 catalogue;
- layered original Lebo and Jabu SVG rigs;
- episode template built around comedy, discovery, cooperation and **Jabu's Africa Fact**;
- script, language, cultural-context, child-safety, brand and final review gates;
- 16:9 episode, 9:16 Short, thumbnail, captions and language-scoped audio-master outputs.

### Tumi & Tala
- retained as a separate preschool musical original;
- existing 10-episode catalogue and original Tumi, Tala, Piko and Busi Bus rigs remain supported.

## Render policy

**IZAKHONO Local Render** remains the authoritative production target. External burst compute is non-authoritative and disabled by default.

## Current limitation

This factory creates production manifests, reusable rigs, scene plans and review state. It does **not yet render final broadcast-quality animated frames or final voice masters**. Render and voice workers are the next bounded production layer and must consume approved manifests rather than bypassing review.
