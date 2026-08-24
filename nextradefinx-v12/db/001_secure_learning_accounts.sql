-- NexTradeFinX V12: educational account persistence only.
-- Requires Supabase Auth. No brokerage/KYC/client-fund tables are created here.

create extension if not exists pgcrypto;

create table if not exists public.learner_passports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  language_code text not null default 'en' check (char_length(language_code) between 2 and 12),
  experience_level text not null default 'beginner' check (experience_level in ('beginner','intermediate','experienced')),
  learning_goal text not null default 'understand_markets' check (char_length(learning_goal) <= 80),
  current_stage integer not null default 0 check (current_stage between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 64),
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  readiness_score numeric(5,2) not null check (readiness_score between 0 and 100),
  status text not null,
  blockers jsonb not null default '[]'::jsonb,
  legal_status text not null default 'internal_educational_competency_only',
  created_at timestamptz not null default now()
);

alter table public.learner_passports enable row level security;
alter table public.learning_events enable row level security;
alter table public.readiness_snapshots enable row level security;

drop policy if exists learner_passports_select_own on public.learner_passports;
create policy learner_passports_select_own on public.learner_passports for select using (auth.uid() = user_id);
drop policy if exists learner_passports_insert_own on public.learner_passports;
create policy learner_passports_insert_own on public.learner_passports for insert with check (auth.uid() = user_id);
drop policy if exists learner_passports_update_own on public.learner_passports;
create policy learner_passports_update_own on public.learner_passports for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists learning_events_select_own on public.learning_events;
create policy learning_events_select_own on public.learning_events for select using (auth.uid() = user_id);
drop policy if exists learning_events_insert_own on public.learning_events;
create policy learning_events_insert_own on public.learning_events for insert with check (auth.uid() = user_id);

drop policy if exists readiness_snapshots_select_own on public.readiness_snapshots;
create policy readiness_snapshots_select_own on public.readiness_snapshots for select using (auth.uid() = user_id);
drop policy if exists readiness_snapshots_insert_own on public.readiness_snapshots;
create policy readiness_snapshots_insert_own on public.readiness_snapshots for insert with check (auth.uid() = user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists learner_passports_set_updated_at on public.learner_passports;
create trigger learner_passports_set_updated_at before update on public.learner_passports for each row execute function public.set_updated_at();

revoke all on public.learner_passports, public.learning_events, public.readiness_snapshots from anon;
grant select, insert, update on public.learner_passports to authenticated;
grant select, insert on public.learning_events, public.readiness_snapshots to authenticated;
