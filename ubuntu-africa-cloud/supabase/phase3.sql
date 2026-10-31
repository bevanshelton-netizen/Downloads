-- Phase 3 workflow additions
-- Tenant admins can update draft/submitted managed projects, but cannot self-publish.
drop policy if exists "admins update projects" on public.projects;
create policy "tenant admins update draft or submitted projects" on public.projects for update
using (public.is_tenant_admin(tenant_id) and status in ('draft','submitted'))
with check (public.is_tenant_admin(tenant_id) and status in ('draft','submitted'));

create table if not exists public.published_sites (
 id uuid primary key default gen_random_uuid(), project_id uuid not null unique references public.projects(id) on delete cascade,
 tenant_id uuid not null references public.tenants(id) on delete cascade, slug text not null unique,
 template_key text not null, public_content jsonb not null default '{}'::jsonb,
 published_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.published_sites enable row level security;
create policy "anyone can read published sites" on public.published_sites for select using (true);
-- No direct browser write policy. Trusted admin publication code is added in Phase 4.
