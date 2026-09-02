-- FAISReady production hardening
-- Merge duplicate permissive INSERT policies on organization_members.
-- Preserves both manager-managed membership inserts and first-owner bootstrap.

drop policy if exists members_insert_manage on public.organization_members;
drop policy if exists members_self_bootstrap on public.organization_members;

create policy members_insert_authorized
on public.organization_members
for insert
to authenticated
with check (
  (select private.is_org_manager(organization_members.organization_id))
  or (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1
      from public.organizations o
      where o.id = organization_members.organization_id
        and o.created_by = (select auth.uid())
    )
  )
);
