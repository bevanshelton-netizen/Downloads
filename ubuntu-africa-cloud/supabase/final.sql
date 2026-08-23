-- Ubuntu Africa Cloud final MVP migration. Run after schema.sql and phase3.sql.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin','support_admin')),
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy "admins can read own admin record" on public.platform_admins for select using (user_id=auth.uid());


-- Replace tenant-admin helper so suspended customers cannot write or publish changes.
create or replace function public.is_tenant_admin(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = target_tenant
      and tm.user_id = auth.uid()
      and tm.role in ('tenant_owner', 'tenant_admin')
      and t.is_suspended = false
  );
$$;

-- Permit tenant admins to insert manual payment claims.
create policy "tenant admins create payment claims" on public.manual_payments for insert
with check (public.is_tenant_admin(tenant_id) and reviewed_by is null and reviewed_at is null and status='pending');

-- Public-site table may be read anonymously; mutation remains server-admin only.
-- Phase3 creates this table and select policy.

-- Helpful indexes
create index if not exists idx_projects_tenant on public.projects(tenant_id);
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_tickets_tenant on public.support_tickets(tenant_id);
create index if not exists idx_content_tenant on public.content_requests(tenant_id);
create index if not exists idx_payments_tenant on public.manual_payments(tenant_id);
create index if not exists idx_published_slug on public.published_sites(slug);

-- FIRST ADMIN SETUP (run manually after your own account exists):
-- insert into public.platform_admins(user_id, role)
-- select id, 'super_admin' from auth.users where email = 'YOUR_EMAIL_HERE';
