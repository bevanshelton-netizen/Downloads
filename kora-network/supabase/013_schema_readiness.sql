-- KORA Phase 8: production schema readiness marker.
-- This migration intentionally fails if critical earlier platform layers are missing.

do $$
begin
  if to_regclass('public.productions') is null then raise exception 'Missing base KORA schema'; end if;
  if to_regclass('public.production_rights_declarations') is null then raise exception 'Missing trust/rights migration'; end if;
  if to_regclass('public.viewer_profiles') is null then raise exception 'Missing family/Kids migration'; end if;
  if to_regclass('public.creator_revenue_allocations') is null then raise exception 'Missing creator economy migration'; end if;
  if to_regclass('public.campaign_creatives') is null then raise exception 'Missing launch advertising migration'; end if;
  if to_regclass('public.ad_deliveries') is null then raise exception 'Missing ad delivery migration'; end if;
  if to_regclass('public.purchases') is null then raise exception 'Missing purchases table'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='campaigns' and column_name='media_spend'
  ) then raise exception 'Missing campaign media-spend hardening'; end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='complete_payfast_purchase'
  ) then raise exception 'Missing PPV entitlement completion function'; end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='allocate_creator_revenue'
  ) then raise exception 'Missing creator revenue allocation function'; end if;
end $$;

create table if not exists public.platform_schema_meta (
  singleton boolean primary key default true check (singleton = true),
  version integer not null check (version > 0),
  applied_at timestamptz not null default now(),
  note text
);

alter table public.platform_schema_meta enable row level security;

insert into public.platform_schema_meta(singleton, version, applied_at, note)
values(true, 13, now(), 'KORA production schema through PPV, ad delivery, creator economy and Kids safeguards')
on conflict(singleton) do update
set version = excluded.version,
    applied_at = excluded.applied_at,
    note = excluded.note;
