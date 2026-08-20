-- Creator allocations and viewer reward pools may share a cleared revenue event.
-- Never allocate the same cleared rand to both pools.
create or replace function public.allocate_creator_revenue(
  p_revenue_event_id uuid,
  p_production_id uuid,
  p_eligible_amount numeric
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_gross numeric;
  v_allocated numeric;
  v_reward_reserved numeric;
  v_creator_id uuid;
  v_deal_id uuid;
  v_share_bps integer;
  v_creator_amount numeric;
  v_platform_amount numeric;
  v_owner uuid;
  v_wallet uuid;
  v_ledger uuid;
  v_allocation uuid;
begin
  if p_eligible_amount <= 0 then raise exception 'Eligible amount must be positive'; end if;

  select gross_amount into v_gross
  from public.revenue_events
  where id = p_revenue_event_id and cleared = true
  for update;
  if v_gross is null then raise exception 'Cleared revenue event not found'; end if;

  if exists(select 1 from public.creator_revenue_allocations where revenue_event_id = p_revenue_event_id and production_id = p_production_id) then
    raise exception 'This revenue event is already allocated to this production';
  end if;

  select coalesce(sum(eligible_amount), 0) into v_allocated
  from public.creator_revenue_allocations
  where revenue_event_id = p_revenue_event_id;

  select coalesce(sum(funded_amount), 0) into v_reward_reserved
  from public.reward_pools
  where revenue_event_id = p_revenue_event_id;

  if v_allocated + v_reward_reserved + p_eligible_amount > v_gross then
    raise exception 'Creator allocation exceeds cleared revenue remaining after funded reward reserves';
  end if;

  select creator_id into v_creator_id from public.productions where id = p_production_id;
  if v_creator_id is null then raise exception 'Production not found'; end if;

  select id, revenue_share_bps into v_deal_id, v_share_bps
  from public.creator_deals
  where creator_id = v_creator_id and status = 'accepted'
  order by accepted_at desc nulls last, offered_at desc
  limit 1;
  if v_deal_id is null then raise exception 'Creator has no accepted revenue deal'; end if;

  select owner_id into v_owner from public.creators where id = v_creator_id;
  select id into v_wallet from public.wallets where owner_id = v_owner;
  if v_wallet is null then raise exception 'Creator wallet not found'; end if;

  v_creator_amount := round(p_eligible_amount * v_share_bps / 10000.0, 2);
  v_platform_amount := p_eligible_amount - v_creator_amount;

  if v_creator_amount > 0 then
    insert into public.ledger_entries(wallet_id, kind, amount, reason, source_type, source_id)
    values(v_wallet, 'credit', v_creator_amount, 'Creator revenue share', 'creator_allocation', p_revenue_event_id::text || ':' || p_production_id::text)
    returning id into v_ledger;
  end if;

  insert into public.creator_revenue_allocations(
    revenue_event_id, production_id, creator_id, deal_id, eligible_amount, creator_amount, platform_amount, ledger_entry_id
  ) values (
    p_revenue_event_id, p_production_id, v_creator_id, v_deal_id, p_eligible_amount, v_creator_amount, v_platform_amount, v_ledger
  ) returning id into v_allocation;

  return v_allocation;
end;
$$;

revoke all on function public.allocate_creator_revenue(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.allocate_creator_revenue(uuid, uuid, numeric) to service_role;
