# KORA KIDS Voice & Music Intake

Private intake layer for real production audio. It keeps performer and music files **out of the public repository** and stores them in the owner workspace under `~/.izakhono/kora-kids-studio/audio-assets`.

## Supported asset types
- `voice` — Lebo or other future speaking-character recordings;
- `music` — original score/theme masters;
- `sfx` — rights-cleared sound effects, including Jabu design elements.

## Intake rules
Voice imports require performer consent plus recording, distribution and localisation rights. If a performer is a minor and guardian consent is required, the import is rejected unless that consent is recorded.

Music imports require an originality confirmation and cleared master/composition/distribution/localisation rights.

SFX imports require explicit rights clearance.

The intake worker validates the audio stream with FFprobe, records codec/sample rate/channels/duration, hashes the source with SHA-256, copies the media into the private IZAKHONO workspace and creates a local manifest.

**Import is not approval.** Every imported asset starts with `approvedForMastering: false` and must still pass performance, technical, rights and final review before the mastering lane uses it.
