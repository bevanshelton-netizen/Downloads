-- KORA Tickets payment hardening: atomic reservations, idempotent PayFast completion and ticket issuance.
alter table public.ticket_tiers add column if not exists reserved_count integer not null default 0 check(reserved_count>=0);
alter table public.ticket_tiers drop constraint if exists ticket_tiers_inventory_within_capacity;
alter table public.ticket_tiers add constraint ticket_tiers_inventory_within_capacity check(reserved_count+sold_count<=capacity);
alter table public.ticket_orders add column if not exists unit_price numeric(14,2) check(unit_price is null or unit_price>=0);
alter table public.ticket_orders add column if not exists reservation_expires_at timestamptz;
alter table public.ticket_orders add column if not exists completed_at timestamptz;
create unique index if not exists ticket_orders_provider_payment_unique on public.ticket_orders(provider,provider_payment_id) where provider_payment_id is not null;

create or replace function public.reserve_ticket_order(p_tier_id uuid,p_quantity integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_tier public.ticket_tiers%rowtype;v_event public.ticket_events%rowtype;v_order uuid;v_released integer;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if p_quantity<1 or p_quantity>10 then raise exception 'Quantity must be between 1 and 10';end if;
 select * into v_tier from public.ticket_tiers where id=p_tier_id for update;
 if v_tier.id is null or not v_tier.is_active then raise exception 'Ticket tier unavailable';end if;
 select * into v_event from public.ticket_events where id=v_tier.event_id;
 if v_event.status<>'published' or not v_event.sales_enabled then raise exception 'Ticket sales are not open';end if;
 with expired as(update public.ticket_orders set status='expired' where tier_id=p_tier_id and status='pending' and reservation_expires_at<now() returning quantity)
 select coalesce(sum(quantity),0)::integer into v_released from expired;
 if v_released>0 then update public.ticket_tiers set reserved_count=greatest(0,reserved_count-v_released) where id=p_tier_id returning * into v_tier;end if;
 if v_tier.capacity-v_tier.sold_count-v_tier.reserved_count<p_quantity then raise exception 'Not enough tickets remaining';end if;
 insert into public.ticket_orders(user_id,event_id,tier_id,quantity,unit_price,total_amount,currency,status,provider,reservation_expires_at)
 values(v_user,v_event.id,v_tier.id,p_quantity,v_tier.price,v_tier.price*p_quantity,v_event.currency,'pending','payfast',now()+interval '15 minutes') returning id into v_order;
 update public.ticket_tiers set reserved_count=reserved_count+p_quantity where id=p_tier_id;
 return v_order;
end$$;

create or replace function public.release_ticket_order(p_order_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.ticket_orders%rowtype;
begin
 if p_status not in('expired','cancelled') then raise exception 'Invalid release status';end if;
 select * into v_order from public.ticket_orders where id=p_order_id for update;
 if v_order.id is null or v_order.status<>'pending' then return;end if;
 update public.ticket_tiers set reserved_count=greatest(0,reserved_count-v_order.quantity) where id=v_order.tier_id;
 update public.ticket_orders set status=p_status where id=v_order.id;
end$$;

create or replace function public.complete_payfast_ticket_order(p_order_id uuid,p_provider_payment_id text,p_amount numeric)
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.ticket_orders%rowtype;v_rows integer;i integer;
begin
 if coalesce(p_provider_payment_id,'')='' then raise exception 'Provider payment ID required';end if;
 select * into v_order from public.ticket_orders where id=p_order_id and provider='payfast' for update;
 if v_order.id is null then raise exception 'Ticket order not found';end if;
 if v_order.status='complete' then
  if v_order.provider_payment_id=p_provider_payment_id then return;end if;
  raise exception 'Ticket order already completed by another payment';
 end if;
 if v_order.status<>'pending' then raise exception 'Ticket order is not pending';end if;
 if abs(v_order.total_amount-p_amount)>0.01 then raise exception 'Ticket amount mismatch';end if;
 if v_order.reservation_expires_at<now() then raise exception 'Ticket reservation expired';end if;
 update public.ticket_tiers set reserved_count=reserved_count-v_order.quantity,sold_count=sold_count+v_order.quantity where id=v_order.tier_id and reserved_count>=v_order.quantity;
 get diagnostics v_rows=row_count;if v_rows<>1 then raise exception 'Ticket inventory inconsistency';end if;
 update public.ticket_orders set status='complete',provider_payment_id=p_provider_payment_id,completed_at=now() where id=v_order.id;
 for i in 1..v_order.quantity loop insert into public.event_tickets(order_id,user_id,event_id,tier_id) values(v_order.id,v_order.user_id,v_order.event_id,v_order.tier_id);end loop;
 insert into public.revenue_events(source_type,source_id,gross_amount,currency,cleared,cleared_at) values('payfast_ticket',p_provider_payment_id,p_amount,v_order.currency,true,now()) on conflict(source_type,source_id) where source_id is not null do nothing;
end$$;
revoke all on function public.reserve_ticket_order(uuid,integer) from public,anon;grant execute on function public.reserve_ticket_order(uuid,integer) to authenticated;
revoke all on function public.release_ticket_order(uuid,text) from public,anon,authenticated;grant execute on function public.release_ticket_order(uuid,text) to service_role;
revoke all on function public.complete_payfast_ticket_order(uuid,text,numeric) from public,anon,authenticated;grant execute on function public.complete_payfast_ticket_order(uuid,text,numeric) to service_role;
update public.platform_release_state set schema_version=greatest(schema_version,17),updated_at=now() where singleton=true;
