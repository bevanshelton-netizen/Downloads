# WebStart 2.1 Launch Status

**Primary public builder:** https://izakhono-webstart.vercel.app  
**Public renderer:** https://izakhono-webstart-sites.vercel.app  
**Core:** IZAKHONO WebStart Supabase project  
**Owned runtime:** packaged under `owned-runtime/`

## Launch gates
- Builder public HTTPS 200: VERIFIED
- Terms / Privacy / Refund routes: VERIFIED 200
- Core health 2.1.0: VERIFIED 200
- Renderer health: VERIFIED 200
- Brief → 3 directions → coded generation: DEPLOYED
- Automated QA before publish: DEPLOYED
- Lead capture + owner lead inbox: DEPLOYED
- Paid publish gate: ACTIVE
- iKhokha initial checkout prices: Start R999 + R99 first month; Business R2,499 + R199; Commerce R4,999 + R349
- Renewal checkout engine: monthly fee only
- Paid-order subscription ledger: ACTIVE
- Custom domain workflow: AVAILABLE
- Owned-runtime cutover package: READY, public owned hostname not yet verified

## Revenue rule
Building and previewing are free. Public publishing requires a paid order.

## Billing rule
Initial checkout charges setup + first month. Future service periods use a fresh renewal checkout; no automatic card debit is claimed.

## Delivery rule
Vercel is a replaceable external delivery adapter. The owned runtime package can serve the same builder and generated customer sites without regeneration.
