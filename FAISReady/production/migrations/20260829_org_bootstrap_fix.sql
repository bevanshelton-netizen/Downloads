-- FAISReady production hotfix
-- Allows an authenticated creator to read the organization row immediately
-- after creation, before the first owner membership is inserted.
-- This keeps browser-side create -> select -> owner-membership bootstrap compatible
-- with Row Level Security.

drop policy if exists organizations_member_select on public.organizations;
drop policy if exists organizations_member_or_creator_select on public.organizations;

create policy organizations_member_or_creator_select
on public.organizations
for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.is_org_member(organizations.id))
);
