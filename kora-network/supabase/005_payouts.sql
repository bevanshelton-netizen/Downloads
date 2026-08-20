alter table public.profiles
  add column if not exists kyc_status text not null default 'unverified'
  check (kyc_status in ('unverified','pending','verified','rejected'));

create or replace function public.request_wallet_payout(p_amount numeric)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_wallet uuid;
  v_balance numeric;
  v_request uuid;
  v_kyc text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount < 100 then raise exception 'Minimum payout is R100'; end if;

  select kyc_status into v_kyc from public.profiles where id = v_user;
  if v_kyc <> 'verified' then raise exception 'Identity verification is required before payout'; end if;

  select id into v_wallet from public.wallets where owner_id = v_user for update;
  if v_wallet is null then raise exception 'Wallet not found'; end if;

  select coalesce(sum(case when kind='credit' then amount else -amount end),0)
  into v_balance
  from public.ledger_entries where wallet_id = v_wallet;

  if v_balance < p_amount then raise exception 'Insufficient available balance'; end if;

  insert into public.payout_requests(wallet_id, amount, status)
  values(v_wallet, p_amount, 'pending') returning id into v_request;

  insert into public.ledger_entries(wallet_id, kind, amount, reason, source_type, source_id)
  values(v_wallet, 'debit', p_amount, 'Payout hold', 'payout_request', v_request::text);

  return v_request;
end;
$$;

revoke all on function public.request_wallet_payout(numeric) from public, anon;
grant execute on function public.request_wallet_payout(numeric) to authenticated;

create policy "wallet owner creates payout request" on public.payout_requests
for insert to authenticated with check (exists (
  select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid()
));
