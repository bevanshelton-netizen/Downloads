-- NexTradeFinX V13: controlled education/paper-trading beta controls.

create table if not exists public.consent_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  locale text not null,
  terms_version text not null,
  privacy_version text not null,
  risk_version text not null,
  age_over_18_confirmed boolean not null check (age_over_18_confirmed = true),
  educational_only_acknowledged boolean not null check (educational_only_acknowledged = true),
  no_profit_promise_acknowledged boolean not null check (no_profit_promise_acknowledged = true),
  live_execution_off_acknowledged boolean not null check (live_execution_off_acknowledged = true),
  accepted_at timestamptz not null default now()
);

create table if not exists public.beta_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invite_status text not null default 'PENDING' check (invite_status in ('PENDING','APPROVED','REVOKED')),
  approved_at timestamptz,
  revoked_at timestamptz,
  note text
);

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','PROCESSING','COMPLETED','REJECTED')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.consent_receipts enable row level security;
alter table public.beta_access enable row level security;
alter table public.deletion_requests enable row level security;

drop policy if exists consent_receipts_select_own on public.consent_receipts;
create policy consent_receipts_select_own on public.consent_receipts for select using (auth.uid() = user_id);
drop policy if exists consent_receipts_insert_own on public.consent_receipts;
create policy consent_receipts_insert_own on public.consent_receipts for insert with check (auth.uid() = user_id);

drop policy if exists beta_access_select_own on public.beta_access;
create policy beta_access_select_own on public.beta_access for select using (auth.uid() = user_id);

drop policy if exists deletion_requests_select_own on public.deletion_requests;
create policy deletion_requests_select_own on public.deletion_requests for select using (auth.uid() = user_id);
drop policy if exists deletion_requests_insert_own on public.deletion_requests;
create policy deletion_requests_insert_own on public.deletion_requests for insert with check (auth.uid() = user_id);

revoke all on public.consent_receipts, public.beta_access, public.deletion_requests from anon;
grant select, insert on public.consent_receipts to authenticated;
grant select on public.beta_access to authenticated;
grant select, insert on public.deletion_requests to authenticated;
