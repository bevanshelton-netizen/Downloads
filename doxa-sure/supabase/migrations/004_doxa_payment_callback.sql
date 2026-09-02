-- Dedicated DOXA-SURE payment callback ledger. Apply only to the future
-- dedicated DOXA-SURE project; this migration is not applied by CI.
begin;

create table if not exists public.doxa_payment_events (
  event_id text primary key check (event_id ~ '^evt_[a-f0-9]{40}$'),
  order_id text not null unique,
  product_code text not null check (product_code = 'rescue-readiness-pack'),
  customer_reference text not null,
  payment_reference text not null unique check (payment_reference ~ '^DOXASURE-[0-9A-F]{8}$'),
  bank_reference text not null,
  amount_minor integer not null check (amount_minor = 19900),
  currency text not null check (currency = 'ZAR'),
  paid_at timestamptz not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table if not exists public.doxa_service_entitlements (
  order_id text primary key references public.doxa_payment_events(order_id) on delete restrict,
  customer_reference text not null,
  service text not null check (service = 'rescue-readiness-pack'),
  status text not null default 'paid_pending_fulfilment' check (status in ('paid_pending_fulfilment','in_fulfilment','fulfilled','refunded','cancelled')),
  activated_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

alter table public.doxa_payment_events enable row level security;
alter table public.doxa_service_entitlements enable row level security;

create or replace function public.doxa_record_paid_service(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb := p_event->'order';
  v_inserted integer;
begin
  if p_event->>'event' <> 'payment.paid' or p_event->>'merchant' <> 'doxa-sure' then raise exception 'invalid event'; end if;
  if p_event->>'event_id' !~ '^evt_[a-f0-9]{40}$' then raise exception 'invalid event id'; end if;
  if v_order->>'product_code' <> 'rescue-readiness-pack' or (v_order->>'amount_minor')::integer <> 19900 or v_order->>'currency' <> 'ZAR' then raise exception 'invalid settlement'; end if;
  if v_order->'entitlement'->>'kind' <> 'service' or v_order->'entitlement'->>'service' <> 'rescue-readiness-pack' then raise exception 'invalid entitlement'; end if;

  insert into public.doxa_payment_events(event_id,order_id,product_code,customer_reference,payment_reference,bank_reference,amount_minor,currency,paid_at,payload)
  values(p_event->>'event_id',v_order->>'id',v_order->>'product_code',v_order->>'customer_reference',v_order->>'payment_reference',v_order->>'bank_reference',(v_order->>'amount_minor')::integer,v_order->>'currency',(v_order->>'paid_at')::timestamptz,p_event)
  on conflict(event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    if not exists(select 1 from public.doxa_payment_events where event_id=p_event->>'event_id' and payload=p_event) then raise exception 'event replay payload mismatch'; end if;
    return jsonb_build_object('outcome','duplicate','event_id',p_event->>'event_id');
  end if;

  insert into public.doxa_service_entitlements(order_id,customer_reference,service)
  values(v_order->>'id',v_order->>'customer_reference','rescue-readiness-pack')
  on conflict(order_id) do nothing;
  return jsonb_build_object('outcome','created','event_id',p_event->>'event_id','order_id',v_order->>'id');
end;
$$;

revoke all on table public.doxa_payment_events from anon, authenticated;
revoke all on table public.doxa_service_entitlements from anon, authenticated;
revoke all on function public.doxa_record_paid_service(jsonb) from public, anon, authenticated;
grant execute on function public.doxa_record_paid_service(jsonb) to service_role;

commit;
