-- NexTradeFinX V11 Learning Passport
-- Educational data only. No brokerage balances, bank details or live-order data.

create table if not exists learner_passports (
  id uuid primary key,
  user_id uuid not null unique,
  language_code text not null default 'en',
  experience_level text not null default 'beginner',
  learning_goal text not null default 'understand_markets',
  current_stage integer not null default 0 check (current_stage between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists learning_events (
  id uuid primary key,
  user_id uuid not null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists quiz_attempts (
  id uuid primary key,
  user_id uuid not null,
  module_key text not null,
  score_pct numeric(5,2) not null check (score_pct between 0 and 100),
  missed_concepts jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);

create table if not exists paper_sessions (
  id uuid primary key,
  user_id uuid not null,
  instrument text not null,
  discipline_score numeric(5,2) check (discipline_score between 0 and 100),
  journal_completed boolean not null default false,
  no_trade_decision boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists readiness_snapshots (
  id uuid primary key,
  user_id uuid not null,
  readiness_score numeric(5,2) not null check (readiness_score between 0 and 100),
  status text not null,
  blockers jsonb not null default '[]'::jsonb,
  legal_status text not null default 'internal_educational_competency_only',
  created_at timestamptz not null default now()
);

create index if not exists learning_events_user_time_idx on learning_events(user_id, occurred_at desc);
create index if not exists readiness_snapshots_user_time_idx on readiness_snapshots(user_id, created_at desc);
