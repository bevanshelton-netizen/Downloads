# WebStart Factory v2 Architecture

```
Browser Builder
  |
  +--> Supabase Auth
  |
  +--> sites (owner-isolated)
  |
  +--> webstart-draft
  |      -> infer sector
  |      -> produce 3 directions
  |
  +--> webstart-generate
  |      -> choose direction
  |      -> escape user content
  |      -> responsive HTML
  |      -> SEO/JSON-LD
  |      -> default lead form
  |      -> QA gate
  |
  +--> webstart-publish
         -> mark candidate published
         -> Shared Renderer /<slug>
         -> HTTP/content verification
         -> VERIFIED LIVE or rollback

Published Website
  |
  +--> webstart_leads (insert only for public)
         -> site owner can read/update through RLS
```

## Hosting
The shared renderer is an adapter. Its only contract is: fetch a published site's `generated_html` by slug and return it as `text/html`. An IZAKHONO-owned renderer can implement the same contract and become primary without regenerating sites.

## Design directions
- `bold-growth`: high-impact conversion-led
- `premium-trust`: refined credibility-led
- `clean-modern`: simple mobile-first

## Publish invariant
No route may be described as live merely because a database flag changed. `webstart-publish` must independently retrieve the public renderer URL, receive HTTP 200 with HTML, confirm the business name, and only then set `verified_at`.
