-- KORA production activation and fail-safe release controls.

create table if not exists public.platform_release_state (
  singleton boolean primary key default true check (singleton = true),
  schema_version integer not null default 13,
  release_name text not null default 'private_beta' check (release_name in ('private_beta','public_beta','general_availability')),
  public_launch_enabled boolean not null default false,
  public_signups_enabled boolean not null default false,
  creator_applications_enabled boolean not null default false,
  advertiser_campaigns_enabled boolean not null default false,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_release_state(singleton)
values(true)
on conflict (singleton) do update set schema_version = greatest(public.platform_release_state.schema_version, 13);

create table if not exists public.platform_release_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  release_name text,
  public_launch_enabled boolean,
  public_signups_enabled boolean,
  creator_applications_enabled boolean,
  advertiser_campaigns_enabled boolean,
  maintenance_mode boolean,
  note text,
  created_at timestamptz not null default now()
);

alter table public.platform_release_state enable row level security;
alter table public.platform_release_events enable row level security;

create policy "staff reads release state" on public.platform_release_state
for select using (public.is_staff());

create policy "admins read release events" on public.platform_release_events
for select using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index if not exists platform_release_events_created_idx
  on public.platform_release_events(created_at desc);
