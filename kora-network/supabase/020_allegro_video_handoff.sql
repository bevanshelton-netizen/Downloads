-- KORA <-> ALLEGRO artist linkage and music-screen handoff.

alter table public.productions
  add column if not exists content_type text not null default 'series'
    check (content_type in (
      'series','music_video','live_session','concert_film','artist_documentary',
      'revival_documentary','tour_diary','behind_the_scenes','music_biopic',
      'music_movie','launch_film','interview_special'
    )),
  add column if not exists source_platform text,
  add column if not exists source_reference text,
  add column if not exists rights_clearance_status text not null default 'pending'
    check (rights_clearance_status in ('pending','review','cleared','blocked','disputed'));

create table if not exists public.allegro_creator_links (
  allegro_creator_ref text primary key check (char_length(allegro_creator_ref) between 8 and 200),
  kora_creator_id uuid not null unique references public.creators(id) on delete cascade,
  linked_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.allegro_video_handoffs (
  id uuid primary key default gen_random_uuid(),
  allegro_creator_ref text not null references public.allegro_creator_links(allegro_creator_ref) on delete restrict,
  kora_creator_id uuid not null references public.creators(id) on delete restrict,
  production_id uuid not null references public.productions(id) on delete restrict,
  episode_id uuid not null references public.episodes(id) on delete restrict,
  content_type text not null,
  rights_manifest jsonb not null default '{}'::jsonb,
  rights_status text not null default 'pending'
    check (rights_status in ('pending','review','cleared','blocked','disputed')),
  source_title text not null,
  source_reference text,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists allegro_video_handoffs_creator_idx
  on public.allegro_video_handoffs(kora_creator_id,created_at desc);

alter table public.allegro_creator_links enable row level security;
alter table public.allegro_video_handoffs enable row level security;

create policy "creator reads own allegro link"
on public.allegro_creator_links for select
using (
  linked_by=auth.uid()
  or public.is_staff()
);

create policy "creator manages own allegro link"
on public.allegro_creator_links for all
using (linked_by=auth.uid() or public.is_staff())
with check (linked_by=auth.uid() or public.is_staff());

create policy "creator reads own allegro handoffs"
on public.allegro_video_handoffs for select
using (
  public.is_staff()
  or exists(
    select 1 from public.creators c
    where c.id=kora_creator_id and c.owner_id=auth.uid()
  )
);

grant select,insert,update on public.allegro_creator_links to authenticated;
grant select on public.allegro_video_handoffs to authenticated;
grant all on public.allegro_creator_links,public.allegro_video_handoffs to service_role;

update public.platform_release_state
set schema_version=greatest(schema_version,20),updated_at=now()
where singleton=true;
