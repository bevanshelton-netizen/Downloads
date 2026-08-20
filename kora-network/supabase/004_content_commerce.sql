alter table public.productions
  add column if not exists access_mode text not null default 'ad_supported'
    check (access_mode in ('free','ad_supported','premium','pay_per_view')),
  add column if not exists purchase_price numeric(14,2)
    check (purchase_price is null or purchase_price >= 0),
  add column if not exists poster_url text;

alter table public.episodes
  add column if not exists vertical boolean not null default false;

create table if not exists public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete restrict,
  revenue_event_id uuid references public.revenue_events(id) on delete restrict,
  production_id uuid references public.productions(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending','available','paid','reversed')),
  created_at timestamptz not null default now()
);

alter table public.creator_earnings enable row level security;
create policy "creator reads own earnings" on public.creator_earnings
for select using (public.is_staff() or exists (
  select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()
));
