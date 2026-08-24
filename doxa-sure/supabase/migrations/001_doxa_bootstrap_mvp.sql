-- DOXA-SURE Bootstrap MVP for a SHARED Supabase project.
-- Safe rule: every table/function/trigger/policy/storage bucket is DOXA-prefixed.
-- It does NOT drop or replace Allegro-Vibez tables, functions, auth triggers, or storage buckets.
-- Principle: Membership instant. Insurance delayed. Rescue audited.

begin;
create extension if not exists pgcrypto;

create table if not exists public.doxa_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  employment_type text check (employment_type in ('permanent','contract','self_employed','unemployed','other')),
  monthly_income numeric(14,2) check (monthly_income is null or monthly_income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doxa_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.doxa_profiles(id) on delete cascade,
  plan text not null default 'pilot' check (plan in ('pilot','rescue','rescue_360')),
  status text not null default 'active' check (status in ('active','past_due','cancelled')),
  distress_status text not null default 'none' check (distress_status in ('none','watch','active_case')),
  start_date date not null default current_date,
  price_monthly numeric(10,2) not null default 0 check (price_monthly >= 0),
  protection_score int not null default 20 check (protection_score between 0 and 100),
  exposed_value numeric(16,2) not null default 0 check (exposed_value >= 0),
  score_version text not null default 'v1',
  score_calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doxa_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.doxa_profiles(id) on delete cascade,
  type text not null check (type in ('home','vehicle','income','family','business','other')),
  label text,
  status text not null default 'green' check (status in ('green','amber','red')),
  lender_name text,
  outstanding_balance numeric(16,2) check (outstanding_balance is null or outstanding_balance >= 0),
  monthly_instalment numeric(14,2) check (monthly_instalment is null or monthly_instalment >= 0),
  next_due_date date,
  arrears_count int not null default 0 check (arrears_count >= 0),
  arrears_amount numeric(14,2) not null default 0 check (arrears_amount >= 0),
  has_credit_life boolean,
  credit_life_insurer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doxa_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.doxa_profiles(id) on delete cascade,
  asset_id uuid references public.doxa_assets(id) on delete set null,
  type text not null check (type in ('bond_statement','vehicle_statement','payslip','retrenchment_letter','s129_notice','credit_life_policy','uif_doc','medical_certificate','bank_correspondence','other')),
  bucket text not null default 'doxa-vault-docs',
  object_path text not null,
  original_name text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  uploaded_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create sequence if not exists public.doxa_rescue_case_number_seq start 1;

create table if not exists public.doxa_rescue_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  user_id uuid not null references public.doxa_profiles(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('retrenchment','reduced_income','disability','business_collapse','family_emergency','legal_letter','missed_payment','other')),
  trigger_date date not null default current_date,
  severity text not null check (severity in ('low','medium','high','critical')),
  snapshot jsonb not null,
  snapshot_version text not null default 'v1',
  status text not null default 'triaged' check (status in ('triaged','action_required','with_professional','resolved','closed')),
  protection_score_before int check (protection_score_before between 0 and 100),
  protection_score_after int check (protection_score_after is null or protection_score_after between 0 and 100),
  customer_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.doxa_rescue_actions (
  id uuid primary key default gen_random_uuid(),
  rescue_case_id uuid not null references public.doxa_rescue_cases(id) on delete cascade,
  type text not null check (type in ('credit_life_check','budget_freeze','mortgage_hardship_engagement','vehicle_hardship_engagement','debt_support_assessment','attorney_review','document_request','provider_complaint','professional_referral','other')),
  title text not null,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  status text not null default 'pending' check (status in ('pending','in_progress','waiting_for_doc','completed','blocked')),
  owner text not null default 'customer' check (owner in ('customer','doxa_sure','professional')),
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  is_regulated_activity boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doxa_action_logs (
  id bigint generated always as identity primary key,
  action_id uuid not null references public.doxa_rescue_actions(id) on delete cascade,
  rescue_case_id uuid not null references public.doxa_rescue_cases(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null check (event_type in ('created','status_changed','updated')),
  old_state jsonb,
  new_state jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.doxa_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.doxa_profiles(id) on delete cascade,
  consent_type text not null check (consent_type in ('privacy','terms','document_processing','professional_referral')),
  consent_version text not null,
  granted boolean not null,
  source text not null default 'web' check (source in ('web','admin','paper')),
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (user_id, consent_type, consent_version)
);

create index if not exists doxa_idx_assets_user_type on public.doxa_assets(user_id,type);
create index if not exists doxa_idx_documents_user_type on public.doxa_documents(user_id,type);
create index if not exists doxa_idx_cases_user_status on public.doxa_rescue_cases(user_id,status,created_at desc);
create index if not exists doxa_idx_actions_case_status on public.doxa_rescue_actions(rescue_case_id,status);
create index if not exists doxa_idx_logs_case_created on public.doxa_action_logs(rescue_case_id,created_at);

create or replace function public.doxa_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;

drop trigger if exists doxa_profiles_updated_at on public.doxa_profiles;
create trigger doxa_profiles_updated_at before update on public.doxa_profiles for each row execute function public.doxa_set_updated_at();
drop trigger if exists doxa_memberships_updated_at on public.doxa_memberships;
create trigger doxa_memberships_updated_at before update on public.doxa_memberships for each row execute function public.doxa_set_updated_at();
drop trigger if exists doxa_assets_updated_at on public.doxa_assets;
create trigger doxa_assets_updated_at before update on public.doxa_assets for each row execute function public.doxa_set_updated_at();
drop trigger if exists doxa_actions_updated_at on public.doxa_rescue_actions;
create trigger doxa_actions_updated_at before update on public.doxa_rescue_actions for each row execute function public.doxa_set_updated_at();

create or replace function public.doxa_bootstrap_auth_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.doxa_profiles(id,email) values(new.id,new.email) on conflict(id) do nothing;
  insert into public.doxa_memberships(user_id,plan,status,price_monthly) values(new.id,'pilot','active',0) on conflict(user_id) do nothing;
  return new;
end; $$;

-- Unique trigger name: does not replace Allegro-Vibez's auth trigger.
drop trigger if exists doxa_on_auth_user_created on auth.users;
create trigger doxa_on_auth_user_created after insert on auth.users for each row execute function public.doxa_bootstrap_auth_user();

-- Supports users who already existed in Allegro-Vibez Auth before DOXA-SURE was added.
create or replace function public.doxa_ensure_member() returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_email text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select email into v_email from auth.users where id=v_user;
  insert into public.doxa_profiles(id,email) values(v_user,v_email) on conflict(id) do update set email=excluded.email;
  insert into public.doxa_memberships(user_id,plan,status,price_monthly) values(v_user,'pilot','active',0) on conflict(user_id) do nothing;
end; $$;

create or replace function public.doxa_calc_protection_score(p_user uuid) returns int language plpgsql stable security definer set search_path=public as $$
declare v_assets int:=0; v_red int:=0; v_amber int:=0; v_arrears int:=0; v_docs int:=0; v_employment text; v_score int:=0;
begin
  select count(*),count(*) filter(where status='red'),count(*) filter(where status='amber'),coalesce(sum(least(arrears_count,4)),0) into v_assets,v_red,v_amber,v_arrears from public.doxa_assets where user_id=p_user;
  select count(*) into v_docs from public.doxa_documents where user_id=p_user;
  select employment_type into v_employment from public.doxa_profiles where id=p_user;
  v_score:=v_score+greatest(0,40-least(40,v_arrears*10));
  if v_assets=0 then v_score:=v_score+5; else v_score:=v_score+greatest(0,30-(v_red*15)-(v_amber*7)); end if;
  v_score:=v_score+case v_employment when 'permanent' then 20 when 'contract' then 15 when 'self_employed' then 12 when 'other' then 8 when 'unemployed' then 0 else 5 end;
  v_score:=v_score+least(10,v_docs*2);
  return greatest(0,least(100,v_score));
end; $$;

create or replace function public.doxa_refresh_member_metrics(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_score int; v_exposed numeric(16,2);
begin
  v_score:=public.doxa_calc_protection_score(p_user);
  select coalesce(sum(outstanding_balance),0) into v_exposed from public.doxa_assets where user_id=p_user;
  update public.doxa_memberships set protection_score=v_score,exposed_value=v_exposed,score_version='v1',score_calculated_at=now() where user_id=p_user;
end; $$;

create or replace function public.doxa_refresh_metrics_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin if tg_op='DELETE' then perform public.doxa_refresh_member_metrics(old.user_id); return old; else perform public.doxa_refresh_member_metrics(new.user_id); return new; end if; end; $$;

drop trigger if exists doxa_assets_refresh_metrics on public.doxa_assets;
create trigger doxa_assets_refresh_metrics after insert or update or delete on public.doxa_assets for each row execute function public.doxa_refresh_metrics_trigger();
drop trigger if exists doxa_documents_refresh_metrics on public.doxa_documents;
create trigger doxa_documents_refresh_metrics after insert or update or delete on public.doxa_documents for each row execute function public.doxa_refresh_metrics_trigger();

create or replace function public.doxa_profile_metrics_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin if old.employment_type is distinct from new.employment_type then perform public.doxa_refresh_member_metrics(new.id); end if; return new; end; $$;
drop trigger if exists doxa_profiles_refresh_metrics on public.doxa_profiles;
create trigger doxa_profiles_refresh_metrics after update on public.doxa_profiles for each row execute function public.doxa_profile_metrics_trigger();

create or replace function public.doxa_create_rescue_case(p_trigger_type text,p_notes text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid(); v_case_id uuid; v_case_number text; v_score int; v_exposed numeric(16,2); v_snapshot jsonb;
  v_max_arrears int:=0; v_has_home boolean:=false; v_has_vehicle boolean:=false; v_has_s129 boolean:=false; v_has_docs boolean:=false; v_severity text:='medium';
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_trigger_type not in ('retrenchment','reduced_income','disability','business_collapse','family_emergency','legal_letter','missed_payment','other') then raise exception 'Invalid trigger type'; end if;
  perform public.doxa_ensure_member(); perform public.doxa_refresh_member_metrics(v_user);
  select protection_score,exposed_value into v_score,v_exposed from public.doxa_memberships where user_id=v_user;
  select coalesce(max(arrears_count),0),coalesce(bool_or(type='home'),false),coalesce(bool_or(type='vehicle'),false) into v_max_arrears,v_has_home,v_has_vehicle from public.doxa_assets where user_id=v_user;
  select exists(select 1 from public.doxa_documents where user_id=v_user and type='s129_notice'),exists(select 1 from public.doxa_documents where user_id=v_user) into v_has_s129,v_has_docs;
  if p_trigger_type='legal_letter' or v_has_s129 then v_severity:='critical'; elsif v_max_arrears>=2 or p_trigger_type in ('retrenchment','disability','business_collapse') then v_severity:='high'; elsif v_max_arrears=1 or p_trigger_type in ('reduced_income','missed_payment') then v_severity:='medium'; else v_severity:='low'; end if;
  select jsonb_build_object('captured_at',now(),'score',v_score,'exposed_value',v_exposed,'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'type',a.type,'label',a.label,'status',a.status,'lender_name',a.lender_name,'outstanding_balance',a.outstanding_balance,'monthly_instalment',a.monthly_instalment,'next_due_date',a.next_due_date,'arrears_count',a.arrears_count,'arrears_amount',a.arrears_amount,'has_credit_life',a.has_credit_life,'credit_life_insurer',a.credit_life_insurer) order by a.created_at) from public.doxa_assets a where a.user_id=v_user),'[]'::jsonb)) into v_snapshot;
  v_case_number:='DS-'||extract(year from current_date)::int::text||'-'||lpad(nextval('public.doxa_rescue_case_number_seq')::text,6,'0');
  insert into public.doxa_rescue_cases(case_number,user_id,trigger_type,severity,snapshot,protection_score_before,customer_notes,status) values(v_case_number,v_user,p_trigger_type,v_severity,v_snapshot,v_score,p_notes,'action_required') returning id into v_case_id;
  insert into public.doxa_rescue_actions(rescue_case_id,type,title,risk_level,owner,due_at,notes) values
    (v_case_id,'budget_freeze','Stabilise household cash flow',v_severity,'customer',now()+interval '1 day','Pause non-essential spending and list critical payments due in the next 30 days.'),
    (v_case_id,'credit_life_check','Check existing credit-life or payment protection',v_severity,'customer',now()+interval '1 day','Upload any credit-life policy, finance agreement, or lender insurance schedule you already have.');
  if v_has_home then insert into public.doxa_rescue_actions(rescue_case_id,type,title,risk_level,owner,due_at,notes) values(v_case_id,'mortgage_hardship_engagement','Prepare early home-loan hardship engagement',v_severity,'doxa_sure',now()+interval '2 days','Prepare facts and documents for early engagement with the lender. This is assistance, not legal or financial advice.'); end if;
  if v_has_vehicle then insert into public.doxa_rescue_actions(rescue_case_id,type,title,risk_level,owner,due_at,notes) values(v_case_id,'vehicle_hardship_engagement','Prepare early vehicle-finance hardship engagement',v_severity,'doxa_sure',now()+interval '2 days','Prepare facts and documents for engagement with the vehicle-finance provider before the position worsens.'); end if;
  if v_max_arrears>=2 then insert into public.doxa_rescue_actions(rescue_case_id,type,title,risk_level,owner,due_at,notes) values(v_case_id,'debt_support_assessment','Assess whether regulated debt support is appropriate','high','doxa_sure',now()+interval '1 day','If formal debt counselling is indicated, refer only to an NCR-registered debt counsellor.'); end if;
  if p_trigger_type='legal_letter' or v_has_s129 then insert into public.doxa_rescue_actions(rescue_case_id,type,title,risk_level,owner,due_at,notes,is_regulated_activity) values(v_case_id,'attorney_review','Urgent legal-document review','critical','professional',now()+interval '1 day','Escalate to a suitably qualified attorney. DOXA-SURE does not provide legal representation itself.',true); end if;
  if not v_has_docs then insert into public.doxa_rescue_actions(rescue_case_id,type,title,risk_level,owner,due_at,notes) values(v_case_id,'document_request','Upload your key finance documents',v_severity,'customer',now()+interval '1 day','Start with the latest statement for the asset at risk and any letter from the lender.'); end if;
  update public.doxa_memberships set distress_status='active_case' where user_id=v_user;
  return v_case_id;
end; $$;

create or replace function public.doxa_set_my_action_status(p_action_id uuid,p_status text,p_notes text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_status not in ('pending','in_progress','waiting_for_doc','completed','blocked') then raise exception 'Invalid status'; end if;
  update public.doxa_rescue_actions a set status=p_status,notes=coalesce(p_notes,a.notes),completed_at=case when p_status='completed' then now() else null end where a.id=p_action_id and a.owner='customer' and exists(select 1 from public.doxa_rescue_cases c where c.id=a.rescue_case_id and c.user_id=v_user);
  if not found then raise exception 'Action not found or not customer-owned'; end if;
end; $$;

create or replace function public.doxa_log_action_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then insert into public.doxa_action_logs(action_id,rescue_case_id,actor_user_id,event_type,old_state,new_state) values(new.id,new.rescue_case_id,auth.uid(),'created',null,to_jsonb(new));
  elsif tg_op='UPDATE' then insert into public.doxa_action_logs(action_id,rescue_case_id,actor_user_id,event_type,old_state,new_state) values(new.id,new.rescue_case_id,auth.uid(),case when old.status is distinct from new.status then 'status_changed' else 'updated' end,to_jsonb(old),to_jsonb(new)); end if;
  return new;
end; $$;
drop trigger if exists doxa_actions_audit on public.doxa_rescue_actions;
create trigger doxa_actions_audit after insert or update on public.doxa_rescue_actions for each row execute function public.doxa_log_action_change();

alter table public.doxa_profiles enable row level security;
alter table public.doxa_memberships enable row level security;
alter table public.doxa_assets enable row level security;
alter table public.doxa_documents enable row level security;
alter table public.doxa_rescue_cases enable row level security;
alter table public.doxa_rescue_actions enable row level security;
alter table public.doxa_action_logs enable row level security;
alter table public.doxa_consents enable row level security;

-- All policy names are DOXA-specific.
drop policy if exists doxa_profiles_select_own on public.doxa_profiles; create policy doxa_profiles_select_own on public.doxa_profiles for select to authenticated using(id=auth.uid());
drop policy if exists doxa_profiles_update_own on public.doxa_profiles; create policy doxa_profiles_update_own on public.doxa_profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists doxa_memberships_select_own on public.doxa_memberships; create policy doxa_memberships_select_own on public.doxa_memberships for select to authenticated using(user_id=auth.uid());
drop policy if exists doxa_assets_select_own on public.doxa_assets; create policy doxa_assets_select_own on public.doxa_assets for select to authenticated using(user_id=auth.uid());
drop policy if exists doxa_assets_insert_own on public.doxa_assets; create policy doxa_assets_insert_own on public.doxa_assets for insert to authenticated with check(user_id=auth.uid());
drop policy if exists doxa_assets_update_own on public.doxa_assets; create policy doxa_assets_update_own on public.doxa_assets for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists doxa_assets_delete_own on public.doxa_assets; create policy doxa_assets_delete_own on public.doxa_assets for delete to authenticated using(user_id=auth.uid());
drop policy if exists doxa_documents_select_own on public.doxa_documents; create policy doxa_documents_select_own on public.doxa_documents for select to authenticated using(user_id=auth.uid());
drop policy if exists doxa_documents_insert_own on public.doxa_documents; create policy doxa_documents_insert_own on public.doxa_documents for insert to authenticated with check(user_id=auth.uid() and (asset_id is null or exists(select 1 from public.doxa_assets a where a.id=asset_id and a.user_id=auth.uid())));
drop policy if exists doxa_documents_delete_own on public.doxa_documents; create policy doxa_documents_delete_own on public.doxa_documents for delete to authenticated using(user_id=auth.uid());
drop policy if exists doxa_cases_select_own on public.doxa_rescue_cases; create policy doxa_cases_select_own on public.doxa_rescue_cases for select to authenticated using(user_id=auth.uid());
drop policy if exists doxa_actions_select_own on public.doxa_rescue_actions; create policy doxa_actions_select_own on public.doxa_rescue_actions for select to authenticated using(exists(select 1 from public.doxa_rescue_cases c where c.id=rescue_case_id and c.user_id=auth.uid()));
drop policy if exists doxa_logs_select_own on public.doxa_action_logs; create policy doxa_logs_select_own on public.doxa_action_logs for select to authenticated using(exists(select 1 from public.doxa_rescue_cases c where c.id=rescue_case_id and c.user_id=auth.uid()));
drop policy if exists doxa_consents_select_own on public.doxa_consents; create policy doxa_consents_select_own on public.doxa_consents for select to authenticated using(user_id=auth.uid());
drop policy if exists doxa_consents_insert_own on public.doxa_consents; create policy doxa_consents_insert_own on public.doxa_consents for insert to authenticated with check(user_id=auth.uid());
drop policy if exists doxa_consents_update_own on public.doxa_consents; create policy doxa_consents_update_own on public.doxa_consents for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit) values('doxa-vault-docs','doxa-vault-docs',false,10485760) on conflict(id) do update set public=false,file_size_limit=10485760;
drop policy if exists doxa_vault_select_own on storage.objects; create policy doxa_vault_select_own on storage.objects for select to authenticated using(bucket_id='doxa-vault-docs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists doxa_vault_insert_own on storage.objects; create policy doxa_vault_insert_own on storage.objects for insert to authenticated with check(bucket_id='doxa-vault-docs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists doxa_vault_delete_own on storage.objects; create policy doxa_vault_delete_own on storage.objects for delete to authenticated using(bucket_id='doxa-vault-docs' and (storage.foldername(name))[1]=auth.uid()::text);

revoke all on function public.doxa_ensure_member() from public; grant execute on function public.doxa_ensure_member() to authenticated;
revoke all on function public.doxa_create_rescue_case(text,text) from public; grant execute on function public.doxa_create_rescue_case(text,text) to authenticated;
revoke all on function public.doxa_set_my_action_status(uuid,text,text) from public; grant execute on function public.doxa_set_my_action_status(uuid,text,text) to authenticated;

commit;
