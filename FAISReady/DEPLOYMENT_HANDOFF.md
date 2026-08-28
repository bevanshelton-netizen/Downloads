# FAISReady — deployment handoff

FAISReady is the South African RE5/RE1 regulatory-exam preparation platform prepared for launch on 28 August 2026.

## Commercial model
- RE5 Complete Prep — R299 / 90 days
- RE1 Complete Prep — R399 / 90 days
- RE5 + RE1 — R549 / 120 days
- Company licensing — R149 (10–49), R119 (50–199), from R89 (200+)

## Launch build status
- Responsive financial-services UI with approved human financial photography
- 540 original preparation questions: 300 RE5 + 240 RE1
- Diagnostics, quick drills, deep drills, RE5 50-question mocks and RE1 80-question mocks
- Readiness, mastery and weak-area coaching
- Learner account architecture
- Company dashboard demo and bulk licensing model
- PayFast signed checkout and ITN validation scaffold
- Supabase schema and entitlement architecture

## External launch gates
1. Connect Vercel (or compatible production host).
2. Connect/create Supabase and apply the included schema.
3. Add Izakhono PayFast Merchant ID, Merchant Key and passphrase as protected environment variables.
4. Confirm the Izakhono bank account is the verified payout account in PayFast.
5. Complete sandbox payment test before switching live.

## Regulatory content policy
FAISReady does not claim to contain leaked or confidential exam papers. The question bank is original preparation content and should be maintained against the current FSCA RE1/RE5 preparation guide, tasks, qualifying criteria and underlying legislation.

The complete launch package has been generated in the ChatGPT build workspace as `FAISReady-LAUNCH-PACKAGE.zip`.
