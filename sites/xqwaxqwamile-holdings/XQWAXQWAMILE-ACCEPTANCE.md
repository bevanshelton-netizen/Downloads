# !XQWAXQWAMILÉ HOLDINGS — Website & Mail Acceptance

## Verified

- Production website source is in `sites/xqwaxqwamile-holdings/`.
- Contact form is wired to `POST /api/contact`.
- The browser falls back to the branded `mailto:` address if the server endpoint is unavailable.
- `api/contact.js` uses IZAKHONO MAIL first when `IZAKHONO_MAIL_API_URL` and `IZAKHONO_MAIL_API_TOKEN` are configured.
- Resend is retained only as a reversible fallback when `RESEND_API_KEY` is explicitly configured.
- No mail credentials are committed to the repository.

## Current production gate

The currently verified Vercel production deployment is healthy, but it predates the contact API change. A live request to `/api/contact` on the production hostname currently returns `404 NOT_FOUND`.

The updated source commit is:

`0a61a636cf136a45fe2747f78b1ec09c7e04f749`

A direct production deployment attempt was blocked by the Vercel deployment-rate limit. This is an external deployment-capacity gate, not a source-code acceptance failure.

## Mail acceptance status

| Gate | Status |
|---|---|
| Website HTML | VERIFIED |
| Custom-domain HTTPS | VERIFIED |
| Contact form UI | VERIFIED |
| Contact API source | VERIFIED |
| Production `/api/contact` | BLOCKED — deployment pending |
| IZAKHONO MAIL transport | PENDING transport configuration |
| Real outbound delivery | PENDING |
| Reply-path acceptance | PENDING |
| Inbound MX/mailbox acceptance | PENDING |

## Promotion rule

Do not call the contact workflow LIVE until a fresh production deployment exposes `/api/contact`, the configured mail transport accepts a real test message, the recipient receives it, reply-to is verified, and inbound mailbox/MX acceptance is completed where required.

## Next execution gate

1. Deploy commit `0a61a636cf136a45fe2747f78b1ec09c7e04f749` when deployment capacity is available, preferably to IZAKHONO-owned runtime first when NODE01 public activation is available.
2. Verify `POST /api/contact` on the production hostname.
3. Configure only the required server-side transport credentials.
4. Execute a real controlled test send.
5. Verify receipt and reply path.
6. Record machine-readable acceptance evidence.
