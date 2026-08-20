# KORA South Africa Legal & Regulatory Review Gate

This is an engineering launch checklist, not a substitute for advice from qualified South African legal and regulatory professionals.

KORA deliberately keeps `KORA_LEGAL_APPROVED=false` and `KORA_REGULATORY_APPROVED=false` until the work below is completed and signed off. The production `/api/readiness` endpoint will remain closed while either gate is false.

## Film and Publication Board (FPB)

The FPB describes its mandate as extending to online content, and its published material addresses commercial online distributors, online distribution and classification/self-classification. Before launch, obtain written advice/confirmation on KORA's required distributor registration, classification process, any self-classification approval/accreditation, reporting obligations and treatment of user-generated content.

Official starting points:
- https://fpb.org.za/
- https://fpb.org.za/about/
- https://fpb.org.za/classification/

Do not treat KORA's internal age-rating selector as a substitute for any classification process legally required by the FPB.

## POPIA / Information Regulator

Confirm the legal operating entity as the responsible party, register/confirm the Information Officer process, approve the Privacy Notice, map processors and cross-border processing, set retention rules, establish data-subject request handling and complete any required prior-authorisation analysis.

Child-data functionality must remain minimised and disabled unless an approved lawful basis and safeguards are in place. The Information Regulator publishes specific guidance on processing children's personal information.

Official starting points:
- https://inforegulator.org.za/popia/
- https://inforegulator.org.za/guidance-notes/

## Consumer and electronic-commerce review

Review checkout disclosures, recurring subscription wording, cancellation/refund procedures, pricing/tax display, electronic contracting, records and consumer complaint procedures under applicable South African consumer/e-commerce law.

## Copyright and performer rights

Approve the Creator Agreement, rights declarations, music-rights workflow, performer/location release standards, rights complaint procedure, dispute holds and removal/restoration process. Determine the exact statutory/takedown framework applicable to KORA's hosting/distribution model before publishing a final legal process.

## Advertising and rewards

Review advertiser claims, sponsored-content disclosures, promotions/competitions, viewer reward wording, direct marketing consent, tax/accounting treatment of creator/viewer payouts and any financial-services or gambling perimeter risks. KORA rewards must remain tied to real cleared campaign revenue and must not be marketed as guaranteed income or an investment.

## Children and family safety

Approve the KORA Kids design, age assurance/parental controls, child performer consent/release process, child personal-information controls, reporting/escalation process and staff safeguarding procedures before enabling child-directed interactive features.

## Sign-off evidence

Before setting the environment gates to true, store internal evidence of:
1. operating entity and public legal/contact details;
2. legal review of Terms, Privacy Notice, Creator Agreement, Advertiser Terms and refund/cancellation terms;
3. FPB classification/distributor compliance position;
4. POPIA Information Officer and privacy operations;
5. child-safety and moderation escalation owner;
6. rights/takedown operational owner;
7. payment/reward/payout compliance and tax/accounting review.
