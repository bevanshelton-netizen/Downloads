-- KORA Partner Gateway v1: rights-aware media partner distribution, attribution and audit controls.

create table if not exists public.media_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null,
  legal_name text,
  website_url text check(website_url is null or website_url ~ '^https://'),
  status text not null default 'prospect' check(status in ('prospect','pilot','active','suspended','ended')),
  agreement_state text not null default 'none' check(agreement_state in ('none','nda','pilot','full','expired')),
  integration_mode text not null default 'external_handoff' check(integration_mode in ('external_handoff','authenticated_partner','direct_playback')),
  territories text[] not null default '{}',
  commercial_model jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_memberships (
  partner_id uuid not null references public.media_partners(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'viewer' check(role in ('viewer','analyst','admin')),
  created_at timestamptz not null default now(),
  primary key(partner_id,user_id)
);

create table if not exists public.partner_assets (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.media_partners(id) on delete cascade,
  external_id text not null,
  title text not null,
  content_type text not null default 'programme' check(content_type in ('programme','film','series','episode','channel','event','sport','other')),
  destination_url text,
  artwork_url text,
  territories text[] not null default '{}',
  minimum_age integer check(minimum_age between 0 and 21),
  access_mode text not null default 'handoff' check(access_mode in ('handoff','authenticated','direct')),
  tracking_mode text not null default 'none' check(tracking_mode in ('none','query_param')),
  tracking_param text not null default 'kora_ref' check(tracking_param ~ '^[A-Za-z0-9_-]{1,40}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id,external_id),
  check(destination_url is null or destination_url ~ '^https://'),
  check(artwork_url is null or artwork_url ~ '^https://'),
  check(destination_url is null or destination_url !~* '\.(m3u8|mpd)(\?|$)'),
  check(access_mode='direct' or destination_url is not null)
);

create table if not exists public.partner_rights_grants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.partner_assets(id) on delete cascade,
  right_type text not null check(right_type in ('handoff','authenticated','stream','download','advertising','ppv')),
  territory text not null default 'GLOBAL' check(length(territory) between 2 and 16),
  status text not null default 'draft' check(status in ('draft','verified','expired','revoked')),
  valid_from timestamptz,
  valid_until timestamptz,
  document_reference text not null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(valid_until is null or valid_from is null or valid_until > valid_from),
  check(status <> 'verified' or (approved_by is not null and approved_at is not null))
);

create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.media_partners(id) on delete restrict,
  asset_id uuid not null references public.partner_assets(id) on delete restrict,
  campaign_id text,
  source_path text,
  country_code text,
  occurred_at timestamptz not null default now()
);

create table if not exists public.partner_conversions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.media_partners(id) on delete restrict,
  referral_id uuid references public.partner_referrals(id) on delete set null,
  provider_reference text not null,
  event_type text not null check(event_type in ('lead','trial','signup','first_payment','renewal','purchase','other')),
  amount numeric(14,2) not null default 0 check(amount>=0),
  currency char(3) not null default 'ZAR',
  status text not null default 'reported' check(status in ('reported','verified','rejected','reversed')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(partner_id,provider_reference)
);

create table if not exists public.partner_catalogue_imports (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.media_partners(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  item_count integer not null check(item_count between 0 and 5000),
  accepted_count integer not null default 0 check(accepted_count>=0),
  rejected_count integer not null default 0 check(rejected_count>=0),
  created_at timestamptz not null default now()
);

create table if not exists public.partner_webhook_keys (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.media_partners(id) on delete cascade,
  label text not null,
  key_hash text not null unique check(length(key_hash)=64),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create table if not exists public.partner_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  subject_table text not null,
  subject_id text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists partner_assets_partner_active_idx on public.partner_assets(partner_id,active);
create index if not exists partner_rights_asset_status_idx on public.partner_rights_grants(asset_id,status,right_type,valid_until);
create index if not exists partner_referrals_partner_time_idx on public.partner_referrals(partner_id,occurred_at desc);
create index if not exists partner_conversions_partner_time_idx on public.partner_conversions(partner_id,occurred_at desc,status);

create or replace function public.kora_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end$$;

drop trigger if exists media_partners_touch on public.media_partners;
create trigger media_partners_touch before update on public.media_partners for each row execute function public.kora_touch_updated_at();
drop trigger if exists partner_assets_touch on public.partner_assets;
create trigger partner_assets_touch before update on public.partner_assets for each row execute function public.kora_touch_updated_at();
drop trigger if exists partner_rights_touch on public.partner_rights_grants;
create trigger partner_rights_touch before update on public.partner_rights_grants for each row execute function public.kora_touch_updated_at();

create or replace function public.is_partner_member(p_partner_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.partner_memberships m where m.partner_id=p_partner_id and m.user_id=auth.uid());
$$;

create or replace function public.kora_partner_audit_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_id text;
begin
  v_id:=coalesce((case when tg_op='DELETE' then old.id else new.id end)::text,'unknown');
  insert into public.partner_audit_log(actor_user_id,action,subject_table,subject_id,before_state,after_state)
  values(auth.uid(),tg_op,tg_table_name,v_id,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return case when tg_op='DELETE' then old else new end;
end$$;

drop trigger if exists media_partners_audit on public.media_partners;
create trigger media_partners_audit after insert or update or delete on public.media_partners for each row execute function public.kora_partner_audit_trigger();
drop trigger if exists partner_assets_audit on public.partner_assets;
create trigger partner_assets_audit after insert or update or delete on public.partner_assets for each row execute function public.kora_partner_audit_trigger();
drop trigger if exists partner_rights_audit on public.partner_rights_grants;
create trigger partner_rights_audit after insert or update or delete on public.partner_rights_grants for each row execute function public.kora_partner_audit_trigger();

create or replace function public.partner_asset_access(p_asset_id uuid,p_country_code text default null)
returns table(access_action text, reason text)
language plpgsql stable security definer set search_path=public as $$
declare
  v_asset public.partner_assets%rowtype;
  v_partner public.media_partners%rowtype;
  v_country text:=upper(coalesce(nullif(trim(p_country_code),''),'ZZ'));
  v_required text;
begin
  select * into v_asset from public.partner_assets where id=p_asset_id;
  if v_asset.id is null then return query select 'blocked','asset_not_found'; return; end if;
  select * into v_partner from public.media_partners where id=v_asset.partner_id;
  if not v_asset.active then return query select 'blocked','asset_inactive'; return; end if;
  if v_partner.status not in ('pilot','active') then return query select 'blocked','partner_not_operational'; return; end if;
  if v_partner.agreement_state not in ('pilot','full') then return query select 'blocked','agreement_not_effective'; return; end if;
  if cardinality(v_partner.territories)>0 and not (v_country=any(v_partner.territories) or 'GLOBAL'=any(v_partner.territories)) then
    return query select 'blocked','partner_territory_not_authorised'; return;
  end if;
  if cardinality(v_asset.territories)>0 and not (v_country=any(v_asset.territories) or 'GLOBAL'=any(v_asset.territories)) then
    return query select 'blocked','asset_territory_not_authorised'; return;
  end if;
  if v_asset.access_mode='handoff' then
    return query select 'handoff','authorised_external_handoff'; return;
  end if;
  v_required:=case when v_asset.access_mode='authenticated' then 'authenticated' else 'stream' end;
  if exists(
    select 1 from public.partner_rights_grants r
    where r.asset_id=v_asset.id
      and r.right_type=v_required
      and r.status='verified'
      and (r.valid_from is null or r.valid_from<=now())
      and (r.valid_until is null or r.valid_until>now())
      and (upper(r.territory) in ('GLOBAL',v_country))
  ) then
    return query select case when v_required='authenticated' then 'authenticate' else 'watch_on_kora' end,'verified_rights_grant'; return;
  end if;
  return query select 'blocked','verified_rights_grant_required';
end$$;

alter table public.media_partners enable row level security;
alter table public.partner_memberships enable row level security;
alter table public.partner_assets enable row level security;
alter table public.partner_rights_grants enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_conversions enable row level security;
alter table public.partner_catalogue_imports enable row level security;
alter table public.partner_webhook_keys enable row level security;
alter table public.partner_audit_log enable row level security;

create policy "public reads signed active partners" on public.media_partners for select
using((status='active' and agreement_state='full') or public.is_staff() or public.is_partner_member(id));
create policy "members read own memberships" on public.partner_memberships for select
using(user_id=auth.uid() or public.is_staff());
create policy "public reads active signed partner assets" on public.partner_assets for select
using(
  public.is_staff() or public.is_partner_member(partner_id) or
  (active and exists(select 1 from public.media_partners p where p.id=partner_id and p.status='active' and p.agreement_state='full'))
);
create policy "partners read own rights" on public.partner_rights_grants for select
using(public.is_staff() or exists(select 1 from public.partner_assets a where a.id=asset_id and public.is_partner_member(a.partner_id)));
create policy "partners read own referrals" on public.partner_referrals for select
using(public.is_staff() or public.is_partner_member(partner_id));
create policy "partners read own conversions" on public.partner_conversions for select
using(public.is_staff() or public.is_partner_member(partner_id));
create policy "partners read own catalogue imports" on public.partner_catalogue_imports for select
using(public.is_staff() or public.is_partner_member(partner_id));
create policy "staff reads partner audit" on public.partner_audit_log for select using(public.is_staff());

grant select on public.media_partners,public.partner_memberships,public.partner_assets,public.partner_rights_grants,public.partner_referrals,public.partner_conversions,public.partner_catalogue_imports to authenticated;
grant select on public.media_partners,public.partner_assets to anon;
grant execute on function public.partner_asset_access(uuid,text) to anon,authenticated,service_role;
revoke all on public.partner_webhook_keys from anon,authenticated;
grant all on public.media_partners,public.partner_memberships,public.partner_assets,public.partner_rights_grants,public.partner_referrals,public.partner_conversions,public.partner_catalogue_imports,public.partner_webhook_keys,public.partner_audit_log to service_role;

update public.platform_release_state
set schema_version=greatest(schema_version,23),updated_at=now()
where singleton=true;
