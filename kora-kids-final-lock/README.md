# KORA KIDS Final Creative Lock

This is the bridge between the real creative session and the mastering lane.

It scans the private IZAKHONO KORA KIDS audio workspace and refuses to lock Episode 1 unless it finds exactly:
- one fully approved **Lebo** voice asset;
- one fully approved original music master;
- one fully approved Jabu cue for each of: hello, question, proud, happy, sneeze and goodbye.

Every selected asset must:
- be `approvedForMastering: true`;
- have every audio review gate approved;
- still exist at its private path;
- match its stored SHA-256 exactly;
- satisfy its voice/music/SFX consent and rights requirements.

The result is `creative-lock.json` plus `mastering-inputs.json`.

**Creative lock is not release approval.** It only proves which exact approved files mastering must use.
