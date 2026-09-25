-- DOXA-SURE live-pilot security hardening.
-- Applied to the shared IZAKHONO WebStart Supabase project on 2026-09-25.
-- Public browser access remains limited to the validated lead RPC.

create index if not exists doxa_pilot_leads_email_created_idx
  on public.doxa_pilot_leads (lower(email), created_at desc);

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
  v_recent integer := 0;
begin
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return 'RECEIVED';
  end if;
  if not p_consent then raise exception 'Consent is required'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Enter a valid name'; end if;
  if v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid email address'; end if;
  if p_interest not in ('free_check','rescue_pack','shield','general_question') then raise exception 'Invalid enquiry type'; end if;
  if p_risk_level is not null and p_risk_level not in ('green','amber','red','critical') then raise exception 'Invalid risk level'; end if;

  select count(*) into v_recent
  from public.doxa_pilot_leads
  where lower(email)=v_email and created_at > now() - interval '1 hour';
  if v_recent >= 3 then raise exception 'Please wait before sending another request'; end if;

  insert into public.doxa_pilot_leads(name,email,phone,interest,risk_level,asset_type,message)
  values (
    trim(p_name), v_email, nullif(trim(coalesce(p_phone,'')),''),
    p_interest, p_risk_level,
    left(nullif(trim(coalesce(p_asset_type,'')),''),80),
    left(nullif(trim(coalesce(p_message,'')),''),1000)
  ) returning reference into v_reference;
  return v_reference;
end;
$$;

revoke all on function public.doxa_set_updated_at() from public, anon, authenticated;
revoke all on function public.doxa_bootstrap_auth_user() from public, anon, authenticated;
revoke all on function public.doxa_calc_protection_score(uuid) from public, anon, authenticated;
revoke all on function public.doxa_refresh_member_metrics(uuid) from public, anon, authenticated;
revoke all on function public.doxa_refresh_metrics_trigger() from public, anon, authenticated;
revoke all on function public.doxa_profile_metrics_trigger() from public, anon, authenticated;
revoke all on function public.doxa_log_action_change() from public, anon, authenticated;

revoke all on function public.doxa_ensure_member() from public, anon;
grant execute on function public.doxa_ensure_member() to authenticated;

revoke all on function public.doxa_create_rescue_case(text,text) from public, anon;
grant execute on function public.doxa_create_rescue_case(text,text) to authenticated;

revoke all on function public.doxa_set_my_action_status(uuid,text,text) from public, anon;
grant execute on function public.doxa_set_my_action_status(uuid,text,text) to authenticated;

revoke all on function public.doxa_submit_pilot_lead(text,text,text,text,text,text,text,boolean,text) from public;
grant execute on function public.doxa_submit_pilot_lead(text,text,text,text,text,text,text,boolean,text) to anon, authenticated;
