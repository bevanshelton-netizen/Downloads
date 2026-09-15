# IZAKHONO GROWTH OS

**One command centre. Every growth channel.**

Growth OS is IZAKHONO's owned marketing operating system. It is designed to go beyond paid-ad account management by combining:

- paid media across Google, Meta, TikTok, LinkedIn, Amazon and Microsoft;
- organic social planning and publishing adapters;
- multilingual campaign localization;
- creative production workflows;
- landing pages and UTM governance;
- lead pipeline visibility;
- cross-channel attribution;
- compliance preflight;
- budget planning and approval controls.

## Safety model

1. Read before write.
2. New campaigns are drafts / paused by default.
3. Budget changes require explicit approval.
4. Account credentials never belong in source control.
5. Platform OAuth and API adapters are added behind server-side secrets.
6. Demo/sandbox data is always labelled.

## Connector roadmap

Each provider implements the same internal adapter contract:

- list accounts
- read campaigns and metrics
- create paused campaign
- update paused campaign
- propose budget change
- activate only after explicit approval
- log every mutation
- revoke connection

## Current launch state

The V1 UI and planner work without ad credentials. Provider cards remain disconnected until OAuth/app credentials are configured.
