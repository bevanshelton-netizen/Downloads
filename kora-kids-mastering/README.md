# KORA KIDS Mastering Lane

This is the private IZAKHONO finishing lane for **Lebo & Jabu** after an episode has an approved picture/animatic and reviewed voice/music assets.

It does not synthesize a "final" voice. It expects reviewed media supplied by production.

## Required inputs
- approved KORA KIDS studio job manifest;
- picture/animatic MP4;
- reviewed voice WAV;
- reviewed original music WAV;
- mastering approval manifest;
- optional locked WebVTT captions.

## Safety and rights boundary
The worker refuses to create a master candidate unless the approval manifest records:
- voice approval and voice rights clearance;
- music approval, originality confirmation and rights clearance;
- fact lock;
- cultural-context approval;
- caption lock;
- visual QC.

Even after those pass, the worker sets `broadcastMaster: false`. A separate explicit **release approval** is required before public distribution.

## Technical QC
The lane creates a mixed H.264/AAC master candidate, targets approximately -16 LUFS integrated loudness and <= -1 dBTP true peak, checks duration/codec integrity, and writes `mastering-result.json` with SHA-256 checksums.

This keeps creative approval, cultural review, rights clearance, technical mastering and release authorization as separate gates.
