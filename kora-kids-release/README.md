# KORA KIDS Release Factory

This is the final **packaging** layer for a release-approved Lebo & Jabu master.

It does **not** upload or publish anything by itself.

## Hard gate
The factory refuses to package a release unless:
- the mastering result says `masterCandidate: true` and technical QC passed;
- the exact master MP4 SHA-256 matches the release approval;
- voice, music, visuals and captions rights are cleared;
- fact, cultural, language and brand locks are approved;
- the release is explicitly approved by a named reviewer with a timestamp;
- the title is marked made-for-kids;
- personalised advertising, behavioural tracking, child-directed commerce and external links in child creative are disabled.

## Outputs
A successful package contains:
- approved episode master;
- primary captions;
- KORA KIDS release metadata;
- YouTube-ready metadata;
- Shorts metadata;
- any separately approved language audio/caption packages;
- checksums and `release-package.json`.

The result records `published: false`. Distribution is a separate adapter/action so packaging cannot accidentally make a child-directed title public.

## Multi-language
Only `kora-kids.release-language/v1` manifests with `approvedForRelease: true` are copied into the release bundle. Machine-draft localisation files are never accepted as release tracks.
