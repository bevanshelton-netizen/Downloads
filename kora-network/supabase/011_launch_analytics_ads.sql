-- KORA Phase 6: approved ad creatives, budgeted contextual delivery and privacy-safe reporting.

alter table public.campaigns
  add column if not exists media_cpm numeric(14,2) not null default 0 check (media_cpm >= 0),
  add column if not exists media_spend numeric(14,4) not null default 0 check (media_spend >= 0);

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
  cost_amount numeric(14,4) not null default 0 check (cost_amount >= 0),
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

-- Raw delivery rows can contain user/profile identifiers. Keep them staff-only.
create policy "staff reads ad deliveries" on public.ad_deliveries
for select using (public.is_staff());
create policy "staff manages ad deliveries" on public.ad_deliveries
for all using (public.is_staff()) with check (public.is_staff());

-- Service-only atomic media reservation. Campaign reward allocation is reserved from media spend.
create or replace function public.issue_contextual_ad_delivery(
  p_campaign_id uuid,
  p_creative_id uuid,
  p_user_id uuid,
  p_viewer_profile_id uuid,
  p_episode_id uuid,
  p_channel_id uuid,
  p_placement_type text,
  p_reward_eligible boolean
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_budget numeric;
  v_reward_budget numeric;
  v_media_cpm numeric;
  v_media_spend numeric;
  v_status text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_cost numeric;
  v_family_safe boolean;
  v_profile_kind text;
  v_profile_owner uuid;
  v_profile_rewards boolean;
  v_delivery uuid;
begin
  if p_placement_type not in ('pre_roll','mid_roll','post_roll','sponsored_unlock','display') then
    raise exception 'Unsupported placement type';
  end if;

  select budget, reward_pool, media_cpm, media_spend, status, starts_at, ends_at
  into v_budget, v_reward_budget, v_media_cpm, v_media_spend, v_status, v_starts, v_ends
  from public.campaigns where id = p_campaign_id for update;

  if v_status is distinct from 'active' then raise exception 'Campaign is not active'; end if;
  if v_starts is not null and v_starts > now() then raise exception 'Campaign has not started'; end if;
  if v_ends is not null and v_ends <= now() then raise exception 'Campaign has ended'; end if;
  if v_media_cpm <= 0 then raise exception 'Campaign media rate is not configured'; end if;

  select family_safe into v_family_safe
  from public.campaign_creatives
  where id = p_creative_id and campaign_id = p_campaign_id and status = 'approved';
  if v_family_safe is null then raise exception 'Approved campaign creative not found'; end if;

  if p_viewer_profile_id is not null then
    select profile_kind, owner_id, rewards_allowed
    into v_profile_kind, v_profile_owner, v_profile_rewards
    from public.viewer_profiles where id = p_viewer_profile_id;
    if v_profile_owner is null or p_user_id is null or v_profile_owner <> p_user_id then
      raise exception 'Viewer profile ownership mismatch';
    end if;
    if v_profile_kind = 'child' and v_family_safe is not true then raise exception 'Creative is not eligible for Kids inventory'; end if;
    if v_profile_kind = 'child' and p_reward_eligible then raise exception 'Kids profiles cannot receive cash rewards'; end if;
    if p_reward_eligible and v_profile_rewards is not true then raise exception 'Viewer profile does not permit rewards'; end if;
  end if;

  v_cost := round(v_media_cpm / 1000.0, 4);
  if v_media_spend + v_cost > greatest(v_budget - v_reward_budget, 0) then raise exception 'Campaign media budget exhausted'; end if;

  update public.campaigns set media_spend = media_spend + v_cost where id = p_campaign_id;

  insert into public.ad_deliveries(
    campaign_id, creative_id, user_id, viewer_profile_id, episode_id, channel_id,
    placement_type, reward_eligible, cost_amount
  ) values (
    p_campaign_id, p_creative_id, p_user_id, p_viewer_profile_id, p_episode_id, p_channel_id,
    p_placement_type, p_reward_eligible, v_cost
  ) returning id into v_delivery;

  return v_delivery;
end;
$$;

revoke all on function public.issue_contextual_ad_delivery(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.issue_contextual_ad_delivery(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean) to service_role;

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
  deliveries bigint,
  media_spend numeric,
  media_cpm numeric
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_spend numeric;
  v_cpm numeric;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select c.name, c.media_spend, c.media_cpm into v_name, v_spend, v_cpm
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
    (select count(*) from public.ad_deliveries d where d.campaign_id = p_campaign_id)::bigint,
    v_spend, v_cpm
  from public.ad_events ae
  where ae.campaign_id = p_campaign_id;
end;
$$;

revoke all on function public.advertiser_campaign_summary(uuid) from public, anon;
grant execute on function public.advertiser_campaign_summary(uuid) to authenticated;
