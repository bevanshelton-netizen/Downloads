-- FAISReady Call Centre backend-ready schema (Supabase/Postgres)
-- SA-first: consent, POPIA-aware data minimisation, QA, remediation and audit trail.

create extension if not exists pgcrypto;

create table if not exists fr_call_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  name text not null,
  purpose text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  direction text not null default 'outbound' check (direction in ('inbound','outbound','blended')),
  script_version text,
  consent_basis text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists fr_call_agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  user_id uuid,
  display_name text not null,
  employee_ref text,
  role text not null default 'agent' check (role in ('agent','supervisor','qa','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists fr_call_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  profile_id uuid,
  candidate_id uuid,
  first_name text,
  last_name text,
  phone_e164 text,
  email text,
  province text,
  preferred_language text,
  do_not_call boolean not null default false,
  consent_status text not null default 'unknown' check (consent_status in ('unknown','consented','objected','withdrawn','not_required')),
  consent_recorded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists fr_calls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  campaign_id uuid references fr_call_campaigns(id) on delete set null,
  agent_id uuid references fr_call_agents(id) on delete set null,
  contact_id uuid references fr_call_contacts(id) on delete set null,
  provider text,
  provider_call_id text,
  direction text not null check (direction in ('inbound','outbound')),
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  disposition text,
  outcome text,
  callback_at timestamptz,
  notes text,
  recording_uri text,
  recording_retention_until date,
  transcript_uri text,
  created_at timestamptz not null default now()
);

create table if not exists fr_call_qa_reviews (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references fr_calls(id) on delete cascade,
  reviewer_agent_id uuid references fr_call_agents(id) on delete set null,
  overall_score numeric(5,2),
  compliance_score numeric(5,2),
  conduct_score numeric(5,2),
  communication_score numeric(5,2),
  required_disclosures_ok boolean,
  consent_handling_ok boolean,
  vulnerable_customer_flag boolean not null default false,
  escalation_required boolean not null default false,
  findings jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz not null default now()
);

create table if not exists fr_call_ai_insights (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references fr_calls(id) on delete cascade,
  summary text,
  sentiment text,
  topics jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  next_best_action text,
  coaching_points jsonb not null default '[]'::jsonb,
  model_version text,
  created_at timestamptz not null default now()
);

create table if not exists fr_call_remediation (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  agent_id uuid not null references fr_call_agents(id) on delete cascade,
  source_call_id uuid references fr_calls(id) on delete set null,
  source_qa_review_id uuid references fr_call_qa_reviews(id) on delete set null,
  topic_code text,
  reason text not null,
  learning_assignment_id uuid,
  status text not null default 'assigned' check (status in ('assigned','in_progress','reassess','closed')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists fr_call_audit_log (
  id bigserial primary key,
  company_id uuid,
  actor_user_id uuid,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fr_calls_campaign on fr_calls(campaign_id, started_at desc);
create index if not exists idx_fr_calls_agent on fr_calls(agent_id, started_at desc);
create index if not exists idx_fr_calls_contact on fr_calls(contact_id, started_at desc);
create index if not exists idx_fr_qa_call on fr_call_qa_reviews(call_id);
create index if not exists idx_fr_remediation_agent on fr_call_remediation(agent_id, status);

-- RLS should be enabled when auth/company membership tables are wired.
-- Policies must restrict company users to their own company_id and limit
-- recording/transcript access to authorised roles (supervisor/qa/admin).
