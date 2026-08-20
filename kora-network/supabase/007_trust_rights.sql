-- KORA trust, legal acceptance and rights provenance.

create table if not exists public.agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_code text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  unique(user_id, document_code, document_version)
);

create table if not exists public.production_rights_declarations (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null unique references public.productions(id) on delete cascade,
  declarant_id uuid not null references public.profiles(id) on delete restrict,
  creator_terms_version text not null,
  owns_or_controls_rights boolean not null,
  contributor_permissions_confirmed boolean not null,
  music_permissions_confirmed boolean not null,
  likeness_permissions_confirmed boolean not null,
  content_policy_confirmed boolean not null,
  declared_at timestamptz not null default now(),
  check (
    owns_or_controls_rights
    and contributor_permissions_confirmed
    and music_permissions_confirmed
    and likeness_permissions_confirmed
    and content_policy_confirmed
  )
);

create table if not exists public.rights_disputes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid references public.productions(id) on delete set null,
  episode_id uuid references public.episodes(id) on delete set null,
  claimant_name text not null,
  claimant_email text not null,
  rights_basis text not null,
  evidence_reference text,
  good_faith_statement boolean not null default false,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (production_id is not null or episode_id is not null)
);

alter table public.agreement_acceptances enable row level security;
alter table public.production_rights_declarations enable row level security;
alter table public.rights_disputes enable row level security;

create policy "user reads own acceptances" on public.agreement_acceptances
for select using (user_id = auth.uid() or public.is_staff());
create policy "user records own acceptances" on public.agreement_acceptances
for insert to authenticated with check (user_id = auth.uid());

create policy "creator reads own rights declarations" on public.production_rights_declarations
for select using (
  public.is_staff() or exists (
    select 1 from public.productions p
    join public.creators c on c.id = p.creator_id
    where p.id = production_id and c.owner_id = auth.uid()
  )
);
create policy "creator inserts own rights declarations" on public.production_rights_declarations
for insert to authenticated with check (
  declarant_id = auth.uid() and exists (
    select 1 from public.productions p
    join public.creators c on c.id = p.creator_id
    where p.id = production_id and c.owner_id = auth.uid()
  )
);

create policy "staff manages rights disputes" on public.rights_disputes
for all using (public.is_staff()) with check (public.is_staff());

create index if not exists agreement_acceptances_user_doc_idx
  on public.agreement_acceptances(user_id, document_code, document_version);
create index if not exists rights_disputes_status_idx
  on public.rights_disputes(status, created_at);
