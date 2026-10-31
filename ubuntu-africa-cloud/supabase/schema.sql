-- Ubuntu Africa Cloud: Phase 1 schema
-- Run inside a new Supabase project's SQL Editor.

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'super_admin',
  'support_admin',
  'tenant_owner',
  'tenant_admin',
  'tenant_member'
);

create type public.project_status as enum (
  'draft',
  'submitted',
  'approved',
  'published',
  'suspended'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references auth.users(id),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'tenant_member',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  template_key text not null,
  status public.project_status not null default 'draft',
  content jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  subject text not null,
  body text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.content_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  request_type text not null,
  brief text not null,
  status text not null default 'pending',
  response_text text,
  created_at timestamptz not null default now()
);

create table public.manual_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  reference text,
  status text not null default 'pending',
  proof_path text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  tenant_id uuid references public.tenants(id),
  action text not null,
  target_type text,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_tenant_member(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = target_tenant
      and tm.user_id = auth.uid()
  );
$$;

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
    where tm.tenant_id = target_tenant
      and tm.user_id = auth.uid()
      and tm.role in ('tenant_owner', 'tenant_admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.projects enable row level security;
alter table public.support_tickets enable row level security;
alter table public.content_requests enable row level security;
alter table public.manual_payments enable row level security;
alter table public.audit_logs enable row level security;

create policy "users read own profile" on public.profiles for select using (id = auth.uid());
create policy "users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "members read tenant" on public.tenants for select using (public.is_tenant_member(id));
create policy "members read tenant membership" on public.tenant_members for select using (public.is_tenant_member(tenant_id));
create policy "admins manage tenant membership" on public.tenant_members for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy "members read projects" on public.projects for select using (public.is_tenant_member(tenant_id));
create policy "admins create projects" on public.projects for insert with check (public.is_tenant_admin(tenant_id));
create policy "admins update projects" on public.projects for update using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy "admins delete projects" on public.projects for delete using (public.is_tenant_admin(tenant_id));
create policy "members read tickets" on public.support_tickets for select using (public.is_tenant_member(tenant_id));
create policy "members create tickets" on public.support_tickets for insert with check (public.is_tenant_member(tenant_id) and created_by = auth.uid());
create policy "members read content requests" on public.content_requests for select using (public.is_tenant_member(tenant_id));
create policy "members create content requests" on public.content_requests for insert with check (public.is_tenant_member(tenant_id) and created_by = auth.uid());
create policy "tenant admins read payments" on public.manual_payments for select using (public.is_tenant_admin(tenant_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.create_tenant_for_current_user(
  tenant_name text,
  tenant_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_tenant_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(tenant_name)) < 2 or length(trim(tenant_name)) > 100 then raise exception 'Invalid tenant name'; end if;
  if tenant_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(tenant_slug) > 63 then raise exception 'Invalid tenant slug'; end if;
  if exists (select 1 from public.tenant_members where user_id = current_user_id) then raise exception 'User already belongs to a tenant'; end if;

  insert into public.tenants (name, slug, owner_user_id)
  values (trim(tenant_name), tenant_slug, current_user_id)
  returning id into new_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (new_tenant_id, current_user_id, 'tenant_owner');

  insert into public.audit_logs (actor_user_id, tenant_id, action, target_type, target_id)
  values (current_user_id, new_tenant_id, 'tenant.created', 'tenant', new_tenant_id::text);

  return new_tenant_id;
end;
$$;

revoke all on function public.create_tenant_for_current_user(text, text) from public;
grant execute on function public.create_tenant_for_current_user(text, text) to authenticated;
