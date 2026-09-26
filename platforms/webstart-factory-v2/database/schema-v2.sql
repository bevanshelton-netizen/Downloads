-- IZAKHONO WebStart Factory v2 — idempotent schema
alter table public.sites
  add column if not exists brief jsonb not null default '{}'::jsonb,
  add column if not exists design_directions jsonb not null default '[]'::jsonb,
  add column if not exists selected_direction text,
  add column if not exists qa_report jsonb not null default '{}'::jsonb,
  add column if not exists generation_mode text not null default 'manual',
  add column if not exists generated_at timestamptz,
  add column if not exists verified_at timestamptz;

alter table public.sites drop constraint if exists sites_generation_mode_check;
alter table public.sites add constraint sites_generation_mode_check check (generation_mode in ('manual','factory-fast','factory-ai'));
alter table public.sites drop constraint if exists sites_selected_direction_check;
alter table public.sites add constraint sites_selected_direction_check check (selected_direction is null or selected_direction in ('bold-growth','premium-trust','clean-modern'));

create table if not exists public.webstart_leads (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 254 and position('@' in email) > 1),
  phone text check (phone is null or char_length(phone) <= 50),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new','reviewed','contacted','closed')),
  created_at timestamptz not null default now()
);
alter table public.webstart_leads enable row level security;
revoke all on table public.webstart_leads from anon, authenticated;
grant insert on table public.webstart_leads to anon, authenticated;
grant select, update on table public.webstart_leads to authenticated;
grant select, insert, update, delete on table public.webstart_leads to service_role;

drop policy if exists webstart_public_submit_leads on public.webstart_leads;
create policy webstart_public_submit_leads on public.webstart_leads for insert to anon, authenticated
with check (exists (select 1 from public.sites s where s.id=webstart_leads.site_id and s.status='published'));
drop policy if exists webstart_owner_read_leads on public.webstart_leads;
create policy webstart_owner_read_leads on public.webstart_leads for select to authenticated
using (exists (select 1 from public.sites s where s.id=webstart_leads.site_id and s.owner_id=(select auth.uid())));
drop policy if exists webstart_owner_update_leads on public.webstart_leads;
create policy webstart_owner_update_leads on public.webstart_leads for update to authenticated
using (exists (select 1 from public.sites s where s.id=webstart_leads.site_id and s.owner_id=(select auth.uid())))
with check (exists (select 1 from public.sites s where s.id=webstart_leads.site_id and s.owner_id=(select auth.uid())));

create index if not exists webstart_leads_site_created_idx on public.webstart_leads(site_id,created_at desc);

revoke all on table public.sites from anon, authenticated;
grant select on table public.sites to anon;
grant select,insert,update,delete on table public.sites to authenticated;
grant select,insert,update,delete on table public.sites to service_role;
