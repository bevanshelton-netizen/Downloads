-- IZAKHONO GROWTH OS — private persistence schema
-- Intended for a dedicated Supabase/Postgres project.
-- This schema is not intended to be exposed through the Data API.

begin;

create schema if not exists growth_os authorization postgres;

revoke all on schema growth_os from public;
revoke all on schema growth_os from anon;
revoke all on schema growth_os from authenticated;

create table if not exists growth_os.events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  event_name text not null check (event_name in (
    'page_view','lead','qualified_lead','application',
    'enrolment','order','payment','refund'
  )),
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  brand text not null,
  source text,
  medium text,
  campaign text,
  country text,
  language text,
  landing_page text,
  lead_id text,
  customer_id text,
  order_id text,
  value numeric(18,2),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  metadata jsonb not null default '{}'::jsonb,
  constraint growth_events_value_nonnegative check (
    value is null or value >= 0 or event_name = 'refund'
  )
);

create index if not exists growth_events_occurred_at_idx
  on growth_os.events (occurred_at desc);
create index if not exists growth_events_brand_occurred_at_idx
  on growth_os.events (brand, occurred_at desc);
create index if not exists growth_events_campaign_idx
  on growth_os.events (campaign) where campaign is not null;
create index if not exists growth_events_lead_idx
  on growth_os.events (lead_id) where lead_id is not null;
create index if not exists growth_events_customer_idx
  on growth_os.events (customer_id) where customer_id is not null;
create index if not exists growth_events_order_idx
  on growth_os.events (order_id) where order_id is not null;

create table if not exists growth_os.provider_connections (
  id bigint generated always as identity primary key,
  provider text not null check (provider in (
    'google-ads','meta-ads','tiktok-ads',
    'linkedin-ads','amazon-ads','microsoft-ads'
  )),
  external_account_id text,
  external_account_name text,
  connection_state text not null default 'oauth-required' check (connection_state in (
    'oauth-required','connected-readonly','connected-write','revoked'
  )),
  granted_scopes text[] not null default '{}',
  encrypted_token_envelope jsonb,
  token_expires_at timestamptz,
  connected_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_account_id)
);

create table if not exists growth_os.approvals (
  id uuid primary key,
  action_type text not null,
  provider text,
  external_account_id text,
  campaign_ref text,
  requested_payload jsonb not null,
  status text not null default 'pending' check (status in (
    'pending','approved','rejected','executed','expired','cancelled'
  )),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  executed_at timestamptz,
  decision_note text
);

create index if not exists growth_approvals_status_idx
  on growth_os.approvals (status, requested_at desc);

create table if not exists growth_os.activity_ledger (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('system','user','provider')),
  actor_ref text,
  action text not null,
  provider text,
  external_account_id text,
  approval_id uuid,
  outcome text not null check (outcome in ('proposed','approved','rejected','executed','blocked','failed','revoked')),
  detail jsonb not null default '{}'::jsonb
);

create index if not exists growth_activity_occurred_at_idx
  on growth_os.activity_ledger (occurred_at desc);
create index if not exists growth_activity_approval_idx
  on growth_os.activity_ledger (approval_id) where approval_id is not null;

create table if not exists growth_os.conversion_mappings (
  id bigint generated always as identity primary key,
  provider text not null,
  external_account_id text,
  growth_event_name text not null check (growth_event_name in (
    'lead','qualified_lead','application','enrolment','order','payment','refund'
  )),
  provider_conversion_ref text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_account_id, growth_event_name, provider_conversion_ref)
);

alter table growth_os.events enable row level security;
alter table growth_os.events force row level security;
alter table growth_os.provider_connections enable row level security;
alter table growth_os.provider_connections force row level security;
alter table growth_os.approvals enable row level security;
alter table growth_os.approvals force row level security;
alter table growth_os.activity_ledger enable row level security;
alter table growth_os.activity_ledger force row level security;
alter table growth_os.conversion_mappings enable row level security;
alter table growth_os.conversion_mappings force row level security;

revoke all on all tables in schema growth_os from public, anon, authenticated;
revoke all on all sequences in schema growth_os from public, anon, authenticated;

comment on schema growth_os is
  'Private backend-only schema for IZAKHONO GROWTH OS measurement, approvals and encrypted provider connection metadata.';
comment on column growth_os.provider_connections.encrypted_token_envelope is
  'AES-256-GCM encrypted token envelope only. Never plaintext tokens or passwords.';

commit;
