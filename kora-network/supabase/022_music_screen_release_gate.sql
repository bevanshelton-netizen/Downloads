-- KORA music-screen release quality, accessibility and commercial disclosure gates.

alter table public.productions
  add column if not exists sponsor_disclosure text,
  add column if not exists content_warnings text[] not null default '{}'::text[],
  add column if not exists archive_evidence_status text not null default 'not_applicable'
    check(archive_evidence_status in('not_applicable','pending','complete','blocked')),
  add column if not exists accessibility_status text not null default 'pending'
    check(accessibility_status in('pending','partial','complete','not_applicable'));

alter table public.episodes
  add column if not exists captions_status text not null default 'pending'
    check(captions_status in('pending','complete','not_applicable')),
  add column if not exists transcript_status text not null default 'pending'
    check(transcript_status in('pending','complete','not_applicable')),
  add column if not exists audio_description_status text not null default 'not_applicable'
    check(audio_description_status in('pending','complete','not_applicable'));

create table if not exists public.screen_release_checkpoints (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  checkpoint_code text not null,
  status text not null default 'pending' check(status in('pending','pass','fail','not_applicable')),
  evidence_reference text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique(production_id,checkpoint_code)
);

alter table public.screen_release_checkpoints enable row level security;

create policy "creator reads own screen checkpoints"
on public.screen_release_checkpoints for select
using(
  public.is_staff() or exists(
    select 1
    from public.productions p
    join public.creators c on c.id=p.creator_id
    where p.id=production_id and c.owner_id=auth.uid()
  )
);

create policy "staff manages screen checkpoints"
on public.screen_release_checkpoints for all
using(public.is_staff())
with check(public.is_staff());

create or replace function public.music_screen_release_ready(p_production_id uuid)
returns boolean
language plpgsql
security definer set search_path=public
as $$
declare
  v_rights text;
  v_status text;
  v_archive text;
  v_access text;
  v_failed integer;
begin
  select rights_clearance_status,status,archive_evidence_status,accessibility_status
  into v_rights,v_status,v_archive,v_access
  from public.productions where id=p_production_id;

  if v_rights is distinct from 'cleared' then return false; end if;
  if v_status not in ('review','published') then return false; end if;
  if v_archive='blocked' then return false; end if;
  if v_access='pending' then return false; end if;

  select count(*) into v_failed
  from public.screen_release_checkpoints
  where production_id=p_production_id and status in('pending','fail');

  return v_failed=0;
end;
$$;

revoke all on function public.music_screen_release_ready(uuid) from public,anon;
grant execute on function public.music_screen_release_ready(uuid) to authenticated,service_role;

update public.platform_release_state
set schema_version=greatest(schema_version,22),updated_at=now()
where singleton=true;
