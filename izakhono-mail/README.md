# IZAKHONO MAIL

Sovereign-first mail workspace inspired by Outlook workflow, with provider adapters.

Current build: responsive UI shell + Supabase mail schema + Microsoft Graph integration contract.

Production Microsoft connection requires an Entra/Azure app registration, OAuth redirect URI, and server-side secrets. Custom-domain mailbox creation additionally requires a mail-hosting layer and DNS MX/SPF/DKIM/DMARC configuration.

Do not place passwords, client secrets, or refresh tokens in frontend code.