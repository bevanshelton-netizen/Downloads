# IZAKHONO WebStart Factory v2

WebStart Factory turns a short business brief into a professional coded website, with three design directions, automated QA, lead capture, instant publishing and public verification.

## Live routes
- Builder: https://izakhono-webstart.vercel.app
- Shared renderer: https://izakhono-webstart-sites.vercel.app
- Renderer health: https://izakhono-webstart-sites.vercel.app/health
- Core API/runtime: Supabase project `IZAKHONO WebStart`

## Fast workflow
1. Owner creates/signs into WebStart.
2. Enter business name plus one short brief.
3. `webstart-draft` creates three directions: Bold Growth, Premium Trust, Clean Modern.
4. Owner selects a direction, or **Build Fast** selects the default.
5. `webstart-generate` creates escaped responsive HTML, SEO metadata, lead form and QA report.
6. `webstart-publish` publishes through the shared renderer.
7. Publisher independently fetches the public URL and only keeps status `published` if HTTP 200 + expected HTML are verified.
8. Each live site automatically receives enquiries in `webstart_leads`; public users can insert but cannot read leads.

## Architecture rule
WebStart has its own engine. The current Vercel builder and renderer are replaceable external delivery adapters. The canonical data/generation/publish contract is independent of any one host and can be mirrored to IZAKHONO-owned runtime/EDGE without changing generated sites.

## Privacy/security
- No service-role key is exposed in generated sites.
- Generated lead forms use only the Supabase publishable key.
- `sites`: anon SELECT only; authenticated owner CRUD through RLS.
- `webstart_leads`: public INSERT only for published sites; owner SELECT/UPDATE only.
- Generated sites include no behavioural analytics by default.
- Publish status is verification-gated.

## v2 capabilities
- Brief-to-site fast path
- Three design directions
- Sector inference
- Responsive coded HTML
- SEO + JSON-LD
- Default lead capture
- Automated QA score
- Verified publish with rollback
- Manual advanced editor retained
- Replaceable shared renderer

Source snapshot: 25 September 2026.
