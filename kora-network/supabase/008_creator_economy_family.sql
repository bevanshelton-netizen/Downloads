-- KORA creator economy, payout onboarding and family profile layer.

alter table public.productions
  add column if not exists kids_approved boolean not null default false;

alter table public.watch_events
  add column if not exists viewer_profile_id uuid;

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  country_code text not null default 'ZA',
  creator_type text not null,
  languages text[] not null default '{}',
  portfolio_url text,
  pitch text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','accepted','declined','waitlisted')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.creator_deals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  deal_name text not null,
  version text not null,
  revenue_share_bps integer not null check (revenue_share_bps between 0 and 9000),
  revenue_basis text not null default 'eligible_net_content_revenue',
  status text not null default 'offered' check (status in ('offered','accepted','superseded','withdrawn')),
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(creator_id, version)
);

create table if not exists public.creator_revenue_allocations (
  id uuid primary key default gen_random_uuid(),
  revenue_event_id uuid not null references public.revenue_events(id) on delete restrict,
  production_id uuid not null references public.productions(id) on delete restrict,
  creator_id uuid not null references public.creators(id) on delete restrict,
  deal_id uuid not null references public.creator_deals(id) on delete restrict,
  eligible_amount numeric(14,2) not null check (eligible_amount > 0),
  creator_amount numeric(14,2) not null check (creator_amount >= 0),
  platform_amount numeric(14,2) not null check (platform_amount >= 0),
  ledger_entry_id uuid references public.ledger_entries(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(revenue_event_id, production_id)
);

create table if not exists public.payout_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  legal_name text not null,
  country_code text not null default 'ZA',
  preferred_method text not null default 'bank_eft' check (preferred_method in ('bank_eft','approved_provider')),
  provider text,
  provider_account_ref text,
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),
  status text not null default 'setup_required' check (status in ('setup_required','pending','verified','rejected','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.viewer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null,
  profile_kind text not null default 'adult' check (profile_kind in ('adult','child')),
  age_band text not null default 'adult' check (age_band in ('under_7','7_12','13_15','16_17','adult')),
  max_age_rating text not null default '18' check (max_age_rating in ('A','PG','13','16','18')),
  purchases_allowed boolean not null default true,
  rewards_allowed boolean not null default true,
  personalised_ads_allowed boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    profile_kind = 'adult'
    or (
      age_band <> 'adult'
      and purchases_allowed = false
      and rewards_allowed = false
      and personalised_ads_allowed = false
      and max_age_rating in ('A','PG','13','16')
    )
  )
);

create table if not exists public.family_pins (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.watch_events
  drop constraint if exists watch_events_viewer_profile_id_fkey;
alter table public.watch_events
  add constraint watch_events_viewer_profile_id_fkey
  foreign key (viewer_profile_id) references public.viewer_profiles(id) on delete set null;

alter table public.creator_applications enable row level security;
alter table public.creator_deals enable row level security;
alter table public.creator_revenue_allocations enable row level security;
alter table public.payout_profiles enable row level security;
alter table public.viewer_profiles enable row level security;
alter table public.family_pins enable row level security;

create policy "creator applicant reads own" on public.creator_applications
for select using (user_id = auth.uid() or public.is_staff());
create policy "creator applicant submits own" on public.creator_applications
for insert to authenticated with check (user_id = auth.uid() and status = 'submitted');
create policy "creator applicant updates own submitted" on public.creator_applications
for update using (user_id = auth.uid() and status = 'submitted')
with check (user_id = auth.uid() and status = 'submitted');
create policy "staff manages creator applications" on public.creator_applications
for all using (public.is_staff()) with check (public.is_staff());

create policy "creator reads own deals" on public.creator_deals
for select using (public.is_staff() or exists (
  select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()
));
create policy "staff manages creator deals" on public.creator_deals
for all using (public.is_staff()) with check (public.is_staff());

create policy "creator reads own revenue allocations" on public.creator_revenue_allocations
for select using (public.is_staff() or exists (
  select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()
));

create policy "owner reads payout profile" on public.payout_profiles
for select using (owner_id = auth.uid() or public.is_staff());
create policy "staff manages payout profiles" on public.payout_profiles
for all using (public.is_staff()) with check (public.is_staff());

create policy "owner reads family profiles" on public.viewer_profiles
for select using (owner_id = auth.uid());
create policy "owner deletes family profiles" on public.viewer_profiles
for delete using (owner_id = auth.uid());
create policy "owner reads family pin state" on public.family_pins
for select using (owner_id = auth.uid());

create index if not exists creator_applications_status_idx on public.creator_applications(status, created_at);
create index if not exists creator_deals_creator_status_idx on public.creator_deals(creator_id, status, offered_at desc);
create index if not exists creator_revenue_allocations_creator_idx on public.creator_revenue_allocations(creator_id, created_at desc);
create index if not exists viewer_profiles_owner_idx on public.viewer_profiles(owner_id, created_at);

create or replace function public.accept_creator_deal(p_deal_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_creator uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select creator_id into v_creator
  from public.creator_deals d
  where d.id = p_deal_id
    and d.status = 'offered'
    and exists(select 1 from public.creators c where c.id = d.creator_id and c.owner_id = v_user)
  for update;

  if v_creator is null then raise exception 'Deal is not available to this creator'; end if;

  update public.creator_deals
  set status = 'superseded'
  where creator_id = v_creator and status = 'accepted' and id <> p_deal_id;

  update public.creator_deals
  set status = 'accepted', accepted_at = now()
  where id = p_deal_id;

  return p_deal_id;
end;
$$;

revoke all on function public.accept_creator_deal(uuid) from public, anon;
grant execute on function public.accept_creator_deal(uuid) to authenticated;

-- Service-only allocation from an already-cleared revenue event to a production.
-- Creator identity and contractual percentage are derived by the database, not the client.
create or replace function public.allocate_creator_revenue(
  p_revenue_event_id uuid,
  p_production_id uuid,
  p_eligible_amount numeric
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_gross numeric;
  v_allocated numeric;
  v_creator_id uuid;
  v_deal_id uuid;
  v_share_bps integer;
  v_creator_amount numeric;
  v_platform_amount numeric;
  v_owner uuid;
  v_wallet uuid;
  v_ledger uuid;
  v_allocation uuid;
begin
  if p_eligible_amount <= 0 then raise exception 'Eligible amount must be positive'; end if;

  select gross_amount into v_gross
  from public.revenue_events
  where id = p_revenue_event_id and cleared = true
  for update;
  if v_gross is null then raise exception 'Cleared revenue event not found'; end if;

  if exists(select 1 from public.creator_revenue_allocations where revenue_event_id = p_revenue_event_id and production_id = p_production_id) then
    raise exception 'This revenue event is already allocated to this production';
  end if;

  select coalesce(sum(eligible_amount), 0) into v_allocated
  from public.creator_revenue_allocations
  where revenue_event_id = p_revenue_event_id;
  if v_allocated + p_eligible_amount > v_gross then raise exception 'Creator allocations exceed cleared revenue'; end if;

  select creator_id into v_creator_id from public.productions where id = p_production_id;
  if v_creator_id is null then raise exception 'Production not found'; end if;

  select id, revenue_share_bps into v_deal_id, v_share_bps
  from public.creator_deals
  where creator_id = v_creator_id and status = 'accepted'
  order by accepted_at desc nulls last, offered_at desc
  limit 1;
  if v_deal_id is null then raise exception 'Creator has no accepted revenue deal'; end if;

  select owner_id into v_owner from public.creators where id = v_creator_id;
  select id into v_wallet from public.wallets where owner_id = v_owner;
  if v_wallet is null then raise exception 'Creator wallet not found'; end if;

  v_creator_amount := round(p_eligible_amount * v_share_bps / 10000.0, 2);
  v_platform_amount := p_eligible_amount - v_creator_amount;

  if v_creator_amount > 0 then
    insert into public.ledger_entries(wallet_id, kind, amount, reason, source_type, source_id)
    values(v_wallet, 'credit', v_creator_amount, 'Creator revenue share', 'creator_allocation', p_revenue_event_id::text || ':' || p_production_id::text)
    returning id into v_ledger;
  end if;

  insert into public.creator_revenue_allocations(
    revenue_event_id, production_id, creator_id, deal_id, eligible_amount, creator_amount, platform_amount, ledger_entry_id
  ) values (
    p_revenue_event_id, p_production_id, v_creator_id, v_deal_id, p_eligible_amount, v_creator_amount, v_platform_amount, v_ledger
  ) returning id into v_allocation;

  return v_allocation;
end;
$$;

revoke all on function public.allocate_creator_revenue(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.allocate_creator_revenue(uuid, uuid, numeric) to service_role;

-- Users submit payout identity/preferences; payout-provider references and verification status remain staff-controlled.
create or replace function public.submit_payout_profile(
  p_legal_name text,
  p_country_code text,
  p_preferred_method text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if length(trim(p_legal_name)) < 2 then raise exception 'Legal name is required'; end if;
  if p_country_code !~ '^[A-Z]{2}$' then raise exception 'Country code must use two letters'; end if;
  if p_preferred_method not in ('bank_eft','approved_provider') then raise exception 'Unsupported payout method'; end if;

  insert into public.payout_profiles(owner_id, legal_name, country_code, preferred_method, status, updated_at)
  values(v_user, trim(p_legal_name), upper(p_country_code), p_preferred_method, 'pending', now())
  on conflict (owner_id) do update set
    legal_name = excluded.legal_name,
    country_code = excluded.country_code,
    preferred_method = excluded.preferred_method,
    status = case when public.payout_profiles.status = 'verified' then 'verified' else 'pending' end,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.submit_payout_profile(text, text, text) from public, anon;
grant execute on function public.submit_payout_profile(text, text, text) to authenticated;

-- Replace the earlier payout request function with an additional verified payout-profile gate.
create or replace function public.request_wallet_payout(p_amount numeric)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_wallet uuid;
  v_balance numeric;
  v_request uuid;
  v_kyc text;
  v_payout_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount < 100 then raise exception 'Minimum payout is R100'; end if;

  select kyc_status into v_kyc from public.profiles where id = v_user;
  if v_kyc <> 'verified' then raise exception 'Identity verification is required before payout'; end if;

  select status into v_payout_status from public.payout_profiles where owner_id = v_user;
  if v_payout_status <> 'verified' then raise exception 'Verified payout onboarding is required before payout'; end if;

  select id into v_wallet from public.wallets where owner_id = v_user for update;
  if v_wallet is null then raise exception 'Wallet not found'; end if;

  select coalesce(sum(case when kind='credit' then amount else -amount end),0)
  into v_balance
  from public.ledger_entries where wallet_id = v_wallet;

  if v_balance < p_amount then raise exception 'Insufficient available balance'; end if;

  insert into public.payout_requests(wallet_id, amount, status)
  values(v_wallet, p_amount, 'pending') returning id into v_request;

  insert into public.ledger_entries(wallet_id, kind, amount, reason, source_type, source_id)
  values(v_wallet, 'debit', p_amount, 'Payout hold', 'payout_request', v_request::text);

  return v_request;
end;
$$;

revoke all on function public.request_wallet_payout(numeric) from public, anon;
grant execute on function public.request_wallet_payout(numeric) to authenticated;

-- Service-only payout resolution. Rejected payouts return the held amount exactly once.
create or replace function public.resolve_payout_request(p_request_id uuid, p_decision text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet uuid;
  v_amount numeric;
  v_status text;
begin
  if p_decision not in ('paid','rejected') then raise exception 'Invalid payout decision'; end if;

  select wallet_id, amount, status into v_wallet, v_amount, v_status
  from public.payout_requests where id = p_request_id for update;
  if v_wallet is null then raise exception 'Payout request not found'; end if;
  if v_status <> 'pending' then raise exception 'Payout request is already resolved'; end if;

  update public.payout_requests
  set status = p_decision, processed_at = now()
  where id = p_request_id;

  if p_decision = 'rejected' then
    insert into public.ledger_entries(wallet_id, kind, amount, reason, source_type, source_id)
    values(v_wallet, 'credit', v_amount, 'Rejected payout hold released', 'payout_reversal', p_request_id::text);
  end if;

  return p_request_id;
end;
$$;

revoke all on function public.resolve_payout_request(uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_payout_request(uuid, text) to service_role;

-- Parent-managed profiles minimise child data: nickname + age band, never exact date of birth.
create or replace function public.create_viewer_profile(
  p_nickname text,
  p_profile_kind text,
  p_age_band text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_rating text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if length(trim(p_nickname)) < 1 or length(trim(p_nickname)) > 40 then raise exception 'Profile nickname is required'; end if;
  if p_profile_kind not in ('adult','child') then raise exception 'Invalid profile type'; end if;

  if p_profile_kind = 'adult' then
    p_age_band := 'adult';
    v_rating := '18';
  else
    if p_age_band not in ('under_7','7_12','13_15','16_17') then raise exception 'Choose a child age band'; end if;
    v_rating := case p_age_band
      when 'under_7' then 'A'
      when '7_12' then 'PG'
      when '13_15' then '13'
      else '16'
    end;
  end if;

  insert into public.viewer_profiles(
    owner_id, nickname, profile_kind, age_band, max_age_rating,
    purchases_allowed, rewards_allowed, personalised_ads_allowed
  ) values (
    v_user, trim(p_nickname), p_profile_kind, p_age_band, v_rating,
    p_profile_kind = 'adult', p_profile_kind = 'adult', p_profile_kind = 'adult'
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_viewer_profile(text, text, text) from public, anon;
grant execute on function public.create_viewer_profile(text, text, text) to authenticated;

create or replace function public.set_family_pin(p_pin text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4 to 6 digits'; end if;

  insert into public.family_pins(owner_id, pin_hash, updated_at)
  values(v_user, crypt(p_pin, gen_salt('bf')), now())
  on conflict (owner_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  return true;
end;
$$;

create or replace function public.verify_family_pin(p_pin text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists(
    select 1 from public.family_pins
    where owner_id = auth.uid() and pin_hash = crypt(p_pin, pin_hash)
  );
$$;

revoke all on function public.set_family_pin(text) from public, anon;
revoke all on function public.verify_family_pin(text) from public, anon;
grant execute on function public.set_family_pin(text) to authenticated;
grant execute on function public.verify_family_pin(text) to authenticated;
