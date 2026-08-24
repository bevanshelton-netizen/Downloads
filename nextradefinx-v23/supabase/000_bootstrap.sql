-- NexTradeFinX V22 controlled-beta bootstrap
-- Education + paper-trading data only. No brokerage/client-fund tables.

create extension if not exists pgcrypto;

create table if not exists public.learner_passports (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language_code text not null default 'en',
  experience_level text not null default 'beginner' check (experience_level in ('beginner','intermediate','experienced')),
  learning_goal text not null default 'understand_markets',
  current_stage integer not null default 0 check (current_stage between 0 and 5),
  beta_age_confirmed_18_plus boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.beta_invites (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','revoked')),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms','privacy','risk')),
  document_version text not null,
  accepted_at timestamptz not null default now(),
  user_agent text,
  unique(user_id,consent_type,document_version)
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','processing','completed','cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists learning_events_user_time_idx on public.learning_events(user_id, occurred_at desc);
create index if not exists consent_receipts_user_time_idx on public.consent_receipts(user_id, accepted_at desc);
create index if not exists deletion_requests_user_time_idx on public.account_deletion_requests(user_id, requested_at desc);

create or replace function public.nextradefinx_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists learner_passports_set_updated_at on public.learner_passports;
create trigger learner_passports_set_updated_at
before update on public.learner_passports
for each row execute function public.nextradefinx_set_updated_at();

alter table public.learner_passports enable row level security;
alter table public.learning_events enable row level security;
alter table public.beta_invites enable row level security;
alter table public.consent_receipts enable row level security;
alter table public.account_deletion_requests enable row level security;

-- Re-runnable policy setup.
drop policy if exists passport_select_own on public.learner_passports;
drop policy if exists passport_insert_own on public.learner_passports;
drop policy if exists passport_update_own on public.learner_passports;
create policy passport_select_own on public.learner_passports for select to authenticated using (auth.uid() = user_id);
create policy passport_insert_own on public.learner_passports for insert to authenticated with check (auth.uid() = user_id);
create policy passport_update_own on public.learner_passports for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists learning_events_select_own on public.learning_events;
drop policy if exists learning_events_insert_own on public.learning_events;
create policy learning_events_select_own on public.learning_events for select to authenticated using (auth.uid() = user_id);
create policy learning_events_insert_own on public.learning_events for insert to authenticated with check (auth.uid() = user_id);

-- Invites are learner-readable but never learner-writable. Approval is server/admin only.
drop policy if exists beta_invites_select_own on public.beta_invites;
create policy beta_invites_select_own on public.beta_invites for select to authenticated using (auth.uid() = user_id);

-- Consent receipts are append-only for learners.
drop policy if exists consent_select_own on public.consent_receipts;
drop policy if exists consent_insert_own on public.consent_receipts;
create policy consent_select_own on public.consent_receipts for select to authenticated using (auth.uid() = user_id);
create policy consent_insert_own on public.consent_receipts for insert to authenticated with check (auth.uid() = user_id);

-- Deletion requests can be created/read by the learner, but status transitions are server/admin only.
drop policy if exists deletion_select_own on public.account_deletion_requests;
drop policy if exists deletion_insert_own on public.account_deletion_requests;
create policy deletion_select_own on public.account_deletion_requests for select to authenticated using (auth.uid() = user_id);
create policy deletion_insert_own on public.account_deletion_requests for insert to authenticated with check (auth.uid() = user_id);

-- No learner UPDATE/DELETE policies exist for learning_events, beta_invites,
-- consent_receipts, or account_deletion_requests.
