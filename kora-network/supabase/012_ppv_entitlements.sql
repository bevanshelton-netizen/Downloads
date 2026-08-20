-- KORA Phase 7: pay-per-view entitlement hardening.

create unique index if not exists purchases_provider_payment_unique
  on public.purchases(provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists purchases_user_production_status_idx
  on public.purchases(user_id, production_id, status, created_at desc)
  where production_id is not null;

-- Service-only completion after PayFast signature, merchant and remote ITN validation.
-- Amount is checked again inside the database and entitlement + cleared revenue are written atomically.
create or replace function public.complete_payfast_purchase(
  p_purchase_id uuid,
  p_provider_payment_id text,
  p_amount numeric
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_expected numeric;
  v_status text;
  v_existing_provider text;
begin
  if p_provider_payment_id is null or length(trim(p_provider_payment_id)) = 0 then
    raise exception 'Provider payment id is required';
  end if;

  select amount, status, provider_payment_id
  into v_expected, v_status, v_existing_provider
  from public.purchases
  where id = p_purchase_id and provider = 'payfast'
  for update;

  if v_expected is null then raise exception 'Purchase not found'; end if;
  if abs(v_expected - p_amount) > 0.01 then raise exception 'Purchase amount mismatch'; end if;

  if v_status = 'complete' then
    if v_existing_provider = p_provider_payment_id then return p_purchase_id; end if;
    raise exception 'Purchase is already complete with another provider payment';
  end if;

  update public.purchases
  set status = 'complete', provider_payment_id = p_provider_payment_id
  where id = p_purchase_id;

  insert into public.revenue_events(source_type, source_id, gross_amount, currency, cleared, cleared_at)
  values('payfast_purchase', p_provider_payment_id, p_amount, 'ZAR', true, now())
  on conflict (source_type, source_id) where source_id is not null do nothing;

  return p_purchase_id;
end;
$$;

revoke all on function public.complete_payfast_purchase(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.complete_payfast_purchase(uuid,text,numeric) to service_role;
