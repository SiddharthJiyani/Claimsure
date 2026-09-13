-- Run this in the Supabase SQL Editor if profile save fails
-- (safe to re-run; does not drop existing data).

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
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.organizations to authenticated;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists organizations_insert_authenticated on public.organizations;
create policy organizations_insert_authenticated
  on public.organizations
  for insert
  to authenticated
  with check (type = 'insurance_provider');
