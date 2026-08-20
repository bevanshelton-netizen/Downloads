-- KORA FRESH PRODUCTION INSTALLER
-- Use this file ONLY on a brand-new KORA Production Supabase project.
-- It combines schema.sql and migrations 002 through 009 in one transaction.
-- Do not run this after any individual KORA migration has already been applied.

begin;

-- ============================================================
-- 1) BASE SCHEMA
-- ============================================================
create extension if not exists pgcrypto;
create type public.user_role as enum ('viewer','creator','advertiser','moderator','admin');
create type public.content_status as enum ('draft','review','published','rejected','archived');
create type public.ledger_kind as enum ('credit','debit');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'viewer',
  display_name text,
  country_code text default 'ZA',
  created_at timestamptz not null default now()
);
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  bio text,
  verified boolean not null default false,
  payout_status text not null default 'unverified',
  created_at timestamptz not null default now()
);
create table public.productions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  title text not null,
  slug text unique not null,
  synopsis text,
  genre text,
  primary_language text,
  age_rating text,
  status public.content_status not null default 'draft',
  explicit_sexual_content boolean not null default false,
  created_at timestamptz not null default now(),
  constraint pornography_block check (explicit_sexual_content = false)
);
create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  episode_number int not null,
  title text not null,
  duration_seconds int not null default 0,
  playback_id text,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  unique(production_id, episode_number)
);
create table public.live_channels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  description text,
  is_active boolean not null default true
);
create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.live_channels(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);
create table public.watch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  episode_id uuid references public.episodes(id) on delete set null,
  event_type text not null,
  seconds_watched int not null default 0,
  session_id text,
  created_at timestamptz not null default now()
);
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique not null references public.profiles(id) on delete cascade,
  currency char(3) not null default 'ZAR',
  created_at timestamptz not null default now()
);
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  kind public.ledger_kind not null,
  amount numeric(14,2) not null check (amount > 0),
  reason text not null,
  source_type text,
  source_id text,
  created_at timestamptz not null default now()
);
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  budget numeric(14,2) not null check (budget >= 0),
  reward_pool numeric(14,2) not null default 0 check (reward_pool >= 0 and reward_pool <= budget),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft'
);
create table public.ad_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  production_id uuid references public.productions(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  check (production_id is not null or episode_id is not null)
);

alter table public.profiles enable row level security;
alter table public.creators enable row level security;
alter table public.productions enable row level security;
alter table public.episodes enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
create policy "public published productions" on public.productions for select using (status='published');
create policy "public published episodes" on public.episodes for select using (status='published');
create policy "profile owns self" on public.profiles for select using (auth.uid()=id);
create policy "wallet owner reads" on public.wallets for select using (owner_id=auth.uid());
create policy "ledger owner reads" on public.ledger_entries for select using (exists(select 1 from public.wallets w where w.id=wallet_id and w.owner_id=auth.uid()));

insert into public.live_channels(name,slug,description) values
('KORA One','kora-one','Flagship African entertainment'),
('KORA Drama','kora-drama','African drama around the clock'),
('KORA Family','kora-family','Family-safe entertainment'),
('KORA Faith','kora-faith','Faith, values and inspiration'),
('KORA Music','kora-music','Music, performance and culture'),
('KORA Kids','kora-kids','Curated programming for children'),
('KORA Creators','kora-creators','Independent African creator showcase')
on conflict do nothing;

-- ============================================================
-- 2) PLATFORM CORE
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.wallets (owner_id) values (new.id) on conflict (owner_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator','admin')); $$;

alter table public.live_channels enable row level security;
alter table public.schedule_items enable row level security;
alter table public.watch_events enable row level security;
alter table public.campaigns enable row level security;
alter table public.ad_events enable row level security;
alter table public.content_reports enable row level security;
create policy "profiles update self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "public creator profiles" on public.creators for select using (verified or owner_id = auth.uid() or public.is_staff());
create policy "creator creates self" on public.creators for insert with check (owner_id = auth.uid());
create policy "creator updates self" on public.creators for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "creator reads own productions" on public.productions for select using (status = 'published' or public.is_staff() or exists (select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()));
create policy "creator inserts own productions" on public.productions for insert with check (exists (select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()));
create policy "creator updates own productions" on public.productions for update using (exists (select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid())) with check (exists (select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()));
create policy "creator reads own episodes" on public.episodes for select using (status = 'published' or public.is_staff() or exists (select 1 from public.productions p join public.creators c on c.id = p.creator_id where p.id = production_id and c.owner_id = auth.uid()));
create policy "creator inserts own episodes" on public.episodes for insert with check (exists (select 1 from public.productions p join public.creators c on c.id = p.creator_id where p.id = production_id and c.owner_id = auth.uid()));
create policy "creator updates own episodes" on public.episodes for update using (exists (select 1 from public.productions p join public.creators c on c.id = p.creator_id where p.id = production_id and c.owner_id = auth.uid()));
create policy "public active channels" on public.live_channels for select using (is_active);
create policy "public schedule" on public.schedule_items for select using (true);
create policy "staff manages channels" on public.live_channels for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manages schedule" on public.schedule_items for all using (public.is_staff()) with check (public.is_staff());
create policy "authenticated records watch events" on public.watch_events for insert to authenticated with check (user_id = auth.uid());
create policy "viewer reads own watch events" on public.watch_events for select using (user_id = auth.uid() or public.is_staff());
create policy "advertiser owns campaigns" on public.campaigns for all using (advertiser_id = auth.uid() or public.is_staff()) with check (advertiser_id = auth.uid() or public.is_staff());
create policy "advertiser reads campaign events" on public.ad_events for select using (public.is_staff() or exists (select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()));
create policy "authenticated creates reports" on public.content_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "staff manages reports" on public.content_reports for all using (public.is_staff()) with check (public.is_staff());

create table if not exists public.upload_assets (
  id uuid primary key default gen_random_uuid(), episode_id uuid not null references public.episodes(id) on delete cascade,
  provider text not null, provider_asset_id text, upload_status text not null default 'pending',
  moderation_status text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists public.moderation_reviews (
  id uuid primary key default gen_random_uuid(), production_id uuid references public.productions(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade, reviewer_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in ('approved','rejected','needs_changes')), reason text,
  created_at timestamptz not null default now(), check (production_id is not null or episode_id is not null)
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'payfast', provider_subscription_id text, plan_code text not null,
  status text not null default 'pending', current_period_end timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
  production_id uuid references public.productions(id) on delete restrict, episode_id uuid references public.episodes(id) on delete restrict,
  amount numeric(14,2) not null check (amount >= 0), currency char(3) not null default 'ZAR', provider text not null default 'payfast',
  provider_payment_id text, status text not null default 'pending', created_at timestamptz not null default now(),
  check (production_id is not null or episode_id is not null)
);
create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(), source_type text not null, source_id text,
  gross_amount numeric(14,2) not null check (gross_amount >= 0), currency char(3) not null default 'ZAR',
  cleared boolean not null default false, cleared_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.reward_pools (
  id uuid primary key default gen_random_uuid(), revenue_event_id uuid not null references public.revenue_events(id) on delete restrict,
  funded_amount numeric(14,2) not null check (funded_amount >= 0), spent_amount numeric(14,2) not null default 0 check (spent_amount >= 0 and spent_amount <= funded_amount),
  expires_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(), wallet_id uuid not null references public.wallets(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0), status text not null default 'pending',
  requested_at timestamptz not null default now(), processed_at timestamptz
);

alter table public.upload_assets enable row level security;
alter table public.moderation_reviews enable row level security;
alter table public.subscriptions enable row level security;
alter table public.purchases enable row level security;
alter table public.revenue_events enable row level security;
alter table public.reward_pools enable row level security;
alter table public.payout_requests enable row level security;
create policy "creator owns upload assets" on public.upload_assets for select using (public.is_staff() or exists (select 1 from public.episodes e join public.productions p on p.id = e.production_id join public.creators c on c.id = p.creator_id where e.id = episode_id and c.owner_id = auth.uid()));
create policy "staff moderation" on public.moderation_reviews for all using (public.is_staff()) with check (public.is_staff());
create policy "viewer reads own subscriptions" on public.subscriptions for select using (user_id = auth.uid() or public.is_staff());
create policy "viewer reads own purchases" on public.purchases for select using (user_id = auth.uid() or public.is_staff());
create policy "wallet owner payout requests" on public.payout_requests for select using (public.is_staff() or exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid()));

create or replace function public.credit_verified_reward(p_user_id uuid,p_pool_id uuid,p_amount numeric,p_reason text,p_source_id text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_wallet uuid; v_available numeric; v_entry uuid;
begin
  if p_amount <= 0 then raise exception 'Reward amount must be positive'; end if;
  select funded_amount - spent_amount into v_available from public.reward_pools rp join public.revenue_events re on re.id = rp.revenue_event_id where rp.id = p_pool_id and re.cleared = true for update of rp;
  if v_available is null or v_available < p_amount then raise exception 'Insufficient cleared reward funding'; end if;
  select id into v_wallet from public.wallets where owner_id = p_user_id;
  if v_wallet is null then raise exception 'Wallet not found'; end if;
  insert into public.ledger_entries(wallet_id,kind,amount,reason,source_type,source_id) values(v_wallet,'credit',p_amount,p_reason,'reward_pool',coalesce(p_source_id,p_pool_id::text)) returning id into v_entry;
  update public.reward_pools set spent_amount = spent_amount + p_amount where id = p_pool_id;
  return v_entry;
end;$$;
revoke all on function public.credit_verified_reward(uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.credit_verified_reward(uuid,uuid,numeric,text,text) to service_role;

-- ============================================================
-- 3) PAYMENT HARDENING
-- ============================================================
create unique index if not exists revenue_events_source_unique on public.revenue_events(source_type,source_id) where source_id is not null;

-- ============================================================
-- 4) CONTENT COMMERCE
-- ============================================================
alter table public.productions add column if not exists access_mode text not null default 'ad_supported' check (access_mode in ('free','ad_supported','premium','pay_per_view')), add column if not exists purchase_price numeric(14,2) check (purchase_price is null or purchase_price >= 0), add column if not exists poster_url text;
alter table public.episodes add column if not exists vertical boolean not null default false;
create table if not exists public.creator_earnings (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.creators(id) on delete restrict,
  revenue_event_id uuid references public.revenue_events(id) on delete restrict, production_id uuid references public.productions(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0), currency char(3) not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending','available','paid','reversed')), created_at timestamptz not null default now()
);
alter table public.creator_earnings enable row level security;
create policy "creator reads own earnings" on public.creator_earnings for select using (public.is_staff() or exists (select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()));

-- ============================================================
-- 5) PAYOUTS / KYC
-- ============================================================
alter table public.profiles add column if not exists kyc_status text not null default 'unverified' check (kyc_status in ('unverified','pending','verified','rejected'));
create or replace function public.request_wallet_payout(p_amount numeric)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid(); v_wallet uuid; v_balance numeric; v_request uuid; v_kyc text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount < 100 then raise exception 'Minimum payout is R100'; end if;
  select kyc_status into v_kyc from public.profiles where id = v_user;
  if v_kyc <> 'verified' then raise exception 'Identity verification is required before payout'; end if;
  select id into v_wallet from public.wallets where owner_id = v_user for update;
  if v_wallet is null then raise exception 'Wallet not found'; end if;
  select coalesce(sum(case when kind='credit' then amount else -amount end),0) into v_balance from public.ledger_entries where wallet_id = v_wallet;
  if v_balance < p_amount then raise exception 'Insufficient available balance'; end if;
  insert into public.payout_requests(wallet_id,amount,status) values(v_wallet,p_amount,'pending') returning id into v_request;
  insert into public.ledger_entries(wallet_id,kind,amount,reason,source_type,source_id) values(v_wallet,'debit',p_amount,'Payout hold','payout_request',v_request::text);
  return v_request;
end;$$;
revoke all on function public.request_wallet_payout(numeric) from public,anon;
grant execute on function public.request_wallet_payout(numeric) to authenticated;
create policy "wallet owner creates payout request" on public.payout_requests for insert to authenticated with check (exists (select 1 from public.wallets w where w.id=wallet_id and w.owner_id=auth.uid()));

-- ============================================================
-- 6) BROADCAST + VERIFIED REWARDS
-- ============================================================
alter table public.live_channels add column if not exists playback_url text, add column if not exists logo_url text, add column if not exists is_family_safe boolean not null default true, add column if not exists display_order integer not null default 100;
update public.live_channels set display_order = case slug when 'kora-one' then 1 when 'kora-drama' then 2 when 'kora-family' then 3 when 'kora-faith' then 4 when 'kora-music' then 5 when 'kora-kids' then 6 when 'kora-creators' then 7 else 100 end;
alter table public.schedule_items add column if not exists sponsor_name text, add column if not exists is_premiere boolean not null default false;
alter table public.campaigns add column if not exists reward_per_completion numeric(14,2) not null default 0 check (reward_per_completion >= 0);
alter table public.reward_pools add column if not exists campaign_id uuid references public.campaigns(id) on delete restrict;
create index if not exists schedule_items_channel_window_idx on public.schedule_items(channel_id,starts_at,ends_at);
create index if not exists reward_pools_campaign_idx on public.reward_pools(campaign_id);
create index if not exists ad_events_user_campaign_idx on public.ad_events(user_id,campaign_id,created_at desc);
create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(), ad_event_id uuid not null unique references public.ad_events(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict, reward_pool_id uuid not null references public.reward_pools(id) on delete restrict,
  ledger_entry_id uuid not null unique references public.ledger_entries(id) on delete restrict, amount numeric(14,2) not null check (amount > 0), created_at timestamptz not null default now()
);
alter table public.reward_claims enable row level security;
create policy "viewer reads own reward claims" on public.reward_claims for select using (user_id=auth.uid() or public.is_staff());
create or replace function public.fund_campaign_from_cleared_revenue(p_campaign_id uuid,p_gross_amount numeric,p_reward_amount numeric)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_budget numeric; v_planned_reward numeric; v_existing_gross numeric; v_existing_reward numeric; v_revenue_id uuid; v_pool_id uuid;
begin
  if p_gross_amount <= 0 then raise exception 'Gross cleared amount must be positive'; end if;
  if p_reward_amount < 0 or p_reward_amount > p_gross_amount then raise exception 'Invalid reward funding amount'; end if;
  select budget,reward_pool into v_budget,v_planned_reward from public.campaigns where id=p_campaign_id for update;
  if v_budget is null then raise exception 'Campaign not found'; end if;
  select coalesce(sum(gross_amount),0) into v_existing_gross from public.revenue_events where source_type='campaign' and source_id=p_campaign_id::text and cleared=true;
  select coalesce(sum(funded_amount),0) into v_existing_reward from public.reward_pools where campaign_id=p_campaign_id;
  if v_existing_gross+p_gross_amount>v_budget then raise exception 'Cumulative cleared amount exceeds campaign budget'; end if;
  if v_existing_reward+p_reward_amount>v_planned_reward then raise exception 'Cumulative reward funding exceeds campaign reward allocation'; end if;
  insert into public.revenue_events(source_type,source_id,gross_amount,currency,cleared,cleared_at) values('campaign',p_campaign_id::text,p_gross_amount,'ZAR',true,now()) returning id into v_revenue_id;
  if p_reward_amount>0 then insert into public.reward_pools(revenue_event_id,campaign_id,funded_amount) values(v_revenue_id,p_campaign_id,p_reward_amount) returning id into v_pool_id; end if;
  update public.campaigns set status='active' where id=p_campaign_id;
  return coalesce(v_pool_id,v_revenue_id);
end;$$;
revoke all on function public.fund_campaign_from_cleared_revenue(uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.fund_campaign_from_cleared_revenue(uuid,numeric,numeric) to service_role;

create or replace function public.claim_verified_ad_reward(p_user_id uuid,p_ad_event_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_campaign_id uuid; v_verified boolean; v_event_type text; v_event_user uuid; v_amount numeric; v_pool_id uuid; v_available numeric; v_wallet_id uuid; v_ledger_id uuid; v_claim_id uuid;
begin
  if exists(select 1 from public.reward_claims where ad_event_id=p_ad_event_id) then raise exception 'Reward already claimed'; end if;
  select campaign_id,verified,event_type,user_id into v_campaign_id,v_verified,v_event_type,v_event_user from public.ad_events where id=p_ad_event_id for update;
  if v_campaign_id is null then raise exception 'Ad event not found'; end if;
  if v_event_user is distinct from p_user_id then raise exception 'Ad event does not belong to user'; end if;
  if v_verified is not true or v_event_type<>'complete' then raise exception 'Ad completion is not verified'; end if;
  select reward_per_completion into v_amount from public.campaigns where id=v_campaign_id and status in ('active','completed');
  if v_amount is null or v_amount<=0 then raise exception 'Campaign has no completion reward'; end if;
  select rp.id,rp.funded_amount-rp.spent_amount into v_pool_id,v_available from public.reward_pools rp join public.revenue_events re on re.id=rp.revenue_event_id where rp.campaign_id=v_campaign_id and re.cleared=true and (rp.expires_at is null or rp.expires_at>now()) and rp.funded_amount-rp.spent_amount>=v_amount order by rp.created_at limit 1 for update of rp;
  if v_pool_id is null or v_available<v_amount then raise exception 'No cleared funded reward balance available'; end if;
  select id into v_wallet_id from public.wallets where owner_id=p_user_id;
  if v_wallet_id is null then raise exception 'Wallet not found'; end if;
  insert into public.ledger_entries(wallet_id,kind,amount,reason,source_type,source_id) values(v_wallet_id,'credit',v_amount,'Verified sponsored viewing reward','ad_event',p_ad_event_id::text) returning id into v_ledger_id;
  update public.reward_pools set spent_amount=spent_amount+v_amount where id=v_pool_id;
  insert into public.reward_claims(ad_event_id,user_id,reward_pool_id,ledger_entry_id,amount) values(p_ad_event_id,p_user_id,v_pool_id,v_ledger_id,v_amount) returning id into v_claim_id;
  return v_claim_id;
end;$$;
revoke all on function public.claim_verified_ad_reward(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_verified_ad_reward(uuid,uuid) to service_role;

-- ============================================================
-- 7) TRUST + RIGHTS
-- ============================================================
create table if not exists public.agreement_acceptances (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  document_code text not null, document_version text not null, accepted_at timestamptz not null default now(), unique(user_id,document_code,document_version)
);
create table if not exists public.production_rights_declarations (
  id uuid primary key default gen_random_uuid(), production_id uuid not null unique references public.productions(id) on delete cascade,
  declarant_id uuid not null references public.profiles(id) on delete restrict, creator_terms_version text not null,
  owns_or_controls_rights boolean not null, contributor_permissions_confirmed boolean not null,
  music_permissions_confirmed boolean not null, likeness_permissions_confirmed boolean not null, content_policy_confirmed boolean not null,
  declared_at timestamptz not null default now(),
  check (owns_or_controls_rights and contributor_permissions_confirmed and music_permissions_confirmed and likeness_permissions_confirmed and content_policy_confirmed)
);
create table if not exists public.rights_disputes (
  id uuid primary key default gen_random_uuid(), production_id uuid references public.productions(id) on delete set null,
  episode_id uuid references public.episodes(id) on delete set null, claimant_name text not null, claimant_email text not null,
  rights_basis text not null, evidence_reference text, good_faith_statement boolean not null default false,
  status text not null default 'open', created_at timestamptz not null default now(), resolved_at timestamptz,
  check (production_id is not null or episode_id is not null)
);
alter table public.agreement_acceptances enable row level security;
alter table public.production_rights_declarations enable row level security;
alter table public.rights_disputes enable row level security;
create policy "user reads own acceptances" on public.agreement_acceptances for select using (user_id=auth.uid() or public.is_staff());
create policy "user records own acceptances" on public.agreement_acceptances for insert to authenticated with check (user_id=auth.uid());
create policy "creator reads own rights declarations" on public.production_rights_declarations for select using (public.is_staff() or exists(select 1 from public.productions p join public.creators c on c.id=p.creator_id where p.id=production_id and c.owner_id=auth.uid()));
create policy "creator inserts own rights declarations" on public.production_rights_declarations for insert to authenticated with check (declarant_id=auth.uid() and exists(select 1 from public.productions p join public.creators c on c.id=p.creator_id where p.id=production_id and c.owner_id=auth.uid()));
create policy "staff manages rights disputes" on public.rights_disputes for all using (public.is_staff()) with check (public.is_staff());
create index if not exists agreement_acceptances_user_doc_idx on public.agreement_acceptances(user_id,document_code,document_version);
create index if not exists rights_disputes_status_idx on public.rights_disputes(status,created_at);
create or replace function public.handle_signup_legal_acceptance()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_terms text; v_privacy text;
begin
  v_terms:=nullif(new.raw_user_meta_data->>'platform_terms_version','');
  v_privacy:=nullif(new.raw_user_meta_data->>'privacy_notice_version','');
  if v_terms is not null then insert into public.agreement_acceptances(user_id,document_code,document_version) values(new.id,'platform_terms',v_terms) on conflict do nothing; end if;
  if v_privacy is not null then insert into public.agreement_acceptances(user_id,document_code,document_version) values(new.id,'privacy_notice',v_privacy) on conflict do nothing; end if;
  return new;
end;$$;
drop trigger if exists zz_on_auth_legal_acceptance on auth.users;
create trigger zz_on_auth_legal_acceptance after insert on auth.users for each row execute procedure public.handle_signup_legal_acceptance();

-- ============================================================
-- 8) LAUNCH HARDENING
-- ============================================================
revoke update on table public.profiles from authenticated;
grant update (display_name,country_code) on table public.profiles to authenticated;
revoke insert,update,delete on table public.creators from authenticated;
grant insert (owner_id,name,bio) on table public.creators to authenticated;
grant update (name,bio) on table public.creators to authenticated;
revoke insert,update,delete on table public.productions from authenticated;
grant insert (creator_id,title,slug,synopsis,genre,primary_language,age_rating,explicit_sexual_content,access_mode,purchase_price,poster_url) on table public.productions to authenticated;
grant update (title,slug,synopsis,genre,primary_language,age_rating,explicit_sexual_content,access_mode,purchase_price,poster_url) on table public.productions to authenticated;
revoke insert,update,delete on table public.episodes from authenticated;
grant insert (production_id,episode_number,title,duration_seconds,vertical) on table public.episodes to authenticated;
grant update (episode_number,title,duration_seconds,vertical) on table public.episodes to authenticated;
revoke insert,update,delete on table public.campaigns from authenticated;
grant insert (advertiser_id,name,budget,reward_pool,reward_per_completion,starts_at,ends_at) on table public.campaigns to authenticated;
grant update (name,budget,reward_pool,reward_per_completion,starts_at,ends_at) on table public.campaigns to authenticated;
drop policy if exists "wallet owner creates payout request" on public.payout_requests;
revoke insert,update,delete on table public.payout_requests from authenticated;
drop index if exists public.revenue_events_source_unique;
create unique index revenue_events_source_unique on public.revenue_events(source_type,source_id);
create unique index if not exists subscriptions_provider_subscription_unique on public.subscriptions(provider,provider_subscription_id) where provider_subscription_id is not null;
create unique index if not exists purchases_provider_payment_unique on public.purchases(provider,provider_payment_id) where provider_payment_id is not null;

create or replace function public.fund_campaign_from_cleared_revenue(p_campaign_id uuid,p_gross_amount numeric,p_reward_amount numeric)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_budget numeric; v_planned_reward numeric; v_existing_gross numeric:=0; v_existing_reward numeric:=0; v_revenue_id uuid; v_pool_id uuid;
begin
  if p_gross_amount<=0 then raise exception 'Gross cleared amount must be positive'; end if;
  if p_reward_amount<0 or p_reward_amount>p_gross_amount then raise exception 'Invalid reward funding amount'; end if;
  select budget,reward_pool into v_budget,v_planned_reward from public.campaigns where id=p_campaign_id for update;
  if v_budget is null then raise exception 'Campaign not found'; end if;
  select id,gross_amount into v_revenue_id,v_existing_gross from public.revenue_events where source_type='campaign' and source_id=p_campaign_id::text for update;
  v_existing_gross:=coalesce(v_existing_gross,0);
  select coalesce(sum(funded_amount),0) into v_existing_reward from public.reward_pools where campaign_id=p_campaign_id;
  if v_existing_gross+p_gross_amount>v_budget then raise exception 'Cumulative cleared amount exceeds campaign budget'; end if;
  if v_existing_reward+p_reward_amount>v_planned_reward then raise exception 'Cumulative reward funding exceeds campaign reward allocation'; end if;
  if v_revenue_id is null then
    insert into public.revenue_events(source_type,source_id,gross_amount,currency,cleared,cleared_at) values('campaign',p_campaign_id::text,p_gross_amount,'ZAR',true,now()) returning id into v_revenue_id;
  else
    update public.revenue_events set gross_amount=gross_amount+p_gross_amount,cleared=true,cleared_at=now() where id=v_revenue_id;
  end if;
  if p_reward_amount>0 then insert into public.reward_pools(revenue_event_id,campaign_id,funded_amount) values(v_revenue_id,p_campaign_id,p_reward_amount) returning id into v_pool_id; end if;
  update public.campaigns set status='active' where id=p_campaign_id;
  return coalesce(v_pool_id,v_revenue_id);
end;$$;
revoke all on function public.fund_campaign_from_cleared_revenue(uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.fund_campaign_from_cleared_revenue(uuid,numeric,numeric) to service_role;

create or replace function public.allocate_creator_earning(p_creator_id uuid,p_revenue_event_id uuid,p_amount numeric,p_production_id uuid default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_gross numeric; v_cleared boolean; v_creator_allocated numeric; v_reward_funded numeric; v_owner_id uuid; v_wallet_id uuid; v_earning_id uuid;
begin
  if p_amount<=0 then raise exception 'Creator earning amount must be positive'; end if;
  select gross_amount,cleared into v_gross,v_cleared from public.revenue_events where id=p_revenue_event_id for update;
  if v_gross is null then raise exception 'Revenue event not found'; end if;
  if v_cleared is not true then raise exception 'Revenue must be cleared before creator allocation'; end if;
  select owner_id into v_owner_id from public.creators where id=p_creator_id;
  if v_owner_id is null then raise exception 'Creator not found'; end if;
  if p_production_id is not null and not exists(select 1 from public.productions where id=p_production_id and creator_id=p_creator_id) then raise exception 'Production does not belong to creator'; end if;
  select coalesce(sum(amount),0) into v_creator_allocated from public.creator_earnings where revenue_event_id=p_revenue_event_id and status<>'reversed';
  select coalesce(sum(funded_amount),0) into v_reward_funded from public.reward_pools where revenue_event_id=p_revenue_event_id;
  if v_creator_allocated+v_reward_funded+p_amount>v_gross then raise exception 'Allocation exceeds cleared revenue available'; end if;
  select id into v_wallet_id from public.wallets where owner_id=v_owner_id;
  if v_wallet_id is null then raise exception 'Creator wallet not found'; end if;
  insert into public.creator_earnings(creator_id,revenue_event_id,production_id,amount,currency,status) values(p_creator_id,p_revenue_event_id,p_production_id,p_amount,'ZAR','available') returning id into v_earning_id;
  insert into public.ledger_entries(wallet_id,kind,amount,reason,source_type,source_id) values(v_wallet_id,'credit',p_amount,'Creator revenue share','creator_earning',v_earning_id::text);
  return v_earning_id;
end;$$;
revoke all on function public.allocate_creator_earning(uuid,uuid,numeric,uuid) from public,anon,authenticated;
grant execute on function public.allocate_creator_earning(uuid,uuid,numeric,uuid) to service_role;

-- ============================================================
-- 9) SUBSCRIPTION LIFECYCLE
-- ============================================================
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;

commit;
