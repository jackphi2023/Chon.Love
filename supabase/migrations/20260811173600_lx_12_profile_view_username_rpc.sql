-- LX-12 route adapter: record a profile view from the public username route without
-- coupling the legacy Member Profile presentation to the new Interests persistence.

create or replace function public.record_profile_view_by_username(p_username text)
returns boolean
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_username text := lower(btrim(coalesce(p_username,'')));
  v_target_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='28000', message='authentication_required';
  end if;
  if v_username='' or char_length(v_username)>48 then
    return false;
  end if;

  select p.id
  into v_target_id
  from public.profiles p
  where lower(p.username::text)=v_username
    and p.profile_status='active'
    and p.deleted_at is null
  limit 1;

  if v_target_id is null then
    return false;
  end if;

  return public.record_profile_view(v_target_id);
end;
$$;

revoke all on function public.record_profile_view_by_username(text) from public,anon;
grant execute on function public.record_profile_view_by_username(text) to authenticated,service_role;

comment on function public.record_profile_view_by_username(text) is
  'LX-12 route adapter. Resolves an active profile username and records the authenticated viewer through record_profile_view; returns false for self/unavailable targets.';
