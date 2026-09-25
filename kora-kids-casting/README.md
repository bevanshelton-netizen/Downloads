# KORA KIDS Casting & Recording Desk

This private workflow closes the gap between auditioning Lebo and delivering the final Episode 1 voice master.

## Audition intake
An audition submission contains six sides (A–F), a performer display name and consent/readiness flags. Media is copied into the private IZAKHONO workspace under `casting/lebo`. The studio API exposes safe technical metadata only—never private audio paths.

## Review and selection
The private Casting Desk scores:
- natural performance;
- diction;
- emotional range;
- comic timing;
- South African rhythm;
- child-friendly energy;
- technical quality;
- rights readiness.

Selection is explicit. The system does not auto-cast a performer.

## Full Episode 1 recording
After selection, a recording session contains all **17 Lebo dialogue lines** from Episode 1 with fixed line IDs and target timing. Each line must have one individually approved take and matching SHA-256.

The assembler creates a **420-second, 48 kHz / 24-bit / mono WAV** voice master aligned to the episode timeline.

The assembled master is still not automatically final. It enters the existing private Audio Desk for Performance, Technical, Rights and Final approval before Final Creative Lock can use it.
