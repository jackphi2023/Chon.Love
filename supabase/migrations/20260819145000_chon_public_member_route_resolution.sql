create or replace function public.resolve_chon_member_route(p_identifier text)
returns table(public_profile_code text, username citext)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;

  return query
  select p.public_profile_code, p.username
  from public.profiles p
  where p.profile_status = 'active'
    and p.deleted_at is null
    and p.discovery_enabled = true
    and private.is_active_adult(p.id)
    and (
      p.public_profile_code = lower(btrim(coalesce(p_identifier, '')))
      or lower(p.username::text) = lower(btrim(coalesce(p_identifier, '')))
    )
  order by case when p.public_profile_code = lower(btrim(coalesce(p_identifier, ''))) then 0 else 1 end
  limit 1;
end;
$$;

revoke all on function public.resolve_chon_member_route(text) from public, anon;
grant execute on function public.resolve_chon_member_route(text) to authenticated, service_role;

comment on function public.resolve_chon_member_route(text) is
  'Authenticated compatibility resolver between legacy usernames and opaque public_profile_code. Returns no auth UUID or private profile data.';