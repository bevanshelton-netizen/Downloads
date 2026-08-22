-- KORA Tickets settlement engine: KORA collects first, beneficiary funds release only after the event hold.
alter table public.ticket_events add column if not exists settlement_hold_hours integer not null default 48 check(settlement_hold_hours between 0 and 720);

create table if not exists public.ticket_settlements (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.ticket_orders(id) on delete restrict,
 event_id uuid not null references public.ticket_events(id) on delete restrict,
 revenue_event_id uuid not null unique references public.revenue_events(id) on delete restrict,
 creator_id uuid references public.creators(id) on delete set null,
 owner_id uuid references public.profiles(id) on delete restrict,
 wallet_id uuid references public.wallets(id) on delete restrict,
 beneficiary_name text not null,
 gross_amount numeric(14,2) not null check(gross_amount>=0),
 beneficiary_share_bps integer not null check(beneficiary_share_bps between 0 and 9000),
 beneficiary_amount numeric(14,2) not null check(beneficiary_amount>=0),
 platform_amount numeric(14,2) not null check(platform_amount>=0),
 currency char(3) not null default 'ZAR',
 status text not null default 'pending' check(status in('pending','released','reversed')),
 available_at timestamptz not null,
 credit_ledger_entry_id uuid references public.ledger_entries(id) on delete restrict,
 reversal_ledger_entry_id uuid references public.ledger_entries(id) on delete restrict,
 created_at timestamptz not null default now(),
 released_at timestamptz,
 reversed_at timestamptz,
 check(abs((beneficiary_amount+platform_amount)-gross_amount)<=0.01),
 check((beneficiary_amount=0 and owner_id is null and wallet_id is null) or (beneficiary_amount>0 and owner_id is not null and wallet_id is not null))
);

alter table public.ticket_settlements enable row level security;
create policy "beneficiary reads ticket settlements" on public.ticket_settlements
for select using(owner_id=auth.uid() or public.is_staff());
grant select on public.ticket_settlements to authenticated;
grant all on public.ticket_settlements to service_role;
create index if not exists ticket_settlements_owner_status_idx on public.ticket_settlements(owner_id,status,available_at);
create index if not exists ticket_settlements_event_idx on public.ticket_settlements(event_id,created_at desc);

-- Replace schema 17 completion so ticket issuance, cleared revenue and the settlement accrual are one transaction.
create or replace function public.complete_payfast_ticket_order(p_order_id uuid,p_provider_payment_id text,p_amount numeric)
returns void language plpgsql security definer set search_path=public as $$
declare
 v_order public.ticket_orders%rowtype;
 v_event public.ticket_events%rowtype;
 v_rows integer;
 i integer;
 v_revenue uuid;
 v_owner uuid;
 v_wallet uuid;
 v_beneficiary_name text:='KORA Network';
 v_beneficiary_amount numeric;
 v_platform_amount numeric;
 v_available_at timestamptz;
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

 select * into v_event from public.ticket_events where id=v_order.event_id for update;
 if v_event.id is null then raise exception 'Ticket event not found';end if;
 if v_event.artist_share_bps>0 then
  if v_event.creator_id is null then raise exception 'Ticket settlement beneficiary is not configured';end if;
  select owner_id,name into v_owner,v_beneficiary_name from public.creators where id=v_event.creator_id;
  if v_owner is null then raise exception 'Ticket settlement beneficiary is unavailable';end if;
  select id into v_wallet from public.wallets where owner_id=v_owner;
  if v_wallet is null then raise exception 'Ticket settlement wallet is unavailable';end if;
 end if;

 update public.ticket_tiers set reserved_count=reserved_count-v_order.quantity,sold_count=sold_count+v_order.quantity where id=v_order.tier_id and reserved_count>=v_order.quantity;
 get diagnostics v_rows=row_count;if v_rows<>1 then raise exception 'Ticket inventory inconsistency';end if;
 update public.ticket_orders set status='complete',provider_payment_id=p_provider_payment_id,completed_at=now() where id=v_order.id;
 for i in 1..v_order.quantity loop insert into public.event_tickets(order_id,user_id,event_id,tier_id) values(v_order.id,v_order.user_id,v_order.event_id,v_order.tier_id);end loop;

 insert into public.revenue_events(source_type,source_id,gross_amount,currency,cleared,cleared_at)
 values('payfast_ticket',p_provider_payment_id,p_amount,v_order.currency,true,now())
 on conflict(source_type,source_id) where source_id is not null do nothing;
 select id into v_revenue from public.revenue_events where source_type='payfast_ticket' and source_id=p_provider_payment_id;
 if v_revenue is null then raise exception 'Ticket revenue event unavailable';end if;

 v_beneficiary_amount:=round(p_amount*v_event.artist_share_bps/10000.0,2);
 v_platform_amount:=p_amount-v_beneficiary_amount;
 v_available_at:=coalesce(v_event.ends_at,v_event.starts_at)+make_interval(hours=>v_event.settlement_hold_hours);
 insert into public.ticket_settlements(order_id,event_id,revenue_event_id,creator_id,owner_id,wallet_id,beneficiary_name,gross_amount,beneficiary_share_bps,beneficiary_amount,platform_amount,currency,available_at)
 values(v_order.id,v_event.id,v_revenue,v_event.creator_id,v_owner,v_wallet,v_beneficiary_name,p_amount,v_event.artist_share_bps,v_beneficiary_amount,v_platform_amount,v_order.currency,v_available_at)
 on conflict(order_id) do nothing;
end$$;

-- Release only after the event/hold period. The existing KYC + payout profile gates still control money leaving KORA.
create or replace function public.release_ticket_settlement(p_settlement_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_settlement public.ticket_settlements%rowtype;v_event_status text;v_ledger uuid;
begin
 select * into v_settlement from public.ticket_settlements where id=p_settlement_id for update;
 if v_settlement.id is null then raise exception 'Ticket settlement not found';end if;
 if v_settlement.status='released' then return v_settlement.id;end if;
 if v_settlement.status<>'pending' then raise exception 'Ticket settlement is not pending';end if;
 if now()<v_settlement.available_at then raise exception 'Ticket settlement is still in the event/refund hold period';end if;
 select status into v_event_status from public.ticket_events where id=v_settlement.event_id;
 if v_event_status in('cancelled','postponed') then raise exception 'Ticket settlement cannot release while the event is cancelled or postponed';end if;
 if v_settlement.beneficiary_amount>0 then
  insert into public.ledger_entries(wallet_id,kind,amount,reason,source_type,source_id)
  values(v_settlement.wallet_id,'credit',v_settlement.beneficiary_amount,'KORA ticket settlement','ticket_settlement',v_settlement.id::text)
  returning id into v_ledger;
 end if;
 update public.ticket_settlements set status='released',credit_ledger_entry_id=v_ledger,released_at=now() where id=v_settlement.id;
 return v_settlement.id;
end$$;

-- Accounting/access reversal to run only after the external payment refund has actually been confirmed.
create or replace function public.record_confirmed_ticket_refund(p_settlement_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_settlement public.ticket_settlements%rowtype;v_order public.ticket_orders%rowtype;v_reversal uuid;
begin
 select * into v_settlement from public.ticket_settlements where id=p_settlement_id for update;
 if v_settlement.id is null then raise exception 'Ticket settlement not found';end if;
 if v_settlement.status='reversed' then return v_settlement.id;end if;
 select * into v_order from public.ticket_orders where id=v_settlement.order_id for update;
 if exists(select 1 from public.event_tickets where order_id=v_order.id and status='checked_in') then raise exception 'Checked-in tickets cannot be reversed';end if;
 if v_settlement.status='released' and v_settlement.beneficiary_amount>0 then
  insert into public.ledger_entries(wallet_id,kind,amount,reason,source_type,source_id)
  values(v_settlement.wallet_id,'debit',v_settlement.beneficiary_amount,'Confirmed ticket refund reversal','ticket_settlement_refund',v_settlement.id::text)
  returning id into v_reversal;
 end if;
 update public.event_tickets set status='refunded' where order_id=v_order.id and status='valid';
 update public.ticket_tiers set sold_count=greatest(0,sold_count-v_order.quantity) where id=v_order.tier_id;
 update public.ticket_orders set status='refunded' where id=v_order.id;
 update public.ticket_settlements set status='reversed',reversal_ledger_entry_id=v_reversal,reversed_at=now() where id=v_settlement.id;
 return v_settlement.id;
end$$;

revoke all on function public.complete_payfast_ticket_order(uuid,text,numeric) from public,anon,authenticated;grant execute on function public.complete_payfast_ticket_order(uuid,text,numeric) to service_role;
revoke all on function public.release_ticket_settlement(uuid) from public,anon,authenticated;grant execute on function public.release_ticket_settlement(uuid) to service_role;
revoke all on function public.record_confirmed_ticket_refund(uuid) from public,anon,authenticated;grant execute on function public.record_confirmed_ticket_refund(uuid) to service_role;

update public.platform_release_state set schema_version=greatest(schema_version,19),updated_at=now() where singleton=true;
