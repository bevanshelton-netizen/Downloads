-- KORA Tour2Screen: turn a touring artist's road activity into protected monetisable media.

create table if not exists public.tour_projects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  title text not null check(char_length(title) between 2 and 160),
  slug text not null unique check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  starts_on date,
  ends_on date,
  status text not null default 'planning'
    check(status in('planning','touring','post_production','released','archived','cancelled')),
  career_path text not null default 'grow'
    check(career_path in('launch','grow','revive','relaunch')),
  rights_status text not null default 'pending'
    check(rights_status in('pending','review','cleared','blocked','disputed')),
  sponsor_ready boolean not null default false,
  global_distribution_requested boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_on is null or starts_on is null or ends_on>=starts_on)
);

create table if not exists public.tour_stops (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tour_projects(id) on delete cascade,
  sequence_no integer not null check(sequence_no>0),
  country_code char(2),
  city text not null,
  venue_name text,
  show_date timestamptz,
  ticket_event_id uuid references public.ticket_events(id) on delete set null,
  venue_filming_permission boolean not null default false,
  audience_notice_complete boolean not null default false,
  promoter_permission_complete boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique(tour_id,sequence_no)
);

create table if not exists public.tour_content_units (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tour_projects(id) on delete cascade,
  tour_stop_id uuid references public.tour_stops(id) on delete set null,
  production_id uuid references public.productions(id) on delete set null,
  title text not null,
  content_type text not null check(content_type in(
    'tour_diary_episode','concert_film','live_session','behind_the_scenes',
    'travel_story','fan_story','sponsor_feature','short_clip','tour_documentary'
  )),
  planned_access_mode text not null default 'ad_supported'
    check(planned_access_mode in('free','ad_supported','premium','pay_per_view')),
  planned_price numeric(14,2) check(planned_price is null or planned_price>=0),
  rights_status text not null default 'pending'
    check(rights_status in('pending','review','cleared','blocked','disputed')),
  editorial_status text not null default 'planned'
    check(editorial_status in('planned','captured','editing','review','published','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(planned_access_mode='pay_per_view' or planned_price is null)
);

create table if not exists public.tour_sponsor_inventory (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tour_projects(id) on delete cascade,
  inventory_code text not null,
  name text not null,
  description text not null default '',
  quantity integer not null default 1 check(quantity>0),
  reserved_quantity integer not null default 0 check(reserved_quantity>=0 and reserved_quantity<=quantity),
  price numeric(14,2) check(price is null or price>=0),
  currency char(3) not null default 'ZAR',
  status text not null default 'available' check(status in('available','reserved','sold','closed')),
  created_at timestamptz not null default now(),
  unique(tour_id,inventory_code)
);

create table if not exists public.tour_rights_checkpoints (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tour_projects(id) on delete cascade,
  tour_stop_id uuid references public.tour_stops(id) on delete cascade,
  checkpoint_type text not null check(checkpoint_type in(
    'venue_filming','promoter','performer','audience_notice','music','master',
    'archive','brand','sponsor','location','minor','third_party_visual'
  )),
  status text not null default 'pending' check(status in('pending','cleared','blocked','not_applicable')),
  evidence_reference text,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.tour_projects enable row level security;
alter table public.tour_stops enable row level security;
alter table public.tour_content_units enable row level security;
alter table public.tour_sponsor_inventory enable row level security;
alter table public.tour_rights_checkpoints enable row level security;

create policy "creator reads own tours"
on public.tour_projects for select
using(public.is_staff() or exists(select 1 from public.creators c where c.id=creator_id and c.owner_id=auth.uid()));

create policy "creator manages own tours"
on public.tour_projects for all
using(public.is_staff() or exists(select 1 from public.creators c where c.id=creator_id and c.owner_id=auth.uid()))
with check(public.is_staff() or exists(select 1 from public.creators c where c.id=creator_id and c.owner_id=auth.uid()));

create policy "creator reads own tour stops"
on public.tour_stops for select
using(public.is_staff() or exists(
  select 1 from public.tour_projects t join public.creators c on c.id=t.creator_id
  where t.id=tour_id and c.owner_id=auth.uid()
));

create policy "creator manages own tour stops"
on public.tour_stops for all
using(public.is_staff() or exists(
  select 1 from public.tour_projects t join public.creators c on c.id=t.creator_id
  where t.id=tour_id and c.owner_id=auth.uid()
))
with check(public.is_staff() or exists(
  select 1 from public.tour_projects t join public.creators c on c.id=t.creator_id
  where t.id=tour_id and c.owner_id=auth.uid()
));

create policy "creator reads own tour content"
on public.tour_content_units for select
using(public.is_staff() or exists(
  select 1 from public.tour_projects t join public.creators c on c.id=t.creator_id
  where t.id=tour_id and c.owner_id=auth.uid()
));

create policy "creator manages own tour content"
on public.tour_content_units for all
using(public.is_staff() or exists(
  select 1 from public.tour_projects t join public.creators c on c.id=t.creator_id
  where t.id=tour_id and c.owner_id=auth.uid()
))
with check(public.is_staff() or exists(
  select 1 from public.tour_projects t join public.creators c on c.id=t.creator_id
  where t.id=tour_id and c.owner_id=auth.uid()
));

create policy "creator reads tour sponsor inventory"
on public.tour_sponsor_inventory for select
using(public.is_staff() or exists(
  select 1 from public.tour_projects t join public.creators c on c.id=t.creator_id
  where t.id=tour_id and c.owner_id=auth.uid()
));

create policy "creator reads tour rights checkpoints"
on public.tour_rights_checkpoints for select
using(public.is_staff() or exists(
  select 1 from public.tour_projects t join public.creators c on c.id=t.creator_id
  where t.id=tour_id and c.owner_id=auth.uid()
));

grant select,insert,update,delete on public.tour_projects,public.tour_stops,public.tour_content_units to authenticated;
grant select on public.tour_sponsor_inventory,public.tour_rights_checkpoints to authenticated;
grant all on public.tour_projects,public.tour_stops,public.tour_content_units,public.tour_sponsor_inventory,public.tour_rights_checkpoints to service_role;

update public.platform_release_state
set schema_version=greatest(schema_version,21),updated_at=now()
where singleton=true;
