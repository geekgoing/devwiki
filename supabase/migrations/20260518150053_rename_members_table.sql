do $$
declare
  legacy_table_name text := 'study' || '_members';
begin
  if to_regclass('public.members') is null
     and to_regclass(format('public.%I', legacy_table_name)) is not null then
    execute format('alter table public.%I rename to members', legacy_table_name);
  end if;
end
$$;

create or replace function private.is_devwiki_member()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.members member
    where member.is_active
      and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant select on public.members to authenticated;
grant all privileges on table public.members to service_role;
