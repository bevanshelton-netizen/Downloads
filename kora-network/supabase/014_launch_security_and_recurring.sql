-- KORA launch security + recurring subscription lifecycle hardening.

-- Normal users may update presentation fields only; role and KYC remain operations-controlled.
revoke update on table public.profiles from authenticated;
grant update (display_name, country_code) on table public.profiles to authenticated;

-- Creator identity may be created/edited only through allowed identity fields. Verification and payout state stay privileged.
revoke insert, update, delete on table public.creators from authenticated;
grant insert (owner_id, name, bio) on table public.creators to authenticated;
grant update (name, bio) on table public.creators to authenticated;

-- Creators may create/edit catalogue metadata but never moderation/publication state or Kids approval.
revoke insert, update, delete on table public.productions from authenticated;
grant insert (
  creator_id, title, slug, synopsis, genre, primary_language, age_rating,
  explicit_sexual_content, access_mode, purchase_price, poster_url
) on table public.productions to authenticated;
grant update (
  title, slug, synopsis, genre, primary_language, age_rating,
  explicit_sexual_content, access_mode, purchase_price, poster_url
) on table public.productions to authenticated;

-- Creator clients never write playback/moderation/publication state directly.
revoke insert, update, delete on table public.episodes from authenticated;
grant insert (production_id, episode_number, title, duration_seconds, vertical)
on table public.episodes to authenticated;
grant update (episode_number, title, duration_seconds, vertical)
on table public.episodes to authenticated;

-- Advertisers can draft campaign economics but cannot self-activate campaigns or mutate operational delivery state.
revoke insert, update, delete on table public.campaigns from authenticated;
grant insert (
  advertiser_id, name, budget, reward_pool, reward_per_completion, starts_at, ends_at
) on table public.campaigns to authenticated;
grant update (
  name, budget, reward_pool, reward_per_completion, starts_at, ends_at
) on table public.campaigns to authenticated;

-- Payout requests must go through request_wallet_payout(), which enforces KYC, verified payout onboarding,
-- minimum payout and available balance.
drop policy if exists "wallet owner creates payout request" on public.payout_requests;
revoke insert, update, delete on table public.payout_requests from authenticated;

-- PayFast's stable recurring subscription token belongs to one KORA subscription agreement.
alter table public.subscriptions
  add column if not exists cancelled_at timestamptz;

create unique index if not exists subscriptions_payfast_token_unique
on public.subscriptions(provider, provider_subscription_id)
where provider_subscription_id is not null;

-- Keep the release-state schema marker aligned with the migration sequence.
update public.platform_release_state
set schema_version = greatest(schema_version, 14), updated_at = now()
where singleton = true;
