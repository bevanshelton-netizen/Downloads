# AUTO AI — Google Play publishing automation

The Android app builds successfully on API 36.

## Permanent upload key

On the owner Windows machine, run:

`PREPARE-AUTO-AI-PLAY-SIGNING.cmd`

It creates an RSA 4096-bit upload key under:

`C:\ProgramData\IZAKHONO\AUTO-AI-PLAY\`

The key is never committed to Git.

If GitHub CLI is installed and authenticated, the script can load the four signing values directly into encrypted repository secrets.

## Google Play service account

The internal-release workflow additionally requires:

`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

This credential must be created/authorized for the Play Console developer account and stored as an encrypted GitHub repository secret.

Do not commit or paste the JSON credential into source files or chat.

## First Play Console release

The Play Console app must exist before automated Android Publisher API uploads can work. The initial signed AAB can be uploaded manually to Internal testing. After the package exists and the service account has the required Play permissions, the workflow:

`.github/workflows/auto-ai-google-play-internal.yml`

can publish future AUTO AI builds to the internal track.

Package:

`za.co.autoai.app`