# DOXA-SURE Broker Network — Operating Model

## Purpose
DOXA-SURE is being structured as a broker-agnostic protection marketplace and brokerage technology platform. The platform should help customers explain what they need, route them toward an appropriately authorised participating brokerage, and provide workflow technology without pretending that DOXA-SURE itself holds every participating brokerage's authorisation.

## Core rule
DOXA-SURE may not present another entity's FSP licence as its own or allow a paid plan to override regulatory eligibility. Regulated advice/intermediary services remain with the identified authorised FSP unless a separately documented lawful representative arrangement applies.

## Customer journey
1. Customer chooses need/category.
2. DOXA-SURE captures only minimum non-sensitive matching information.
3. Matching engine filters by verified FSP status, declared service categories, geography, customer type, product/insurer access where applicable, capacity and service performance.
4. Customer is shown/introduced to the identified participating brokerage and its FSP identity before regulated service begins.
5. Brokerage handles regulated advice, recommendation, quotation/application/intermediary activity and required disclosures.
6. DOXA-SURE may continue to provide neutral workflow, case tracking, reminders and customer-experience tools within the agreed data-processing model.

## Marketplace plans
### Founding 50
- R0 joining fee.
- R0 monthly platform fee for first 3 months.
- R50 per qualified lead accepted during founding period.
- Subject to verification and onboarding.

### Network
- R499/month.
- R75 per accepted qualified lead.
- Marketplace profile, category configuration, lead inbox, basic tracking.

### Broker Pro
- R1,499/month.
- R40 per accepted qualified lead.
- Adds broker dashboard, client pipeline, renewal/risk reminders, team workflow and analytics.

### White Label
- R4,950/month.
- R25 per accepted qualified lead.
- Implementation/customisation quoted separately.
- Brokerage branding, FSP disclosures, customer portal, staff dashboard and reporting.

### Enterprise
- From R12,500/month.
- Lead/integration pricing negotiated.
- Multi-branch, advanced permissions, API/integration scope, dedicated rollout support.

## Broker verification states
- applied
- verification_pending
- verified
- active
- suspended
- rejected
- exited

No customer-facing match may be made to `applied`, `verification_pending`, `suspended`, `rejected` or `exited` brokerages.

## Matching eligibility
A brokerage is eligible for a request only when:
- status = active;
- FSP identity has been verified;
- requested category/subcategory falls within approved configuration;
- customer type and geography are supported;
- capacity is available; and
- any mandatory product/insurer-access requirement is satisfied.

Commercial plan level, subscription price and lead fee must not make an otherwise ineligible brokerage eligible.

## Matching ranking
Among eligible brokerages, ranking may consider:
- service availability;
- response time;
- customer-type fit;
- geography;
- configured product access;
- current lead capacity;
- objective service-quality metrics;
- fair rotation to avoid concentration.

DOXA-SURE should not secretly rank a brokerage higher merely because it pays more commission or a higher platform fee.

## Data model principles
- Multi-tenant architecture.
- Each brokerage has a tenant ID.
- Broker users are scoped to their tenant.
- Customer records shared with a brokerage become accessible only after a documented match/assignment basis exists.
- Public marketplace information is separated from private operational records.
- Sensitive documents are never stored in public GitHub.
- Row-level security must be tested with at least two broker tenants before real customer data is stored.

## Customer transparency
Before regulated service begins, customer should be able to see:
- brokerage trading/legal name;
- FSP number;
- assigned adviser/representative where relevant;
- service category for which they are being assisted;
- complaints/contact route;
- clear statement identifying who provides regulated advice/intermediary services.

## Revenue rules
DOXA-SURE revenue may include SaaS subscriptions, implementation fees, accepted-qualified-lead fees, consumer technology/membership fees and enterprise/API fees. Any remuneration connected to regulated financial services must be structured and compliance-approved before use.

## Launch stages
### Stage 1 — Marketplace MVP
- public broker network page;
- customer match-intake tool;
- brokerage application form;
- pricing tiers;
- broker portal demo;
- no claim that unverified brokerages are live.

### Stage 2 — Verified Founding Network
- onboard first brokerages;
- verify FSP information and service categories;
- activate manual match routing;
- execute required commercial/data/compliance agreements.

### Stage 3 — Secure multi-tenant backend
- execute broker-network database migration;
- harden RLS and function permissions;
- broker login and real lead queue;
- customer-to-broker assignment audit trail;
- consent/POPIA controls.

### Stage 4 — Integrations
- CRM/API integrations;
- insurer/product access metadata;
- quote/renewal/claims status connections where contractually and legally permitted;
- white-label tenant themes.

## Non-negotiable legal/compliance controls
- No borrowed/rented FSP licence wording.
- No regulated advice by DOXA-SURE unless lawful authorisation/representative structure applies.
- No fake broker verification.
- No customer matching to ineligible brokerages.
- No guaranteed insurance/rescue outcome.
- No public storage of sensitive customer data.
- No debt-counselling representation unless properly within NCR-registered structure.
- Legal/repo/foreclosure matters routed to suitably qualified legal professionals when required.

## Status
This document is the internal operating model for the DOXA-SURE broker marketplace MVP. It is not a substitute for brokerage-specific compliance, legal, FAIS, POPIA, consumer-law or tax review before full commercial scale.