# DOXA-SURE Bootstrap MVP

**Operating promise:** Protecting what has been entrusted to you.  
**Build rule:** Membership instant. Insurance delayed. Rescue audited.

This is the cash-first DOXA-SURE MVP. It is deliberately small, cheap and safe to test before building a licensed insurance stack.

## What works now

- Mobile-first landing page
- Free Asset Risk Check entry point
- My DOXA-SURE Shield dashboard
- Transparent Shield Score v1
- Asset Vault for home, vehicle, income, family and business exposures
- SAVE MY ASSET rescue-case creation
- Dated snapshot of the customer position at trigger time
- Rules-based Rescue Plan actions
- Action status audit trail in Supabase
- Private document bucket when Supabase is enabled
- Email magic-link auth when Supabase is enabled
- Zero-cost browser demo mode when Supabase is not enabled

## What is deliberately NOT in v1

- Insurance underwriting or insurer promises
- Claims payments
- Debt counselling performed by DOXA-SURE
- Legal representation performed by DOXA-SURE
- OCR/AI API costs
- SMS login costs
- ID numbers, bank-account numbers, passwords or PINs
- A paid cell-captive or insurer integration

## Shared Supabase safety

The migration in `supabase/migrations/001_doxa_bootstrap_mvp.sql` is designed for the existing Allegro-Vibez Supabase project without touching Allegro tables.

Everything is prefixed:

- tables: `doxa_*`
- functions: `doxa_*`
- triggers: `doxa_*`
- policies: `doxa_*`
- storage bucket: `doxa-vault-docs`

The auth trigger is named `doxa_on_auth_user_created`; it does **not** drop or replace Allegro-Vibez auth triggers.

## Demo mode

`config.js` intentionally ships with the Supabase anon key blank. In this state the site opens in a zero-cost browser demo mode and stores only structured demo data in localStorage. Files themselves are not stored.

This is useful for sales demos and product validation without collecting real sensitive documents.

## Live mode

After the SQL migration is applied, set the public browser-safe Supabase anon/publishable key in `config.js`:

```js
window.DOXA_CONFIG = {
  supabaseUrl: 'https://zoolsumifdtanycjryje.supabase.co',
  supabaseAnonKey: 'PUBLIC_BROWSER_KEY',
  mode: 'auto'
};
```

The anon/publishable key is intended for browser use; Row Level Security is the real data barrier. Never place the Supabase service-role key in this frontend.

## Secure pilot leads

Apply `supabase/migrations/002_doxa_secure_leads.sql` after migration 001. It adds the minimal-consent form on `pilot.html` and an owner-only lead desk at `leads-dashboard.html`.

The public browser never receives table read access. It may call only the validated `doxa_submit_pilot_lead` function. Lead reads and status updates require an authenticated user explicitly enrolled in `doxa_admins`.

After the owner has used the dashboard magic-link sign-in once, run this once in the Supabase SQL editor with the owner's real email:

```sql
insert into public.doxa_admins(user_id)
select id from auth.users where email = 'OWNER_EMAIL'
on conflict do nothing;
```

The site does not connect to WhatsApp or the owner's personal phone.

## Regulatory boundary

This MVP is a rescue-coordination and case-organisation tool. It must not be marketed as an insurance policy, legal representation, debt counselling, or a guarantee that an asset will be saved. Regulated actions must be handed to appropriately authorised professionals.
