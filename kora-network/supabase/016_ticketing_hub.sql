-- KORA Tickets marketplace foundation. Sales remain staff-locked until PayFast production verification.
create table if not exists public.ticket_events (
 id uuid primary key default gen_random_uuid(),
 live_application_id uuid references public.live_event_applications(id) on delete set null,
 creator_id uuid references public.creators(id) on delete set null,
 title text not null check(char_length(title) between 2 and 140),
 slug text not null unique,
 description text not null check(char_length(description) between 40 and 4000),
 starts_at timestamptz not null,
 ends_at timestamptz,
 venue_name text, venue_city text,
 event_mode text not null check(event_mode in('venue','online','hybrid')),
 status text not null default 'draft' check(status in('draft','review','published','postponed','cancelled','completed')),
 sales_enabled boolean not null default false,
 artist_share_bps integer not null default 9000 check(artist_share_bps between 0 and 9000),
 currency char(3) not null default 'ZAR',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at is null or ends_at>starts_at)
);
create table if not exists public.ticket_tiers (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.ticket_events(id) on delete cascade,
 name text not null, description text,
 price numeric(14,2) not null check(price>=0),
 capacity integer not null check(capacity>0),
 sold_count integer not null default 0 check(sold_count>=0 and sold_count<=capacity),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(event_id,name)
);
create table if not exists public.ticket_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete restrict,
 event_id uuid not null references public.ticket_events(id) on delete restrict,
 tier_id uuid not null references public.ticket_tiers(id) on delete restrict,
 quantity integer not null check(quantity between 1 and 10),
 total_amount numeric(14,2) not null check(total_amount>=0),
 currency char(3) not null default 'ZAR',
 status text not null default 'pending' check(status in('pending','complete','expired','cancelled','refunded')),
 provider text not null default 'payfast', provider_payment_id text,
 created_at timestamptz not null default now()
);
create table if not exists public.event_tickets (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.ticket_orders(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 event_id uuid not null references public.ticket_events(id) on delete restrict,
 tier_id uuid not null references public.ticket_tiers(id) on delete restrict,
 ticket_code uuid not null default gen_random_uuid() unique,
 status text not null default 'valid' check(status in('valid','checked_in','void','refunded')),
 checked_in_at timestamptz, created_at timestamptz not null default now()
);
alter table public.ticket_events enable row level security;
alter table public.ticket_tiers enable row level security;
alter table public.ticket_orders enable row level security;
alter table public.event_tickets enable row level security;
create policy "public published ticket events" on public.ticket_events for select using(status in('published','postponed','cancelled','completed') or public.is_staff());
create policy "public ticket tiers" on public.ticket_tiers for select using(public.is_staff() or exists(select 1 from public.ticket_events e where e.id=event_id and e.status='published'));
create policy "buyer reads ticket orders" on public.ticket_orders for select using(user_id=auth.uid() or public.is_staff());
create policy "buyer reads issued tickets" on public.event_tickets for select using(user_id=auth.uid() or public.is_staff());
create policy "staff manages ticket events" on public.ticket_events for all using(public.is_staff()) with check(public.is_staff());
create policy "staff manages ticket tiers" on public.ticket_tiers for all using(public.is_staff()) with check(public.is_staff());
grant select on public.ticket_events,public.ticket_tiers to anon,authenticated;
grant select on public.ticket_orders,public.event_tickets to authenticated;
grant all on public.ticket_events,public.ticket_tiers,public.ticket_orders,public.event_tickets to service_role;
update public.platform_release_state set schema_version=greatest(schema_version,16),updated_at=now() where singleton=true;
