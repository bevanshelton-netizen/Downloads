-- DOXA-SURE Broker Network schema draft
-- NOT FOR PRODUCTION EXECUTION until security review, RLS tests and function grants are completed.

create table if not exists public.doxa_brokerages (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text,
  fsp_number text,
  verification_status text not null default 'applied' check (verification_status in ('applied','verification_pending','verified','active','suspended','rejected','exited')),
  plan_code text not null default 'founding50' check (plan_code in ('founding50','network','pro','white_label','enterprise')),
  service_scope jsonb not null default '[]'::jsonb,
  provinces jsonb not null default '[]'::jsonb,
  customer_types jsonb not null default '[]'::jsonb,
  product_access jsonb not null default '[]'::jsonb,
  daily_lead_capacity integer not null default 0 check (daily_lead_capacity >= 0),
  current_open_leads integer not null default 0 check (current_open_leads >= 0),
  public_profile_enabled boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doxa_broker_users (
  id uuid primary key default gen_random_uuid(),
  brokerage_id uuid not null references public.doxa_brokerages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'broker_user' check (role in ('broker_admin','broker_user','compliance','viewer')),
  created_at timestamptz not null default now(),
  unique (brokerage_id,user_id)
);

create table if not exists public.doxa_match_requests (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid references auth.users(id) on delete set null,
  need_category text not null,
  province text,
  customer_type text,
  status text not null default 'new' check (status in ('new','matching','matched','accepted','declined','closed','cancelled')),
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doxa_broker_matches (
  id uuid primary key default gen_random_uuid(),
  match_request_id uuid not null references public.doxa_match_requests(id) on delete cascade,
  brokerage_id uuid not null references public.doxa_brokerages(id) on delete cascade,
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  rank_score numeric,
  status text not null default 'offered' check (status in ('offered','accepted','declined','expired','assigned','closed')),
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  assigned_at timestamptz,
  unique (match_request_id, brokerage_id)
);

create table if not exists public.doxa_match_events (
  id bigint generated always as identity primary key,
  match_request_id uuid not null references public.doxa_match_requests(id) on delete cascade,
  broker_match_id uuid references public.doxa_broker_matches(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.doxa_broker_service_metrics (
  brokerage_id uuid primary key references public.doxa_brokerages(id) on delete cascade,
  accepted_leads integer not null default 0,
  declined_leads integer not null default 0,
  avg_response_minutes numeric,
  unresolved_cases integer not null default 0,
  customer_satisfaction numeric,
  updated_at timestamptz not null default now()
);

create index if not exists doxa_brokerages_status_idx on public.doxa_brokerages(verification_status);
create index if not exists doxa_match_requests_status_idx on public.doxa_match_requests(status);
create index if not exists doxa_broker_matches_brokerage_idx on public.doxa_broker_matches(brokerage_id,status);

alter table public.doxa_brokerages enable row level security;
alter table public.doxa_broker_users enable row level security;
alter table public.doxa_match_requests enable row level security;
alter table public.doxa_broker_matches enable row level security;
alter table public.doxa_match_events enable row level security;
alter table public.doxa_broker_service_metrics enable row level security;

-- Customer can see their own match requests.
drop policy if exists doxa_customer_match_read on public.doxa_match_requests;
create policy doxa_customer_match_read on public.doxa_match_requests
for select to authenticated using (customer_user_id = auth.uid());

-- Broker users can read only their own brokerage profile.
drop policy if exists doxa_broker_profile_read on public.doxa_brokerages;
create policy doxa_broker_profile_read on public.doxa_brokerages
for select to authenticated using (
  exists (select 1 from public.doxa_broker_users u where u.brokerage_id = id and u.user_id = auth.uid())
);

-- Broker users can read their own tenant membership records.
drop policy if exists doxa_broker_user_read on public.doxa_broker_users;
create policy doxa_broker_user_read on public.doxa_broker_users
for select to authenticated using (user_id = auth.uid());

-- Broker users can read only matches offered to their brokerage.
drop policy if exists doxa_broker_match_read on public.doxa_broker_matches;
create policy doxa_broker_match_read on public.doxa_broker_matches
for select to authenticated using (
  exists (select 1 from public.doxa_broker_users u where u.brokerage_id = doxa_broker_matches.brokerage_id and u.user_id = auth.uid())
);

-- Broker users can read metrics only for their brokerage.
drop policy if exists doxa_broker_metrics_read on public.doxa_broker_service_metrics;
create policy doxa_broker_metrics_read on public.doxa_broker_service_metrics
for select to authenticated using (
  exists (select 1 from public.doxa_broker_users u where u.brokerage_id = doxa_broker_service_metrics.brokerage_id and u.user_id = auth.uid())
);

-- SECURITY TODO BEFORE EXECUTION:
-- 1. Add controlled insert/update RPCs instead of broad table grants.
-- 2. Revoke PUBLIC EXECUTE on every SECURITY DEFINER helper.
-- 3. Add customer visibility rules for assigned brokerage identity only after matching.
-- 4. Add admin/service-role workflows for verification without exposing privileged functions to clients.
-- 5. Test two different broker tenants plus two customers for cross-tenant leakage.
-- 6. Verify consent/POPIA basis and retention handling before real personal data.
-- 7. Do not store policy passwords, PINs, banking credentials or other authentication secrets.
