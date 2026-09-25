# YHVH GOSPEL TV — CEO Operating Plan

**Effective:** 25 September 2026  
**Authority:** IZAKHONO AFRICA (PTY) LTD  
**Product:** YHVH GOSPEL TV  
**Operating principle:** Owned-first, externally reversible, Gospel-only, privacy-respecting.

## 1. Business objective

Build YHVH GOSPEL TV into a credible Gospel television network that can operate globally, acquire quality programming, attract churches/artists/events, sign commercial partners, and progressively move public delivery onto IZAKHONO-owned infrastructure without interrupting viewers or leads.

The channel is not considered successful merely because a page is online. Success requires:

1. viewers can always reach a working watch route;
2. the programme clock is credible and maintained;
3. contributors can submit safely;
4. commercial enquiries cannot be lost when the owned route is unavailable;
5. rights, safeguarding and editorial review precede scheduling;
6. external providers remain replaceable;
7. the owned public route is promoted only after independent verification.

## 2. Route strategy

### Public viewing

- Preferred route: `gospel.domains.izakhonoafrica.co.za` when its YHVH-owned health contract passes.
- Current resilience route: YHVH public experience on the KORA Network Vercel deployment.
- Independent mirror: GitHub Pages YHVH Gospel TV front door.
- `/gospel/live` must choose a healthy IZAKHONO-owned origin first and fall back externally without presenting a dead end.

### Intake

- Partner/content applications: IZAKHONO-owned `/api/submissions` first.
- Commercial enquiries: IZAKHONO-owned `/api/submissions` first.
- If the owned intake is unreachable or returns infrastructure-level failure, buffer through the approved external intake and reconcile into the owned queue.
- External intake never becomes the editorial or commercial authority.

## 3. Revenue model

The initial commercial inventory remains proposal-based while audience proof, distribution reach and delivery capability mature.

Priority products:

1. Founding / Presenting Partner
2. Programme Sponsorship
3. Live Gospel Event Broadcast
4. Regional / OTT / FAST / Smart-TV Distribution
5. Faith-aligned Advertising
6. Production and Broadcast Services

No payment, sponsorship or donation guarantees airtime, editorial approval, ministry endorsement or programme placement.

## 4. Commercial pipeline

Every commercial opportunity follows:

`Enquiry → Qualification → Rights/Suitability Review → Proposal → Agreement → Delivery → Reconciliation`

Minimum qualification information:

- organisation and decision-maker;
- territory;
- campaign or distribution objective;
- timing;
- indicative budget/currency where available;
- website/public profile;
- required rights and delivery scope.

Do not activate checkout for sponsorship or advertising until the commercial scope, legal merchant position, deliverables and refund/cancellation terms are defined for that transaction.

## 5. Content and partner pipeline

Every contributor follows:

`Apply → Identity/Entity Verification → Rights Declaration → Editorial/Safety Review → Commercial Review (if applicable) → Agreement → Technical QC → Schedule/Distribute`

Applications involving minors require safeguarding evidence before broadcast. Fundraising, health/healing claims and similar higher-risk material require specific editorial review.

## 6. Weekly operating scorecard

Use operational records only; no behavioural tracking or profiling.

Track:

- public route availability and failure incidents;
- owned-origin verification state;
- number of new content/partner applications;
- number of applications awaiting verification;
- number of qualified commercial enquiries;
- proposals issued;
- agreements signed;
- confirmed programme inventory;
- confirmed distribution partners;
- unresolved rights/safeguarding issues;
- external-buffer records awaiting reconciliation.

Do not build user-level viewing profiles, advertising identifiers, silent analytics or cross-site tracking.

## 7. Programme strategy

Protect the 24-hour television feel. Maintain a dependable daily spine:

- early morning worship/prayer;
- Gospel music;
- Scripture/teaching;
- women/youth/family strands;
- African choirs and artists;
- testimony;
- prime-time Gospel;
- revival/concert/event windows;
- overnight worship/Scripture.

Use acquired programming only after rights and technical checks. Prefer repeatable series and partner-supplied programming with clear licensing over one-off uploads that cannot sustain a schedule.

## 8. Growth strategy

Growth priorities, in order:

1. make the public experience reliable;
2. onboard credible churches, ministries, Gospel artists and choirs;
3. secure recurring programme inventory;
4. sign event and distribution partners;
5. sell sponsorship and production packages against real inventory;
6. expand languages and territories;
7. move more delivery onto the owned route as its public evidence matures.

Do not inflate audience, reach, partner or revenue claims. Public claims require evidence.

## 9. Infrastructure rule

YHVH GOSPEL TV keeps its independent YHVH Gospel Engine for catalogue, scheduling, submissions, simulcast state, provider adapters and health verification.

External infrastructure is a delivery adapter and resilience layer only.

The owned route may be labelled **OWNED LIVE VERIFIED** only after:

- local engine and channel health pass;
- DNS resolves publicly;
- TLS is valid;
- HTTPS health identifies YHVH/IZAKHONO correctly;
- backup/restore and rollback evidence exists;
- an independent external check passes.

Until then, keep the verified external production route active.

## 10. Immediate CEO priorities

1. Fix YHVH service identity detection in the smart gateway.
2. Make commercial intake owned-first with external buffering.
3. Keep YHVH configuration names canonical while supporting legacy KORA environment variables temporarily.
4. Put the identity/routing rules into CI so they cannot silently regress.
5. Preserve the external production route while NODE01 public verification is incomplete.
6. Start partner acquisition and commercial outreach only against routes that have been verified working.
