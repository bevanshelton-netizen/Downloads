-- KORA launch hardening: privileged state is server-controlled and money is funded.

-- Users can edit presentation fields only; role/KYC are operations-controlled.
revoke update on table public.profiles from authenticated;
grant update (display_name, country_code) on table public.profiles to authenticated;

-- Creator identity can be created/edited by its owner, but verification and payout state
-- cannot be supplied or changed by the browser.
revoke insert, update, delete on table public.creators from authenticated;
grant insert (owner_id, name, bio) on table public.creators to authenticated;
grant update (name, bio) on table public.creators to authenticated;

-- Production publication state is never client-writable. New rows therefore inherit
-- status='draft' and explicit server moderation controls the later state transitions.
revoke insert, update, delete on table public.productions from authenticated;
grant insert (
  creator_id, title, slug, synopsis, genre, primary_language, age_rating,
  explicit_sexual_content, access_mode, purchase_price, poster_url
) on table public.productions to authenticated;
grant update (
  title, slug, synopsis, genre, primary_language, age_rating,
  explicit_sexual_content, access_mode, purchase_price, poster_url
) on table public.productions to authenticated;

-- Episode playback IDs and moderation/publication state are server-controlled.
revoke insert, update, delete on table public.episodes from authenticated;
grant insert (production_id, episode_number, title, duration_seconds, vertical)
on table public.episodes to authenticated;
grant update (episode_number, title, duration_seconds, vertical)
on table public.episodes to authenticated;

-- Advertisers control their commercial inputs but cannot self-activate a campaign.
revoke insert, update, delete on table public.campaigns from authenticated;
grant insert (
  advertiser_id, name, budget, reward_pool, reward_per_completion, starts_at, ends_at
) on table public.campaigns to authenticated;
grant update (
  name, budget, reward_pool, reward_per_completion, starts_at, ends_at
) on table public.campaigns to authenticated;

-- Payouts must go through request_wallet_payout(), which enforces KYC, the minimum
-- payout and available balance while serialising against the wallet row.
drop policy if exists "wallet owner creates payout request" on public.payout_requests;
revoke insert, update, delete on table public.payout_requests from authenticated;

-- A PayFast recurring token belongs to one membership, and a completed one-time
-- provider payment belongs to one purchase.
create unique index if not exists subscriptions_provider_subscription_unique
on public.subscriptions(provider, provider_subscription_id)
where provider_subscription_id is not null;

create unique index if not exists purchases_provider_payment_unique
on public.purchases(provider, provider_payment_id)
where provider_payment_id is not null;

-- Campaign funding is cumulative. Migration 003 intentionally makes one revenue row
-- unique per (source_type, source_id), so later cleared instalments increase that row
-- rather than attempting to insert a duplicate campaign revenue event.
create or replace function public.fund_campaign_from_cleared_revenue(
  p_campaign_id uuid,
  p_gross_amount numeric,
  p_reward_amount numeric
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_budget numeric;
  v_planned_reward numeric;
  v_existing_gross numeric := 0;
  v_existing_reward numeric := 0;
  v_revenue_id uuid;
  v_pool_id uuid;
begin
  if p_gross_amount <= 0 then raise exception 'Gross cleared amount must be positive'; end if;
  if p_reward_amount < 0 or p_reward_amount > p_gross_amount then raise exception 'Invalid reward funding amount'; end if;

  select budget, reward_pool into v_budget, v_planned_reward
  from public.campaigns where id = p_campaign_id for update;
  if v_budget is null then raise exception 'Campaign not found'; end if;

  select id, gross_amount into v_revenue_id, v_existing_gross
  from public.revenue_events
  where source_type = 'campaign' and source_id = p_campaign_id::text
  for update;

  v_existing_gross := coalesce(v_existing_gross, 0);

  select coalesce(sum(funded_amount), 0) into v_existing_reward
  from public.reward_pools
  where campaign_id = p_campaign_id;

  if v_existing_gross + p_gross_amount > v_budget then
    raise exception 'Cumulative cleared amount exceeds campaign budget';
  end if;
  if v_existing_reward + p_reward_amount > v_planned_reward then
    raise exception 'Cumulative reward funding exceeds campaign reward allocation';
  end if;

  if v_revenue_id is null then
    insert into public.revenue_events(source_type, source_id, gross_amount, currency, cleared, cleared_at)
    values('campaign', p_campaign_id::text, p_gross_amount, 'ZAR', true, now())
    returning id into v_revenue_id;
  else
    update public.revenue_events
    set gross_amount = gross_amount + p_gross_amount,
        cleared = true,
        cleared_at = now()
    where id = v_revenue_id;
  end if;

  if p_reward_amount > 0 then
    insert into public.reward_pools(revenue_event_id, campaign_id, funded_amount)
    values(v_revenue_id, p_campaign_id, p_reward_amount)
    returning id into v_pool_id;
  end if;

  update public.campaigns set status = 'active' where id = p_campaign_id;
  return coalesce(v_pool_id, v_revenue_id);
end;
$$;

revoke all on function public.fund_campaign_from_cleared_revenue(uuid, numeric, numeric)
from public, anon, authenticated;
grant execute on function public.fund_campaign_from_cleared_revenue(uuid, numeric, numeric)
to service_role;

-- Creator earnings are allocated only from a cleared revenue event. Existing viewer
-- reward funding and existing creator allocations are counted before any new credit,
-- preventing KORA from allocating more money than actually cleared.
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

  select gross_amount, cleared into v_gross, v_cleared
  from public.revenue_events
  where id = p_revenue_event_id
  for update;

  if v_gross is null then raise exception 'Revenue event not found'; end if;
  if v_cleared is not true then raise exception 'Revenue must be cleared before creator allocation'; end if;

  select owner_id into v_owner_id from public.creators where id = p_creator_id;
  if v_owner_id is null then raise exception 'Creator not found'; end if;

  if p_production_id is not null and not exists (
    select 1 from public.productions
    where id = p_production_id and creator_id = p_creator_id
  ) then
    raise exception 'Production does not belong to creator';
  end if;

  select coalesce(sum(amount), 0) into v_creator_allocated
  from public.creator_earnings
  where revenue_event_id = p_revenue_event_id and status <> 'reversed';

  select coalesce(sum(funded_amount), 0) into v_reward_funded
  from public.reward_pools
  where revenue_event_id = p_revenue_event_id;

  if v_creator_allocated + v_reward_funded + p_amount > v_gross then
    raise exception 'Allocation exceeds cleared revenue available';
  end if;

  select id into v_wallet_id from public.wallets where owner_id = v_owner_id;
  if v_wallet_id is null then raise exception 'Creator wallet not found'; end if;

  insert into public.creator_earnings(
    creator_id, revenue_event_id, production_id, amount, currency, status
  ) values (
    p_creator_id, p_revenue_event_id, p_production_id, p_amount, 'ZAR', 'available'
  ) returning id into v_earning_id;

  insert into public.ledger_entries(wallet_id, kind, amount, reason, source_type, source_id)
  values(
    v_wallet_id, 'credit', p_amount, 'Creator revenue share',
    'creator_earning', v_earning_id::text
  );

  return v_earning_id;
end;
$$;

revoke all on function public.allocate_creator_earning(uuid, uuid, numeric, uuid)
from public, anon, authenticated;
grant execute on function public.allocate_creator_earning(uuid, uuid, numeric, uuid)
to service_role;
