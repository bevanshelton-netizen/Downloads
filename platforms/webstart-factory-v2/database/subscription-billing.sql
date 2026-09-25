-- WebStart launch billing / subscription state
alter table public.orders
  add column if not exists billing_type text not null default 'initial',
  add column if not exists subscription_id uuid;

alter table public.orders drop constraint if exists orders_billing_type_check;
alter table public.orders add constraint orders_billing_type_check
  check (billing_type in ('initial','renewal'));

create table if not exists public.webstart_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  site_id uuid not null unique references public.sites(id) on delete cascade,
  package text not null check (package in ('start','business','commerce')),
  monthly_cents integer not null check (monthly_cents >= 0),
  currency text not null default 'ZAR',
  status text not null default 'active' check (status in ('active','past_due','cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_due_at timestamptz,
  last_paid_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.webstart_subscriptions enable row level security;
revoke all on table public.webstart_subscriptions from anon, authenticated;
grant select on table public.webstart_subscriptions to authenticated;
grant select, insert, update, delete on table public.webstart_subscriptions to service_role;

drop policy if exists webstart_owner_select_subscriptions on public.webstart_subscriptions;
create policy webstart_owner_select_subscriptions
on public.webstart_subscriptions
for select to authenticated
using ((select auth.uid()) = owner_id);

create or replace function public.webstart_sync_subscription_from_paid_order()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  period_start timestamptz;
  period_end timestamptz;
begin
  if new.status='paid'
     and (old.status is distinct from new.status or old.paid_at is distinct from new.paid_at)
     and new.site_id is not null then
    period_start := coalesce(new.paid_at, now());
    period_end := period_start + interval '1 month';

    insert into public.webstart_subscriptions(
      owner_id,site_id,package,monthly_cents,currency,status,
      current_period_start,current_period_end,next_due_at,last_paid_order_id,updated_at
    ) values (
      new.owner_id,new.site_id,new.package,new.monthly_cents,new.currency,'active',
      period_start,period_end,period_end,new.id,now()
    )
    on conflict (site_id) do update set
      owner_id=excluded.owner_id,
      package=excluded.package,
      monthly_cents=excluded.monthly_cents,
      currency=excluded.currency,
      status='active',
      current_period_start=excluded.current_period_start,
      current_period_end=excluded.current_period_end,
      next_due_at=excluded.next_due_at,
      last_paid_order_id=excluded.last_paid_order_id,
      updated_at=now();
  end if;
  return new;
end;
$$;

drop trigger if exists webstart_orders_paid_subscription on public.orders;
create trigger webstart_orders_paid_subscription
after update of status,paid_at on public.orders
for each row execute function public.webstart_sync_subscription_from_paid_order();
