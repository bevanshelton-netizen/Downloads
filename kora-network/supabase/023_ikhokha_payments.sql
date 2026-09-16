-- KORA iKhokha payment completion hardening.
-- Keeps one-time PPV and ticket settlement atomic and idempotent.

create or replace function public.complete_ikhokha_purchase(
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
  where id = p_purchase_id and provider = 'ikhokha'
  for update;

  if v_expected is null then raise exception 'Purchase not found'; end if;
  if abs(v_expected - p_amount) > 0.01 then raise exception 'Purchase amount mismatch'; end if;

  if v_status = 'complete' then
    if v_existing_provider = p_provider_payment_id then return p_purchase_id; end if;
    raise exception 'Purchase is already complete with another provider payment';
  end if;

  if v_status <> 'pending' then raise exception 'Purchase is not pending'; end if;

  update public.purchases
  set status = 'complete', provider_payment_id = p_provider_payment_id
  where id = p_purchase_id;

  insert into public.revenue_events(source_type, source_id, gross_amount, currency, cleared, cleared_at)
  values('ikhokha_purchase', p_provider_payment_id, p_amount, 'ZAR', true, now())
  on conflict (source_type, source_id) where source_id is not null do nothing;

  return p_purchase_id;
end;
$$;

create or replace function public.complete_ikhokha_ticket_order(
  p_order_id uuid,
  p_provider_payment_id text,
  p_amount numeric
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.ticket_orders%rowtype;
  v_rows integer;
  i integer;
begin
  if coalesce(p_provider_payment_id, '') = '' then
    raise exception 'Provider payment ID required';
  end if;

  select * into v_order
  from public.ticket_orders
  where id = p_order_id and provider = 'ikhokha'
  for update;

  if v_order.id is null then raise exception 'Ticket order not found'; end if;

  if v_order.status = 'complete' then
    if v_order.provider_payment_id = p_provider_payment_id then return; end if;
    raise exception 'Ticket order already completed by another payment';
  end if;

  if v_order.status <> 'pending' then raise exception 'Ticket order is not pending'; end if;
  if abs(v_order.total_amount - p_amount) > 0.01 then raise exception 'Ticket amount mismatch'; end if;
  if v_order.reservation_expires_at < now() then raise exception 'Ticket reservation expired'; end if;

  update public.ticket_tiers
  set reserved_count = reserved_count - v_order.quantity,
      sold_count = sold_count + v_order.quantity
  where id = v_order.tier_id and reserved_count >= v_order.quantity;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Ticket inventory inconsistency'; end if;

  update public.ticket_orders
  set status = 'complete',
      provider_payment_id = p_provider_payment_id,
      completed_at = now()
  where id = v_order.id;

  for i in 1..v_order.quantity loop
    insert into public.event_tickets(order_id, user_id, event_id, tier_id)
    values(v_order.id, v_order.user_id, v_order.event_id, v_order.tier_id);
  end loop;

  insert into public.revenue_events(source_type, source_id, gross_amount, currency, cleared, cleared_at)
  values('ikhokha_ticket', p_provider_payment_id, p_amount, v_order.currency, true, now())
  on conflict(source_type, source_id) where source_id is not null do nothing;
end;
$$;

revoke all on function public.complete_ikhokha_purchase(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.complete_ikhokha_purchase(uuid,text,numeric) to service_role;

revoke all on function public.complete_ikhokha_ticket_order(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.complete_ikhokha_ticket_order(uuid,text,numeric) to service_role;

update public.platform_release_state
set schema_version = greatest(schema_version, 23), updated_at = now()
where singleton = true;
