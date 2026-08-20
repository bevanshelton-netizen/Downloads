-- KORA launch hardening: protect privileged fields and add funded creator earnings.

-- Authenticated users may edit profile presentation fields, but never grant themselves
-- staff roles or KYC approval.
revoke update on table public.profiles from authenticated;
grant update (display_name, country_code) on table public.profiles to authenticated;

-- Creator owners may edit public creator details, but verification and payout status
-- remain operations-controlled.
revoke update on table public.creators from authenticated;
grant update (name, bio) on table public.creators to authenticated;

-- Creator clients may edit production metadata, but publication state is server-controlled.
revoke update on table public.productions from authenticated;
grant update (
  title,
  slug,
  synopsis,
  genre,
  primary_language,
  age_rating,
  explicit_sexual_content,
  access_mode,
  purchase_price,
  poster_url
) on table public.productions to authenticated;

-- Video attachment, moderation and publication state are server-controlled.
revoke update on table public.episodes from authenticated;
grant update (episode_number, title, duration_seconds, vertical)
on table public.episodes to authenticated;

-- Advertisers can edit commercial inputs but cannot self-activate or delete campaigns.
revoke update, delete on table public.campaigns from authenticated;
grant update (name, budget, reward_pool, reward_per_completion, starts_at, ends_at)
on table public.campaigns to authenticated;

-- Payouts must go through request_wallet_payout(), which enforces KYC, minimum payout
-- and available-balance checks. Direct inserts would bypass those controls.
drop policy if exists "wallet owner creates payout request" on public.payout_requests;
revoke insert, update, delete on table public.payout_requests from authenticated;

-- Provider identifiers must not be reused across successful payment records.
create unique index if not exists subscriptions_provider_subscription_unique
on public.subscriptions(provider, provider_subscription_id)
where provider_subscription_id is not null;

create unique index if not exists purchases_provider_payment_unique
on public.purchases(provider, provider_payment_id)
where provider_payment_id is not null;

-- Allocate creator earnings only from cleared revenue and never allow creator earnings
-- plus reward funding to exceed the cleared revenue event.
create or replace function public.allocate_creator_earning(
  p_creator_id uuid,
  p_revenue_event_id uuid,
  p_amount numeric,
  p_production_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_gross numeric;
  v_cleared boolean;
  v_creator_allocated numeric;
  v_reward_funded numeric;
  v_owner_id uuid;
  v_wallet_id uuid;
  v_earning_id uuid;
begin
  if p_amount <= 0 then raise exception 'Creator earning amount must be positive'; end if;

  select gross_amount, cleared
    into v_gross, v_cleared
  from public.revenue_events
  where id = p_revenue_event_id
  for update;

  if v_gross is null then raise exception 'Revenue event not found'; end if;
  if v_cleared is not true then raise exception 'Revenue must be cleared before creator allocation'; end if;

  select owner_id into v_owner_id
  from public.creators
  where id = p_creator_id;
  if v_owner_id is null then raise exception 'Creator not found'; end if;

  if p_production_id is not null and not exists (
    select 1 from public.productions
    where id = p_production_id and creator_id = p_creator_id
  ) then
    raise exception 'Production does not belong to creator';
  end if;

  select coalesce(sum(amount), 0) into v_creator_allocated
  from public.creator_earnings
  where revenue_event_id = p_revenue_event_id
    and status <> 'reversed';

  select coalesce(sum(funded_amount), 0) into v_reward_funded
  from public.reward_pools
  where revenue_event_id = p_revenue_event_id;

  if v_creator_allocated + v_reward_funded + p_amount > v_gross then
    raise exception 'Allocation exceeds cleared revenue available';
  end if;

  select id into v_wallet_id
  from public.wallets
  where owner_id = v_owner_id;
  if v_wallet_id is null then raise exception 'Creator wallet not found'; end if;

  insert into public.creator_earnings(
    creator_id,
    revenue_event_id,
    production_id,
    amount,
    currency,
    status
  ) values (
    p_creator_id,
    p_revenue_event_id,
    p_production_id,
    p_amount,
    'ZAR',
    'available'
  ) returning id into v_earning_id;

  insert into public.ledger_entries(wallet_id, kind, amount, reason, source_type, source_id)
  values(
    v_wallet_id,
    'credit',
    p_amount,
    'Creator revenue share',
    'creator_earning',
    v_earning_id::text
  );

  return v_earning_id;
end;
$$;

revoke all on function public.allocate_creator_earning(uuid, uuid, numeric, uuid)
from public, anon, authenticated;
grant execute on function public.allocate_creator_earning(uuid, uuid, numeric, uuid)
to service_role;
