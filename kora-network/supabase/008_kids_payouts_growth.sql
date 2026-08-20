-- KORA Phase 5: family profiles, creator KYC/payout controls and creator recruitment.

create table if not exists public.family_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  profile_type text not null default 'adult' check (profile_type in ('adult','teen','child')),
  max_age_rating text not null default 'PG' check (max_age_rating in ('A','PG','13','16','18')),
  purchases_allowed boolean not null default false,
  rewards_allowed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.parental_pins (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_kyc (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  legal_name text not null,
  entity_type text not null check (entity_type in ('individual','sole_proprietor','company','nonprofit','other')),
  country_code char(2) not null default 'ZA',
  identity_reference text,
  company_registration text,
  tax_reference text,
  bank_account_name text,
  bank_name text,
  bank_account_last4 char(4),
  status text not null default 'not_submitted' check (status in ('not_submitted','submitted','needs_changes','verified','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  creator_name text not null,
  city text,
  country_code char(2) not null default 'ZA',
  creator_type text not null,
  portfolio_url text,
  audience_summary text,
  pitch text not null,
  status text not null default 'submitted' check (status in ('submitted','review','accepted','declined','waitlist')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.family_profiles enable row level security;
alter table public.parental_pins enable row level security;
alter table public.creator_kyc enable row level security;
alter table public.creator_applications enable row level security;

create policy "family owner manages profiles" on public.family_profiles
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "parent manages pin" on public.parental_pins
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "creator reads own kyc" on public.creator_kyc
for select using (
  public.is_staff() or exists (select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid())
);
create policy "creator submits own kyc" on public.creator_kyc
for insert to authenticated with check (
  exists (select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid())
);
create policy "creator updates unverified kyc" on public.creator_kyc
for update using (
  exists (select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()) and status in ('not_submitted','needs_changes')
) with check (
  exists (select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid())
);
create policy "staff manages kyc" on public.creator_kyc
for all using (public.is_staff()) with check (public.is_staff());

create policy "applicant manages own creator application" on public.creator_applications
for select using (user_id = auth.uid() or public.is_staff());
create policy "applicant creates own creator application" on public.creator_applications
for insert to authenticated with check (user_id = auth.uid());
create policy "staff manages creator applications" on public.creator_applications
for all using (public.is_staff()) with check (public.is_staff());

create index if not exists family_profiles_owner_idx on public.family_profiles(owner_id, profile_type);
create index if not exists creator_applications_status_idx on public.creator_applications(status, created_at);
create index if not exists creator_kyc_status_idx on public.creator_kyc(status, updated_at);

-- Creator payout requests are accepted only when the creator is verified and the wallet has enough cleared balance.
create or replace function public.request_creator_payout(p_creator_id uuid, p_amount numeric)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_kyc text;
  v_wallet uuid;
  v_balance numeric;
  v_request uuid;
begin
  if p_amount <= 0 then raise exception 'Payout amount must be positive'; end if;

  select owner_id into v_owner from public.creators where id = p_creator_id;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Creator not owned by current user'; end if;

  select status into v_kyc from public.creator_kyc where creator_id = p_creator_id;
  if v_kyc is distinct from 'verified' then raise exception 'Creator KYC must be verified before payout'; end if;

  select id into v_wallet from public.wallets where owner_id = v_owner;
  if v_wallet is null then raise exception 'Wallet not found'; end if;

  select coalesce(sum(case when kind = 'credit' then amount else -amount end),0)
    into v_balance from public.ledger_entries where wallet_id = v_wallet;
  if v_balance < p_amount then raise exception 'Insufficient cleared wallet balance'; end if;

  insert into public.payout_requests(wallet_id, amount, status)
  values(v_wallet, p_amount, 'pending') returning id into v_request;
  return v_request;
end;
$$;

revoke all on function public.request_creator_payout(uuid, numeric) from public, anon;
grant execute on function public.request_creator_payout(uuid, numeric) to authenticated;
