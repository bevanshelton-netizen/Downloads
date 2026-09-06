# FAISReady v1 — IZAKHONO WORK build brief

## Goal
Build the first real launch product in IZAKHONO WORK: a polished, mobile-first South African FAIS Regulatory Examination preparation platform that can generate leads immediately and later accept payments without redesigning the core product.

## Commercial priority
- Hero offer: R399 individual RE preparation launch offer.
- Primary conversion: join launch list / request enrolment.
- Secondary conversion: employer and team enquiry.
- Third conversion: institutional pilot enquiry.
- Do not claim a live payment flow until a payment provider is actually connected and tested.
- Do not claim FSCA endorsement or guarantee exam results.

## Courses
Provide dedicated, visually distinct sections/pages for:
- RE1
- RE3
- RE4
- RE5

The platform must explain who each course is for, what candidates prepare for, and what is included. Preserve the current regulatory disclaimer. Do not invent accreditation or endorsement claims.

## v1 product experience
Build a complete standalone web app using dependency-light HTML/CSS/JavaScript so it runs locally first and can be deployed later with minimal changes.

Required screens/sections:
1. Strong landing hero with FAISReady branding and R399 offer.
2. Course selector for RE1 / RE3 / RE4 / RE5.
3. Detailed course cards/pages.
4. "What you get" section:
   - structured exam preparation
   - topic-by-topic revision
   - exam-style practice
   - mock assessments
   - weak-area identification
   - study progress/readiness tracking
5. Sample learning dashboard mock-up.
6. Sample quiz experience with score feedback.
7. Lead/enrolment form asking:
   - name
   - mobile
   - email
   - exam: RE1/RE3/RE4/RE5
   - exam date if known
   - individual / employer / institution
   - organisation if applicable
8. Store submitted leads locally in browser storage for owner testing and provide a clear confirmation message.
9. Owner-test lead export to CSV from the browser.
10. Employer/team and institutional pilot sections.
11. FAQ.
12. Regulatory/disclaimer footer.
13. Responsive mobile layout.
14. Strong South African visual identity using vibrant blue, white and gold with tasteful green accents.
15. No placeholder lorem ipsum.

## Conversion
Use clear CTAs:
- Start RE Preparation
- Join the R399 Launch List
- Employer / Team Enquiry
- Institutional Pilot

Until live payments are connected, CTAs must lead to the enrolment/lead form, not a fake checkout.

## Local owner controls
- All v1 data must stay local by default.
- No analytics trackers.
- No external scripts/CDNs unless essential.
- No secrets in source code.
- Include a README with local use and deployment notes.
- Include a RELEASE-CHECKLIST.md with launch gates.
- Include a PAYMENT-INTEGRATION.md showing where IZAKHONO PAY / a verified provider can be added later, but keep payment status disabled now.

## Validation
- Validate JSON/JavaScript syntax.
- Ensure index.html opens locally.
- Ensure the form works and saves a lead.
- Ensure CSV export works.
- Ensure course selection works.
- Ensure no payment-ready claim appears.
- Ensure mobile layout remains usable.

## Success condition
The build is complete when IZAKHONO WORK can show a working local preview, validation passes, and the product is ready for owner review as FAISReady v1 without claiming public production readiness.
