# KORA Production Activation — Phase 8

Phase 8 does not claim that external production accounts are connected. It makes the application fail closed until those accounts and operating processes are genuinely ready.

## Release states

- **Private Beta**: anonymous visitors are sent to `/coming-soon`; existing invited accounts can sign in and test. Public signup, creator applications and advertiser campaigns are individually switchable.
- **Public Beta**: the administrator may enable public launch only after every other readiness check passes.
- **General Availability**: same technical gate as Public Beta, used after operating acceptance.
- **Maintenance**: anonymous and ordinary signed-in users are sent to the maintenance landing page; administrators/moderators retain operational access. Server callbacks under `/api/` remain available so existing payment/provider notifications are not discarded.

Release-state changes are written to `platform_release_events`.

## Database and restore signoff

Before `KORA_BACKUP_OPERATIONS_APPROVED=true`:

1. Verify automated production database backups are enabled and retention is documented.
2. Name the person responsible for restoration.
3. Restore a recent backup into a non-production project.
4. Run `npm run validate:migrations` against source and confirm production has migrations through 013.
5. Confirm restored auth/data relationships, wallets, purchases, subscriptions, creator allocations and release state are coherent.
6. Record the restore date and measured recovery time in the operating log.

## Incident-response signoff

Before `KORA_INCIDENT_RESPONSE_APPROVED=true`, assign owners and rehearse these actions:

- **Payment incident**: stop new campaign/payment promotion, preserve PayFast ITNs, reconcile provider IDs and never manually fabricate entitlements.
- **Content/safety incident**: unpublish affected content, preserve moderation/rights records, escalate child-safety issues immediately through the approved process.
- **Reward/payout incident**: stop reward verification or payout processing before changing ledger data; preserve immutable ledger history.
- **Security incident**: rotate affected server secrets, invalidate provider tokens where possible, preserve logs/evidence and assess notification duties.
- **Broad outage**: enable maintenance mode in `/admin/launch`, communicate through the approved support channel and restore from known-good state.

## First administrator

Bootstrap is intentionally one-time. Create the owner's Supabase Auth account, load production server environment values in a trusted shell, then run:

```bash
KORA_BOOTSTRAP_CONFIRM=BOOTSTRAP_FIRST_ADMIN npm run bootstrap:admin -- owner@example.com
```

The script refuses to run once any administrator exists.

## Final switch

`/api/readiness` must show every blocker except `publicLaunchEnabled` as passing before the administrator attempts public launch. `/admin/launch` independently repeats the preflight and refuses the launch update if another blocker exists.

After enabling public launch, require `/api/readiness` to return HTTP 200 and repeat payment, PPV, playback, live-channel, ad/reward, creator-revenue, payout and Kids smoke tests on the final public HTTPS origin.
