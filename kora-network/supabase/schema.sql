create extension if not exists pgcrypto;

create type public.user_role as enum ('viewer','creator','advertiser','moderator','admin');
create type public.content_status as enum ('draft','review','published','rejected','archived');
create type public.ledger_kind as enum ('credit','debit');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'viewer',
  display_name text,
  country_code text default 'ZA',
  created_at timestamptz not null default now()
);

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  bio text,
  verified boolean not null default false,
  payout_status text not null default 'unverified',
  created_at timestamptz not null default now()
);

create table public.productions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  title text not null,
  slug text unique not null,
  synopsis text,
  genre text,
  primary_language text,
  age_rating text,
  status public.content_status not null default 'draft',
  explicit_sexual_content boolean not null default false,
  created_at timestamptz not null default now(),
  constraint pornography_block check (explicit_sexual_content = false)
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  episode_number int not null,
  title text not null,
  duration_seconds int not null default 0,
  playback_id text,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  unique(production_id, episode_number)
);

create table public.live_channels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  description text,
  is_active boolean not null default true
);

create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.live_channels(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);

create table public.watch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  episode_id uuid references public.episodes(id) on delete set null,
  event_type text not null,
  seconds_watched int not null default 0,
  session_id text,
  created_at timestamptz not null default now()
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique not null references public.profiles(id) on delete cascade,
  currency char(3) not null default 'ZAR',
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  kind public.ledger_kind not null,
  amount numeric(14,2) not null check (amount > 0),
  reason text not null,
  source_type text,
  source_id text,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  budget numeric(14,2) not null check (budget >= 0),
  reward_pool numeric(14,2) not null default 0 check (reward_pool >= 0 and reward_pool <= budget),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft'
);

create table public.ad_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  production_id uuid references public.productions(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  check (production_id is not null or episode_id is not null)
);

alter table public.profiles enable row level security;
alter table public.creators enable row level security;
alter table public.productions enable row level security;
alter table public.episodes enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;

create policy "public published productions" on public.productions for select using (status='published');
create policy "public published episodes" on public.episodes for select using (status='published');
create policy "profile owns self" on public.profiles for select using (auth.uid()=id);
create policy "wallet owner reads" on public.wallets for select using (owner_id=auth.uid());
create policy "ledger owner reads" on public.ledger_entries for select using (exists(select 1 from public.wallets w where w.id=wallet_id and w.owner_id=auth.uid()));

insert into public.live_channels(name,slug,description) values
('KORA One','kora-one','Flagship African entertainment'),
('KORA Drama','kora-drama','African drama around the clock'),
('KORA Family','kora-family','Family-safe entertainment'),
('KORA Faith','kora-faith','Faith, values and inspiration'),
('KORA Music','kora-music','Music, performance and culture'),
('KORA Kids','kora-kids','Curated programming for children'),
('KORA Creators','kora-creators','Independent African creator showcase')
on conflict do nothing;
