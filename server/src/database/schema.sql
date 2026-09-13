-- =============================================================================
-- Claimsure — 2-role PostgreSQL schema + RLS
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Roles (strict):
--   patient              — own claims, document upload, status tracking
--   insurance_provider   — org-scoped cases, AI trigger, approve / reject
--
-- After this file, run seed.sql
--
-- Supabase Auth dashboard (do this once):
-- 1. Authentication → Providers → Email: enable email/password
-- 2. Authentication → Providers → Google: enable and paste Client ID / Secret
-- 3. Authentication → URL Configuration:
--      Site URL: http://localhost:3000
--      Redirect URLs: http://localhost:3000/auth/callback
-- =============================================================================

create extension if not exists "pgcrypto";

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'insurance_provider'
    check (type in ('insurance_provider')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('patient', 'insurance_provider')),
  organization_id uuid references public.organizations (id),
  created_at timestamptz not null default now(),
  constraint profiles_insurer_requires_org check (
    (role = 'patient' and organization_id is null)
    or (role = 'insurance_provider' and organization_id is not null)
  )
);

create sequence if not exists public.case_number_seq start 1007;

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique not null default ('R' || lpad(nextval('public.case_number_seq')::text, 4, '0')),
  patient_id uuid not null references public.profiles (id),
  insurer_org_id uuid not null references public.organizations (id),
  service_type text not null,
  service_code text,
  payer_id text,
  status text not null default 'PENDING'
    check (status in (
      'PENDING', 'ANALYZING', 'ACTION_REQUIRED',
      'AWAITING_REVIEW', 'APPEAL_READY', 'SUBMITTED',
      'VERIFYING', 'RESOLVED', 'ESCALATED', 'CLOSED'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.denials (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  denial_code text,
  denial_reason text not null,
  denial_date date,
  appeal_deadline date,
  raw_text text,
  drive_file_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  name text not null,
  document_type text not null,
  drive_file_id text not null default 'pending',
  drive_url text,
  uploaded_by uuid references public.profiles (id),
  is_missing boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUBMITTED', 'ACCEPTED', 'REJECTED')),
  appeal_text text,
  citations jsonb,
  approved_by uuid references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_state (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  current_node text not null,
  state_data jsonb not null default '{}'::jsonb,
  attempt_count int not null default 0,
  is_dry_run boolean not null default false,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases (id) on delete set null,
  actor_id uuid references public.profiles (id),
  actor_type text not null check (actor_type in ('agent', 'human', 'system')),
  action text not null,
  node text,
  previous_state text,
  new_state text,
  ai_recommendation text,
  human_decision text,
  confidence float,
  citations jsonb,
  input_hash text,
  idempotency_key text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  channel text not null check (channel in ('in_app', 'email', 'slack')),
  is_read boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes (FKs + RLS columns)
-- -----------------------------------------------------------------------------

create index if not exists profiles_organization_id_idx on public.profiles (organization_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists cases_patient_id_idx on public.cases (patient_id);
create index if not exists cases_insurer_org_id_idx on public.cases (insurer_org_id);
create index if not exists cases_status_idx on public.cases (status);
create index if not exists denials_case_id_idx on public.denials (case_id);
create index if not exists documents_case_id_idx on public.documents (case_id);
create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by);
create index if not exists appeals_case_id_idx on public.appeals (case_id);
create index if not exists appeals_approved_by_idx on public.appeals (approved_by);
create index if not exists agent_state_case_id_idx on public.agent_state (case_id);
create index if not exists audit_logs_case_id_idx on public.audit_logs (case_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_case_id_idx on public.notifications (case_id);

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

drop trigger if exists agent_state_set_updated_at on public.agent_state;
create trigger agent_state_set_updated_at
  before update on public.agent_state
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Lock role after insert (authorization lives in profiles, not user_metadata)
-- -----------------------------------------------------------------------------

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  if old.role is distinct from new.role then
    raise exception 'profile role cannot be changed';
  end if;
  if old.organization_id is not null
     and old.organization_id is distinct from new.organization_id
     and old.role = 'insurance_provider' then
    raise exception 'organization assignment cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role
  before update on public.profiles
  for each row execute function public.prevent_profile_role_change();

-- -----------------------------------------------------------------------------
-- Create profile (+ optional insurer org) from auth.users metadata
-- Role is copied from signup metadata once, then stored only on profiles.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_name text;
  v_org_name text;
  v_org_id uuid;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', '');
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );
  v_org_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'organization_name', '')), '');

  if v_role not in ('patient', 'insurance_provider') then
    return new;
  end if;

  if v_role = 'insurance_provider' then
    if v_org_name is not null then
      insert into public.organizations (name, type)
      values (v_org_name, 'insurance_provider')
      returning id into v_org_id;
    else
      select id into v_org_id
      from public.organizations
      where type = 'insurance_provider'
      order by created_at asc
      limit 1;
    end if;

    if v_org_id is null then
      insert into public.organizations (name, type)
      values ('Demo Insurance', 'insurance_provider')
      returning id into v_org_id;
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role, organization_id)
  values (new.id, coalesce(new.email, ''), v_name, v_role, v_org_id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Completes a Google/OAuth user who has a session but no profile yet.
-- SECURITY DEFINER so it is not blocked by insert RLS.
create or replace function public.complete_my_profile(
  p_full_name text,
  p_role text,
  p_organization_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_email text;
  v_org_id uuid;
  v_profile public.profiles;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_role not in ('patient', 'insurance_provider') then
    raise exception 'role must be patient or insurance_provider';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_uid;
  if found then
    return v_profile;
  end if;

  select coalesce(u.email, '') into v_email
  from auth.users u
  where u.id = v_uid;

  if p_role = 'insurance_provider' then
    insert into public.organizations (name, type)
    values (
      coalesce(nullif(trim(coalesce(p_organization_name, '')), ''), 'Demo Insurance'),
      'insurance_provider'
    )
    returning id into v_org_id;
  end if;

  insert into public.profiles (id, email, full_name, role, organization_id)
  values (
    v_uid,
    coalesce(v_email, ''),
    coalesce(nullif(trim(coalesce(p_full_name, '')), ''), 'User'),
    p_role,
    v_org_id
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.complete_my_profile(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Private RLS helpers (security definer, not granted to anon/authenticated)
-- -----------------------------------------------------------------------------

create or replace function private.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.profiles
  where id = (select auth.uid())
  limit 1;
$$;

create or replace function private.has_case_access(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cases c
    join public.profiles p on p.id = (select auth.uid())
    where c.id = p_case_id
      and (
        (p.role = 'patient' and c.patient_id = p.id)
        or (
          p.role = 'insurance_provider'
          and p.organization_id is not null
          and c.insurer_org_id = p.organization_id
        )
      )
  );
$$;

revoke all on function private.current_profile() from public, anon, authenticated;
revoke all on function private.has_case_access(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.has_case_access(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.denials enable row level security;
alter table public.documents enable row level security;
alter table public.appeals enable row level security;
alter table public.agent_state enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- Organizations
drop policy if exists organizations_select_authenticated on public.organizations;
create policy organizations_select_authenticated
  on public.organizations
  for select
  to authenticated
  using (true);

drop policy if exists organizations_insert_authenticated on public.organizations;
create policy organizations_insert_authenticated
  on public.organizations
  for insert
  to authenticated
  with check (type = 'insurance_provider');

-- Profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_select_insurer_patients on public.profiles;
create policy profiles_select_insurer_patients
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.cases c
      join public.profiles viewer on viewer.id = (select auth.uid())
      where c.patient_id = profiles.id
        and viewer.role = 'insurance_provider'
        and viewer.organization_id is not null
        and c.insurer_org_id = viewer.organization_id
    )
  );

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Cases
drop policy if exists cases_select_access on public.cases;
create policy cases_select_access
  on public.cases
  for select
  to authenticated
  using (
    patient_id = (select auth.uid())
    or insurer_org_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists cases_insert_patient on public.cases;
create policy cases_insert_patient
  on public.cases
  for insert
  to authenticated
  with check (
    patient_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'patient'
    )
  );

drop policy if exists cases_insert_insurer on public.cases;
create policy cases_insert_insurer
  on public.cases
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'insurance_provider'
        and p.organization_id is not null
        and p.organization_id = insurer_org_id
    )
  );

drop policy if exists cases_update_insurer on public.cases;
create policy cases_update_insurer
  on public.cases
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'insurance_provider'
        and p.organization_id is not null
        and p.organization_id = cases.insurer_org_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'insurance_provider'
        and p.organization_id is not null
        and p.organization_id = cases.insurer_org_id
    )
  );

-- Child tables: access follows parent case
drop policy if exists denials_select_access on public.denials;
create policy denials_select_access
  on public.denials for select to authenticated
  using (private.has_case_access(case_id));

drop policy if exists denials_write_access on public.denials;
create policy denials_write_access
  on public.denials for insert to authenticated
  with check (private.has_case_access(case_id));

drop policy if exists documents_select_access on public.documents;
create policy documents_select_access
  on public.documents for select to authenticated
  using (private.has_case_access(case_id));

drop policy if exists documents_insert_access on public.documents;
create policy documents_insert_access
  on public.documents for insert to authenticated
  with check (
    private.has_case_access(case_id)
    and uploaded_by = (select auth.uid())
  );

drop policy if exists documents_update_access on public.documents;
create policy documents_update_access
  on public.documents for update to authenticated
  using (private.has_case_access(case_id))
  with check (private.has_case_access(case_id));

drop policy if exists appeals_select_access on public.appeals;
create policy appeals_select_access
  on public.appeals for select to authenticated
  using (private.has_case_access(case_id));

drop policy if exists appeals_write_insurer on public.appeals;
create policy appeals_write_insurer
  on public.appeals for insert to authenticated
  with check (
    private.has_case_access(case_id)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'insurance_provider'
    )
  );

drop policy if exists appeals_update_insurer on public.appeals;
create policy appeals_update_insurer
  on public.appeals for update to authenticated
  using (
    private.has_case_access(case_id)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'insurance_provider'
    )
  )
  with check (private.has_case_access(case_id));

drop policy if exists agent_state_select_access on public.agent_state;
create policy agent_state_select_access
  on public.agent_state for select to authenticated
  using (private.has_case_access(case_id));

drop policy if exists agent_state_write_insurer on public.agent_state;
create policy agent_state_write_insurer
  on public.agent_state for all to authenticated
  using (
    private.has_case_access(case_id)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'insurance_provider'
    )
  )
  with check (
    private.has_case_access(case_id)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'insurance_provider'
    )
  );

drop policy if exists audit_logs_select_access on public.audit_logs;
create policy audit_logs_select_access
  on public.audit_logs for select to authenticated
  using (case_id is not null and private.has_case_access(case_id));

drop policy if exists audit_logs_insert_access on public.audit_logs;
create policy audit_logs_insert_access
  on public.audit_logs for insert to authenticated
  with check (case_id is not null and private.has_case_access(case_id));

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists notifications_insert_own on public.notifications;
create policy notifications_insert_own
  on public.notifications for insert to authenticated
  with check (user_id = (select auth.uid()));
