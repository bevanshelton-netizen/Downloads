-- KORA Phase 6: approved ad creatives, contextual delivery and privacy-safe reporting.

create table if not exists public.campaign_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  media_url text not null,
  click_url text,
  duration_seconds integer not null default 15 check (duration_seconds between 5 and 180),
  family_safe boolean not null default true,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','archived')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_url ~ '^https://'),
  check (click_url is null or click_url ~ '^https://')
);

create table if not exists public.ad_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  creative_id uuid not null references public.campaign_creatives(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  viewer_profile_id uuid references public.viewer_profiles(id) on delete set null,
  episode_id uuid references public.episodes(id) on delete set null,
  channel_id uuid references public.live_channels(id) on delete set null,
  placement_type text not null default 'pre_roll' check (placement_type in ('pre_roll','mid_roll','post_roll','sponsored_unlock','display')),
  reward_eligible boolean not null default false,
  served_at timestamptz not null default now(),
  completed_at timestamptz,
  verified boolean not null default false
);

alter table public.ad_events
  add column if not exists delivery_id uuid references public.ad_deliveries(id) on delete set null,
  add column if not exists creative_id uuid references public.campaign_creatives(id) on delete set null,
  add column if not exists viewer_profile_id uuid references public.viewer_profiles(id) on delete set null,
  add column if not exists episode_id uuid references public.episodes(id) on delete set null;

create unique index if not exists ad_events_delivery_type_unique
  on public.ad_events(delivery_id, event_type)
  where delivery_id is not null;
create index if not exists campaign_creatives_campaign_status_idx
  on public.campaign_creatives(campaign_id, status, created_at desc);
create index if not exists ad_deliveries_campaign_served_idx
  on public.ad_deliveries(campaign_id, served_at desc);
create index if not exists watch_events_episode_created_idx
  on public.watch_events(episode_id, created_at desc);

alter table public.campaign_creatives enable row level security;
alter table public.ad_deliveries enable row level security;

create policy "advertiser reads own creatives" on public.campaign_creatives
for select using (
  public.is_staff() or exists (
    select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()
  )
);
create policy "advertiser creates own draft creatives" on public.campaign_creatives
for insert to authenticated with check (
  status = 'draft' and exists (
    select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()
  )
);
create policy "advertiser edits own unapproved creatives" on public.campaign_creatives
for update using (
  status in ('draft','rejected') and exists (
    select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()
  )
) with check (
  status in ('draft','submitted') and exists (
    select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()
  )
);
create policy "staff manages creatives" on public.campaign_creatives
for all using (public.is_staff()) with check (public.is_staff());

-- Raw ad deliveries can contain user/profile identifiers. Keep them staff-only.
create policy "staff reads ad deliveries" on public.ad_deliveries
for select using (public.is_staff());
create policy "staff manages ad deliveries" on public.ad_deliveries
for all using (public.is_staff()) with check (public.is_staff());

-- Aggregated creator metrics only: no viewer identities are returned.
create or replace function public.creator_performance_summary(p_days integer default 30)
returns table (
  production_id uuid,
  production_title text,
  views bigint,
  watch_seconds bigint,
  completions bigint,
  creator_revenue numeric
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_days < 1 or p_days > 365 then raise exception 'Days must be between 1 and 365'; end if;

  return query
  with owned as (
    select p.id, p.title
    from public.productions p
    join public.creators c on c.id = p.creator_id
    where c.owner_id = v_user
  ), watch as (
    select e.production_id,
      count(*) filter (where w.event_type in ('start','play','view'))::bigint as views,
      coalesce(sum(w.seconds_watched),0)::bigint as watch_seconds,
      count(*) filter (where w.event_type in ('complete','completed'))::bigint as completions
    from public.watch_events w
    join public.episodes e on e.id = w.episode_id
    join owned o on o.id = e.production_id
    where w.created_at >= now() - make_interval(days => p_days)
    group by e.production_id
  ), revenue as (
    select a.production_id, coalesce(sum(a.creator_amount),0)::numeric as creator_revenue
    from public.creator_revenue_allocations a
    join owned o on o.id = a.production_id
    where a.created_at >= now() - make_interval(days => p_days)
    group by a.production_id
  )
  select o.id, o.title,
    coalesce(w.views,0), coalesce(w.watch_seconds,0), coalesce(w.completions,0), coalesce(r.creator_revenue,0)
  from owned o
  left join watch w on w.production_id = o.id
  left join revenue r on r.production_id = o.id
  order by coalesce(w.views,0) desc, o.title;
end;
$$;

revoke all on function public.creator_performance_summary(integer) from public, anon;
grant execute on function public.creator_performance_summary(integer) to authenticated;

-- Advertisers receive campaign aggregates, never viewer identities.
create or replace function public.advertiser_campaign_summary(p_campaign_id uuid)
returns table (
  campaign_id uuid,
  campaign_name text,
  impressions bigint,
  clicks bigint,
  completions bigint,
  verified_completions bigint,
  rewards_paid numeric,
  deliveries bigint
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select c.name into v_name
  from public.campaigns c
  where c.id = p_campaign_id
    and (c.advertiser_id = v_user or public.is_staff());
  if v_name is null then raise exception 'Campaign not found'; end if;

  return query
  select p_campaign_id, v_name,
    count(*) filter (where ae.event_type = 'impression')::bigint,
    count(*) filter (where ae.event_type = 'click')::bigint,
    count(*) filter (where ae.event_type = 'complete')::bigint,
    count(*) filter (where ae.event_type = 'complete' and ae.verified = true)::bigint,
    coalesce((select sum(rc.amount) from public.reward_claims rc join public.ad_events e2 on e2.id = rc.ad_event_id where e2.campaign_id = p_campaign_id),0)::numeric,
    (select count(*) from public.ad_deliveries d where d.campaign_id = p_campaign_id)::bigint
  from public.ad_events ae
  where ae.campaign_id = p_campaign_id;
end;
$$;

revoke all on function public.advertiser_campaign_summary(uuid) from public, anon;
grant execute on function public.advertiser_campaign_summary(uuid) to authenticated;
