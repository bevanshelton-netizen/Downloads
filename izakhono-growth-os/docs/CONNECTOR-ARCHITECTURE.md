# Connector Architecture

## Core flow

User brief → Growth Planner → Creative/Localization → Compliance Preflight → Approval Queue → Provider Adapter → Platform API → Activity Ledger → Attribution.

## Provider adapters

Initial adapters:
- Google Ads
- Meta Ads / Instagram
- TikTok Ads
- LinkedIn Ads
- Amazon Ads
- Microsoft Advertising

Secondary adapters:
- YouTube
- Google Business Profile
- Instagram/Facebook organic
- TikTok organic
- LinkedIn Company Pages
- email/CRM
- WhatsApp business messaging where permitted

## Guardrails

Provider adapters expose separate read and write methods. Write methods must:
- require a connected account;
- validate an approval token/state;
- respect brand and account budget caps;
- default campaign creation to PAUSED;
- emit an immutable activity record;
- never accept raw platform passwords.

## What makes Growth OS broader than a paid-media connector

Growth OS owns the strategy layer around the ads: brand memory, country/language packs, landing pages, leads, organic content, attribution, creative versioning, compliance gates and portfolio reporting.
