-- KORA measurable viewing + moderated ad delivery layer.

alter table public.campaigns
  add column if not exists target_genres text[] not null default '{}',
  add column if not exists target_languages text[] not null default '{}',
  add column if not exists frequency_cap_per_day integer not null default 3 check (frequency_cap_per_day between 1 and 50),
  add column if not exists cpm_rate numeric(14,2) not null default 0 check (cpm_rate >= 0);

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  media_type text not null check (media_type in ('image','video')),
  media_url text not null,
  click_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 300),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','paused')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.ad_events
  add column if not exists creative_id uuid references public.ad_creatives(id) on delete set null,
  add column if not exists episode_id uuid references public.episodes(id) on delete set null,
  add column if not exists placement text,
  add column if not exists session_id text,
  add column if not exists watched_seconds integer not null default 0 check (watched_seconds >= 0),
  add column if not exists verified_at timestamptz;

create unique index if not exists ad_events_one_type_per_session_idx
  on public.ad_events(campaign_id, user_id, creative_id, event_type, session_id)
  where user_id is not null and creative_id is not null and session_id is not null;

create index if not exists ad_creatives_campaign_status_idx
  on public.ad_creatives(campaign_id, moderation_status, created_at);
create index if not exists ad_events_campaign_type_verified_idx
  on public.ad_events(campaign_id, event_type, verified, created_at);
create index if not exists watch_events_episode_type_created_idx
  on public.watch_events(episode_id, event_type, created_at);

alter table public.ad_creatives enable row level security;

create policy "advertiser reads own creatives" on public.ad_creatives
for select using (public.is_staff() or exists (
  select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()
));
create policy "advertiser creates own creatives" on public.ad_creatives
for insert to authenticated with check (exists (
  select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()
));
create policy "advertiser updates pending creatives" on public.ad_creatives
for update using (
  moderation_status = 'pending' and exists (
    select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()
  )
) with check (
  moderation_status = 'pending' and exists (
    select 1 from public.campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid()
  )
);
create policy "staff manages creatives" on public.ad_creatives
for all using (public.is_staff()) with check (public.is_staff());

-- Aggregate creator analytics only. Do not expose viewer IDs, session IDs or child-profile IDs.
create or replace function public.get_creator_analytics(p_days integer default 30)
returns table(
  production_id uuid,
  production_title text,
  starts bigint,
  heartbeats bigint,
  engaged_seconds bigint,
  distinct_sessions bigint,
  latest_activity timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    p.id,
    p.title,
    count(*) filter (where w.event_type = 'start')::bigint,
    count(*) filter (where w.event_type = 'heartbeat')::bigint,
    coalesce(sum(w.seconds_watched), 0)::bigint,
    count(distinct w.session_id) filter (where w.session_id is not null)::bigint,
    max(w.created_at)
  from public.productions p
  join public.creators c on c.id = p.creator_id
  left join public.episodes e on e.production_id = p.id
  left join public.watch_events w on w.episode_id = e.id
    and w.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days,30), 365)))
  where c.owner_id = auth.uid()
  group by p.id, p.title
  order by max(w.created_at) desc nulls last, p.title;
$$;

revoke all on function public.get_creator_analytics(integer) from public, anon;
grant execute on function public.get_creator_analytics(integer) to authenticated;

-- Aggregate advertiser reporting only. Viewer identifiers stay hidden.
create or replace function public.get_advertiser_campaign_analytics(p_days integer default 30)
returns table(
  campaign_id uuid,
  campaign_name text,
  impressions bigint,
  verified_impressions bigint,
  clicks bigint,
  completions bigint,
  verified_completions bigint,
  distinct_sessions bigint,
  latest_activity timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    c.id,
    c.name,
    count(*) filter (where a.event_type = 'impression')::bigint,
    count(*) filter (where a.event_type = 'impression' and a.verified)::bigint,
    count(*) filter (where a.event_type = 'click')::bigint,
    count(*) filter (where a.event_type = 'complete')::bigint,
    count(*) filter (where a.event_type = 'complete' and a.verified)::bigint,
    count(distinct a.session_id) filter (where a.session_id is not null)::bigint,
    max(a.created_at)
  from public.campaigns c
  left join public.ad_events a on a.campaign_id = c.id
    and a.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days,30), 365)))
  where c.advertiser_id = auth.uid()
  group by c.id, c.name
  order by max(a.created_at) desc nulls last, c.name;
$$;

revoke all on function public.get_advertiser_campaign_analytics(integer) from public, anon;
grant execute on function public.get_advertiser_campaign_analytics(integer) to authenticated;

-- Staff moderation updates are intentionally separate from advertiser writes.
create or replace function public.review_ad_creative(
  p_creative_id uuid,
  p_decision text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if p_decision not in ('approved','rejected','paused') then raise exception 'Invalid creative decision'; end if;

  update public.ad_creatives
  set moderation_status = p_decision,
      rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_reason),'') else null end,
      reviewed_at = now()
  where id = p_creative_id;

  if not found then raise exception 'Creative not found'; end if;
  return p_creative_id;
end;
$$;

revoke all on function public.review_ad_creative(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_ad_creative(uuid, text, text) to service_role;
