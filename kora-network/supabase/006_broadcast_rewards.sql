-- KORA broadcast + verified reward layer.

alter table public.live_channels
  add column if not exists playback_url text,
  add column if not exists logo_url text,
  add column if not exists is_family_safe boolean not null default true;

alter table public.schedule_items
  add column if not exists sponsor_name text,
  add column if not exists is_premiere boolean not null default false;

alter table public.campaigns
  add column if not exists reward_per_completion numeric(14,2) not null default 0
  check (reward_per_completion >= 0);

alter table public.reward_pools
  add column if not exists campaign_id uuid references public.campaigns(id) on delete restrict;

create index if not exists schedule_items_channel_window_idx
  on public.schedule_items(channel_id, starts_at, ends_at);
create index if not exists reward_pools_campaign_idx
  on public.reward_pools(campaign_id);
create index if not exists ad_events_user_campaign_idx
  on public.ad_events(user_id, campaign_id, created_at desc);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  ad_event_id uuid not null unique references public.ad_events(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  reward_pool_id uuid not null references public.reward_pools(id) on delete restrict,
  ledger_entry_id uuid not null unique references public.ledger_entries(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.reward_claims enable row level security;
create policy "viewer reads own reward claims" on public.reward_claims
for select using (user_id = auth.uid() or public.is_staff());

-- Operations records money as cleared before any reward pool can exist.
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
  v_existing_gross numeric;
  v_existing_reward numeric;
  v_revenue_id uuid;
  v_pool_id uuid;
begin
  if p_gross_amount <= 0 then raise exception 'Gross cleared amount must be positive'; end if;
  if p_reward_amount < 0 or p_reward_amount > p_gross_amount then raise exception 'Invalid reward funding amount'; end if;

  select budget, reward_pool into v_budget, v_planned_reward
  from public.campaigns where id = p_campaign_id for update;
  if v_budget is null then raise exception 'Campaign not found'; end if;

  select coalesce(sum(gross_amount), 0) into v_existing_gross
  from public.revenue_events
  where source_type = 'campaign' and source_id = p_campaign_id::text and cleared = true;

  select coalesce(sum(funded_amount), 0) into v_existing_reward
  from public.reward_pools
  where campaign_id = p_campaign_id;

  if v_existing_gross + p_gross_amount > v_budget then raise exception 'Cumulative cleared amount exceeds campaign budget'; end if;
  if v_existing_reward + p_reward_amount > v_planned_reward then raise exception 'Cumulative reward funding exceeds campaign reward allocation'; end if;

  insert into public.revenue_events(source_type, source_id, gross_amount, currency, cleared, cleared_at)
  values('campaign', p_campaign_id::text, p_gross_amount, 'ZAR', true, now())
  returning id into v_revenue_id;

  if p_reward_amount > 0 then
    insert into public.reward_pools(revenue_event_id, campaign_id, funded_amount)
    values(v_revenue_id, p_campaign_id, p_reward_amount)
    returning id into v_pool_id;
  end if;

  update public.campaigns set status = 'active' where id = p_campaign_id;
  return coalesce(v_pool_id, v_revenue_id);
end;
$$;

revoke all on function public.fund_campaign_from_cleared_revenue(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.fund_campaign_from_cleared_revenue(uuid, numeric, numeric) to service_role;

-- Atomic, service-only claim function. A client cannot choose its own reward amount.
create or replace function public.claim_verified_ad_reward(
  p_user_id uuid,
  p_ad_event_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_verified boolean;
  v_event_type text;
  v_event_user uuid;
  v_amount numeric;
  v_pool_id uuid;
  v_available numeric;
  v_wallet_id uuid;
  v_ledger_id uuid;
  v_claim_id uuid;
begin
  if exists(select 1 from public.reward_claims where ad_event_id = p_ad_event_id) then
    raise exception 'Reward already claimed';
  end if;

  select campaign_id, verified, event_type, user_id
    into v_campaign_id, v_verified, v_event_type, v_event_user
  from public.ad_events
  where id = p_ad_event_id
  for update;

  if v_campaign_id is null then raise exception 'Ad event not found'; end if;
  if v_event_user is distinct from p_user_id then raise exception 'Ad event does not belong to user'; end if;
  if v_verified is not true or v_event_type <> 'complete' then raise exception 'Ad completion is not verified'; end if;

  select reward_per_completion into v_amount
  from public.campaigns
  where id = v_campaign_id and status in ('active','completed');

  if v_amount is null or v_amount <= 0 then raise exception 'Campaign has no completion reward'; end if;

  select rp.id, rp.funded_amount - rp.spent_amount
    into v_pool_id, v_available
  from public.reward_pools rp
  join public.revenue_events re on re.id = rp.revenue_event_id
  where rp.campaign_id = v_campaign_id
    and re.cleared = true
    and (rp.expires_at is null or rp.expires_at > now())
    and rp.funded_amount - rp.spent_amount >= v_amount
  order by rp.created_at
  limit 1
  for update of rp;

  if v_pool_id is null or v_available < v_amount then raise exception 'No cleared funded reward balance available'; end if;

  select id into v_wallet_id from public.wallets where owner_id = p_user_id;
  if v_wallet_id is null then raise exception 'Wallet not found'; end if;

  insert into public.ledger_entries(wallet_id, kind, amount, reason, source_type, source_id)
  values(v_wallet_id, 'credit', v_amount, 'Verified sponsored viewing reward', 'ad_event', p_ad_event_id::text)
  returning id into v_ledger_id;

  update public.reward_pools
  set spent_amount = spent_amount + v_amount
  where id = v_pool_id;

  insert into public.reward_claims(ad_event_id, user_id, reward_pool_id, ledger_entry_id, amount)
  values(p_ad_event_id, p_user_id, v_pool_id, v_ledger_id, v_amount)
  returning id into v_claim_id;

  return v_claim_id;
end;
$$;

revoke all on function public.claim_verified_ad_reward(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_verified_ad_reward(uuid, uuid) to service_role;
