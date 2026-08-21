-- KORA public artist discovery profiles.
-- Profiles originate from approved live-event pilots, remain staff-curated, and never expose private application email by default.

create table if not exists public.artist_profiles (
  id uuid primary key default gen_random_uuid(),
  live_application_id uuid not null unique references public.live_event_applications(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid references public.creators(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(display_name) between 2 and 120),
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  primary_genre text not null check (char_length(primary_genre) between 2 and 100),
  bio text not null check (char_length(bio) between 40 and 3000),
  portfolio_url text,
  public_booking_email text,
  website_url text,
  social_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public_booking_email is null or public_booking_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check ((is_published = false and published_at is null) or (is_published = true and published_at is not null))
);

alter table public.artist_profiles enable row level security;

create policy "published artist profiles are public"
on public.artist_profiles for select
using (is_published = true or owner_id = auth.uid() or public.is_staff());

create policy "staff manages artist profiles"
on public.artist_profiles for all
using (public.is_staff())
with check (public.is_staff());

create index if not exists artist_profiles_published_genre_idx
  on public.artist_profiles(is_published, primary_genre, display_name);
create index if not exists artist_profiles_country_idx
  on public.artist_profiles(is_published, country_code, display_name);

grant select on public.artist_profiles to anon, authenticated;
grant all on public.artist_profiles to service_role;

update public.platform_release_state
set schema_version = greatest(schema_version, 17), updated_at = now()
where singleton = true;
