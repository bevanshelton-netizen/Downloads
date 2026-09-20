# KORA KIDS Animation Factory

Owner-side production studio for **Tumi & Tala**.

## Boundary

The studio binds to `127.0.0.1` by default and is not a public child-facing product. Public KORA Kids receives only approved outputs.

## Production flow

1. Select a Season 1 episode.
2. Choose reviewed language edition.
3. Build a production job from the reusable episode template.
4. Preview the original vector rigs and scene plan.
5. Queue the job to **IZAKHONO Local Render**.
6. Complete script, language, child-safety, brand and final review gates.
7. Publish only approved outputs to KORA Kids.
8. External burst render remains disabled until an operator explicitly configures a provider.

## What this version does

- reads the live Season 1 and language manifests;
- provides reusable vector rigs for Tumi, Tala, Piko and Busi Bus;
- creates persistent production job manifests;
- tracks review gates;
- prepares output specifications for 16:9 episodes, 9:16 shorts, thumbnails and captions;
- keeps external compute non-authoritative and disabled by default.

It does **not** yet synthesize final animated video frames or voices. Those render workers plug into the bounded job manifests produced here.
