-- KORA platform core: identity lifecycle, creator ownership, moderation and revenue-funded rewards.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.wallets (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator','admin')
  );
$$;

alter table public.live_channels enable row level security;
alter table public.schedule_items enable row level security;
alter table public.watch_events enable row level security;
alter table public.campaigns enable row level security;
alter table public.ad_events enable row level security;
alter table public.content_reports enable row level security;

create policy "profiles update self" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "public creator profiles" on public.creators
for select using (verified or owner_id = auth.uid() or public.is_staff());
create policy "creator creates self" on public.creators
for insert with check (owner_id = auth.uid());
create policy "creator updates self" on public.creators
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "creator reads own productions" on public.productions
for select using (
  status = 'published' or public.is_staff() or exists (
    select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()
  )
);
create policy "creator inserts own productions" on public.productions
for insert with check (exists (
  select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()
));
create policy "creator updates own productions" on public.productions
for update using (exists (
  select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.creators c where c.id = creator_id and c.owner_id = auth.uid()
));

create policy "creator reads own episodes" on public.episodes
for select using (
  status = 'published' or public.is_staff() or exists (
    select 1 from public.productions p
    join public.creators c on c.id = p.creator_id
    where p.id = production_id and c.owner_id = auth.uid()
  )
);
create policy "creator inserts own episodes" on public.episodes
for insert with check (exists (
  select 1 from public.productions p
  join public.creators c on c.id = p.creator_id
  where p.id = production_id and c.owner_id = auth.uid()
));
create policy "creator updates own episodes" on public.episodes
for update using (exists (
  select 1 from public.productions p
  join public.creators c on c.id = p.creator_id
  where p.id = production_id and c.owner_id = auth.uid()
));

create policy "public active channels" on public.live_channels
for select using (is_active);
create policy "public schedule" on public.schedule_items
for select using (true);
create policy "staff manages channels" on public.live_channels
for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manages schedule" on public.schedule_items
for all using (public.is_staff()) with check (public.is_staff());

create policy "authenticated records watch events" on public.watch_events
for insert to authenticated with check (user_id = auth.uid());
create policy "viewer reads own watch events" on public.watch_events
for select using (user_id = auth.uid() or public.is_staff());

create policy "advertiser owns campaigns" on public.campaigns
for all using (advertiser_id = auth.uid() or public.is_staff())
with check (advertiser_id = auth.uid() or public.is_staff());
create policy "advertiser reads campaign events" on public.ad_events
for select using (public.is_staff() or exists (
  select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()
));

create policy "authenticated creates reports" on public.content_reports
for insert to authenticated with check (reporter_id = auth.uid());
create policy "staff manages reports" on public.content_reports
for all using (public.is_staff()) with check (public.is_staff());

create table if not exists public.upload_assets (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  provider text not null,
  provider_asset_id text,
  upload_status text not null default 'pending',
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_reviews (
  id uuid primary key default gen_random_uuid(),
  production_id uuid references public.productions(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in ('approved','rejected','needs_changes')),
  reason text,
  created_at timestamptz not null default now(),
  check (production_id is not null or episode_id is not null)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'payfast',
  provider_subscription_id text,
  plan_code text not null,
  status text not null default 'pending',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  production_id uuid references public.productions(id) on delete restrict,
  episode_id uuid references public.episodes(id) on delete restrict,
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null default 'ZAR',
  provider text not null default 'payfast',
  provider_payment_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  check (production_id is not null or episode_id is not null)
);

create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text,
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  currency char(3) not null default 'ZAR',
  cleared boolean not null default false,
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_pools (
  id uuid primary key default gen_random_uuid(),
  revenue_event_id uuid not null references public.revenue_events(id) on delete restrict,
  funded_amount numeric(14,2) not null check (funded_amount >= 0),
  spent_amount numeric(14,2) not null default 0 check (spent_amount >= 0 and spent_amount <= funded_amount),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.upload_assets enable row level security;
alter table public.moderation_reviews enable row level security;
alter table public.subscriptions enable row level security;
alter table public.purchases enable row level security;
alter table public.revenue_events enable row level security;
alter table public.reward_pools enable row level security;
alter table public.payout_requests enable row level security;

create policy "creator owns upload assets" on public.upload_assets
for select using (public.is_staff() or exists (
  select 1 from public.episodes e
  join public.productions p on p.id = e.production_id
  join public.creators c on c.id = p.creator_id
  where e.id = episode_id and c.owner_id = auth.uid()
));
create policy "staff moderation" on public.moderation_reviews
for all using (public.is_staff()) with check (public.is_staff());
create policy "viewer reads own subscriptions" on public.subscriptions
for select using (user_id = auth.uid() or public.is_staff());
create policy "viewer reads own purchases" on public.purchases
for select using (user_id = auth.uid() or public.is_staff());
create policy "wallet owner payout requests" on public.payout_requests
for select using (public.is_staff() or exists (
  select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid()
));

create or replace function public.credit_verified_reward(
  p_user_id uuid,
  p_pool_id uuid,
  p_amount numeric,
  p_reason text,
  p_source_id text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet uuid;
  v_available numeric;
  v_entry uuid;
begin
  if p_amount <= 0 then raise exception 'Reward amount must be positive'; end if;

  select funded_amount - spent_amount into v_available
  from public.reward_pools rp
  join public.revenue_events re on re.id = rp.revenue_event_id
  where rp.id = p_pool_id and re.cleared = true
  for update of rp;

  if v_available is null or v_available < p_amount then
    raise exception 'Insufficient cleared reward funding';
  end if;

  select id into v_wallet from public.wallets where owner_id = p_user_id;
  if v_wallet is null then raise exception 'Wallet not found'; end if;

  insert into public.ledger_entries(wallet_id, kind, amount, reason, source_type, source_id)
  values(v_wallet, 'credit', p_amount, p_reason, 'reward_pool', coalesce(p_source_id, p_pool_id::text))
  returning id into v_entry;

  update public.reward_pools set spent_amount = spent_amount + p_amount where id = p_pool_id;
  return v_entry;
end;
$$;

revoke all on function public.credit_verified_reward(uuid, uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.credit_verified_reward(uuid, uuid, numeric, text, text) to service_role;
