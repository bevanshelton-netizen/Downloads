-- Do not expose even hashed family PIN material to authenticated clients.
drop policy if exists "owner reads family pin state" on public.family_pins;

create or replace function public.has_family_pin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists(select 1 from public.family_pins where owner_id = auth.uid());
$$;

revoke all on function public.has_family_pin() from public, anon;
grant execute on function public.has_family_pin() to authenticated;
