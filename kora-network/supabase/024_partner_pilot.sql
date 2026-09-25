-- KORA Partner Pilot v1: 90-day commercial pilot control plane.

create table if not exists public.partner_pilots (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.media_partners(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check(status in ('draft','approved','live','paused','completed','cancelled')),
  territory text not null default 'ZA' check(length(territory) between 2 and 16),
  starts_at timestamptz,
  ends_at timestamptz,
  attribution_model text not null default 'approved_referral' check(attribution_model in ('approved_referral','promo_code','api','server_to_server','hybrid')),
  commercial_model jsonb not null default '{}'::jsonb,
  success_metrics jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index if not exists partner_pilots_one_live_per_partner
on public.partner_pilots(partner_id)
where status='live';

create table if not exists public.partner_pilot_milestones (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.partner_pilots(id) on delete cascade,
  day_number integer not null check(day_number in (30,60,90)),
  review_date date,
  status text not null default 'pending' check(status in ('pending','ready','completed','waived')),
  findings jsonb not null default '{}'::jsonb,
  decision text,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(pilot_id,day_number)
);

alter table public.partner_referrals
  add column if not exists pilot_id uuid references public.partner_pilots(id) on delete set null;

alter table public.partner_conversions
  add column if not exists pilot_id uuid references public.partner_pilots(id) on delete set null;

create index if not exists partner_pilots_partner_status_idx
  on public.partner_pilots(partner_id,status,starts_at desc);
create index if not exists partner_pilot_milestones_pilot_day_idx
  on public.partner_pilot_milestones(pilot_id,day_number);
create index if not exists partner_referrals_pilot_time_idx
  on public.partner_referrals(pilot_id,occurred_at desc)
  where pilot_id is not null;
create index if not exists partner_conversions_pilot_time_idx
  on public.partner_conversions(pilot_id,occurred_at desc,status)
  where pilot_id is not null;

drop trigger if exists partner_pilots_touch on public.partner_pilots;
create trigger partner_pilots_touch
before update on public.partner_pilots
for each row execute function kora_private.kora_touch_updated_at();

drop trigger if exists partner_pilots_audit on public.partner_pilots;
create trigger partner_pilots_audit
after insert or update or delete on public.partner_pilots
for each row execute function kora_private.kora_partner_audit_trigger();

alter table public.partner_pilots enable row level security;
alter table public.partner_pilot_milestones enable row level security;

create policy "partners read own pilots" on public.partner_pilots for select
to authenticated
using(public.is_staff() or (select kora_private.is_partner_member(partner_id)));

create policy "partners read own pilot milestones" on public.partner_pilot_milestones for select
to authenticated
using(
  public.is_staff()
  or exists(
    select 1
    from public.partner_pilots p
    where p.id=pilot_id
      and (select kora_private.is_partner_member(p.partner_id))
  )
);

grant select on public.partner_pilots,public.partner_pilot_milestones to authenticated;
grant all on public.partner_pilots,public.partner_pilot_milestones to service_role;

update public.platform_release_state
set schema_version=greatest(schema_version,24),updated_at=now()
where singleton=true;
