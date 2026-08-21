-- KORA controlled live-event artist applications and staff review pipeline.

create table if not exists public.live_event_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  artist_name text not null check (char_length(artist_name) between 2 and 120),
  contact_email text not null check (char_length(contact_email) between 5 and 254),
  country_code text not null default 'ZA' check (country_code ~ '^[A-Z]{2}$'),
  genre text not null check (char_length(genre) between 2 and 100),
  event_type text not null check (event_type in ('concert','festival','gospel','dj_set','comedy','spoken_word','cultural','other')),
  proposed_date date,
  venue_name text,
  venue_city text,
  expected_audience integer check (expected_audience is null or expected_audience >= 0),
  broadcast_setup text not null default 'need_support'
    check (broadcast_setup in ('professional_crew','obs_ready','phone_only','need_support')),
  portfolio_url text,
  event_description text not null check (char_length(event_description) between 40 and 3000),
  rights_confirmed boolean not null default false,
  venue_permission_status text not null default 'not_started'
    check (venue_permission_status in ('confirmed','in_progress','not_started','not_applicable')),
  family_safe_confirmed boolean not null default false,
  explicit_sexual_content boolean not null default false check (explicit_sexual_content = false),
  status text not null default 'submitted'
    check (status in ('submitted','reviewing','rehearsal','waitlisted','approved','declined','cancelled')),
  review_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.live_event_applications enable row level security;

drop policy if exists "artist reads own live application" on public.live_event_applications;
create policy "artist reads own live application" on public.live_event_applications
for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "artist submits own live application" on public.live_event_applications;
create policy "artist submits own live application" on public.live_event_applications
for insert to authenticated with check (
  user_id = auth.uid()
  and status = 'submitted'
  and rights_confirmed = true
  and family_safe_confirmed = true
  and explicit_sexual_content = false
);

drop policy if exists "artist edits pending live application" on public.live_event_applications;
create policy "artist edits pending live application" on public.live_event_applications
for update to authenticated
using (user_id = auth.uid() and status in ('submitted','waitlisted'))
with check (user_id = auth.uid() and status in ('submitted','waitlisted') and explicit_sexual_content = false);

revoke insert, update, delete on table public.live_event_applications from anon;
grant select, insert on table public.live_event_applications to authenticated;
grant update (
  artist_name, contact_email, country_code, genre, event_type, proposed_date,
  venue_name, venue_city, expected_audience, broadcast_setup, portfolio_url,
  event_description, rights_confirmed, venue_permission_status,
  family_safe_confirmed, updated_at
) on table public.live_event_applications to authenticated;
grant all on table public.live_event_applications to service_role;

update public.platform_release_state
set schema_version = greatest(schema_version, 15), updated_at = now()
where singleton = true;
