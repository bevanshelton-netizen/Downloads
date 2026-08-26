-- DOXA-SURE pilot lead capture and owner dashboard.
-- Public visitors may submit a validated lead through one RPC only.
-- Only explicitly enrolled DOXA administrators may read or update leads.

create table if not exists public.doxa_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.doxa_pilot_leads (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('DL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 5 and 254),
  phone text check (phone is null or char_length(phone) between 7 and 24),
  interest text not null check (interest in ('free_check','rescue_pack','shield','general_question')),
  risk_level text check (risk_level is null or risk_level in ('green','amber','red','critical')),
  asset_type text check (asset_type is null or char_length(asset_type) <= 80),
  message text check (message is null or char_length(message) <= 1000),
  consent_version text not null default 'pilot-leads-v1',
  consented_at timestamptz not null default now(),
  source text not null default 'github-pages',
  status text not null default 'new' check (status in ('new','contacted','qualified','closed')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000)
);

alter table public.doxa_admins enable row level security;
alter table public.doxa_pilot_leads enable row level security;

drop policy if exists doxa_admins_select_self on public.doxa_admins;
create policy doxa_admins_select_self on public.doxa_admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists doxa_leads_admin_select on public.doxa_pilot_leads;
create policy doxa_leads_admin_select on public.doxa_pilot_leads
  for select to authenticated
  using (exists (select 1 from public.doxa_admins a where a.user_id = auth.uid()));

drop policy if exists doxa_leads_admin_update on public.doxa_pilot_leads;
create policy doxa_leads_admin_update on public.doxa_pilot_leads
  for update to authenticated
  using (exists (select 1 from public.doxa_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.doxa_admins a where a.user_id = auth.uid()));

create or replace function public.doxa_submit_pilot_lead(
  p_name text,
  p_email text,
  p_phone text default null,
  p_interest text default 'free_check',
  p_risk_level text default null,
  p_asset_type text default null,
  p_message text default null,
  p_consent boolean default false,
  p_website text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference text;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  -- Honeypot: bots get a harmless response without creating a record.
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return 'RECEIVED';
  end if;
  if not p_consent then raise exception 'Consent is required'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Enter a valid name'; end if;
  if v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid email address'; end if;
  if p_interest not in ('free_check','rescue_pack','shield','general_question') then raise exception 'Invalid enquiry type'; end if;
  if p_risk_level is not null and p_risk_level not in ('green','amber','red','critical') then raise exception 'Invalid risk level'; end if;
  insert into public.doxa_pilot_leads(name,email,phone,interest,risk_level,asset_type,message)
  values (
    trim(p_name), v_email, nullif(trim(coalesce(p_phone,'')),''), p_interest, p_risk_level,
    left(nullif(trim(coalesce(p_asset_type,'')),''),80), left(nullif(trim(coalesce(p_message,'')),''),1000)
  ) returning reference into v_reference;
  return v_reference;
end;
$$;

revoke all on function public.doxa_submit_pilot_lead(text,text,text,text,text,text,text,boolean,text) from public;
grant execute on function public.doxa_submit_pilot_lead(text,text,text,text,text,text,text,boolean,text) to anon, authenticated;
grant select, update on public.doxa_pilot_leads to authenticated;
grant select on public.doxa_admins to authenticated;

-- After your owner account has signed in once, enrol it from the SQL editor:
-- insert into public.doxa_admins(user_id)
-- select id from auth.users where email = 'OWNER_EMAIL' on conflict do nothing;
