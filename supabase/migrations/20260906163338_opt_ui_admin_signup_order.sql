-- Session C repair: keep Admin member ordering aligned with the authoritative
-- Auth signup timestamp. The RPC already exposes signup_at from auth.users.created_at;
-- ordering by profiles.created_at can drift when profile creation happens later.

create or replace function public.admin_list_luxy_users(
  p_actor_user_id uuid,
  p_query text default null::text,
  p_status text default null::text,
  p_tier public.luxy_membership_tier default null::public.luxy_membership_tier,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  user_id uuid,
  email text,
  username text,
  display_name text,
  gender public.gender_identity,
  age integer,
  province_id bigint,
  profile_status public.profile_status,
  discovery_enabled boolean,
  nearby_enabled boolean,
  last_active_at timestamptz,
  signup_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  membership_tier public.luxy_membership_tier,
  membership_expires_at timestamptz,
  identity_status text,
  linkedin_status text,
  photo_count bigint,
  reports_received bigint,
  blocks_received bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_query text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
begin
  perform private.actor_role_for(p_actor_user_id, array['super_admin']::private.user_role[]);
  if p_limit not between 1 and 200 or p_offset < 0 then
    raise exception using errcode='22023', message='invalid_pagination';
  end if;
  if v_status is not null and v_status not in ('incomplete','pending_review','active','suspended','deactivated','deleted') then
    raise exception using errcode='22023', message='invalid_profile_status';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.username::text,
    p.display_name,
    p.gender,
    case when ui.date_of_birth is null then null else extract(year from age(current_date, ui.date_of_birth))::integer end,
    p.province_id,
    p.profile_status,
    p.discovery_enabled,
    p.nearby_enabled,
    p.last_active_at,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    coalesce(m.tier, 'free'::public.luxy_membership_tier),
    m.expires_at,
    coalesce(v.identity_status, 'not_submitted'),
    coalesce(v.linkedin_status, 'not_submitted'),
    (select count(*) from public.media_assets ma where ma.owner_id=p.id and ma.deleted_at is null),
    (select count(*) from public.reports r where r.target_user_id=p.id),
    (select count(*) from public.user_blocks b where b.blocked_id=p.id),
    count(*) over()
  from public.profiles p
  join auth.users u on u.id=p.id
  left join private.user_identity ui on ui.user_id=p.id
  left join private.luxy_memberships m on m.user_id=p.id
  left join private.member_profile_verifications v on v.user_id=p.id
  where (v_query is null
    or lower(coalesce(u.email,'')) like '%'||v_query||'%'
    or lower(coalesce(p.username::text,'')) like '%'||v_query||'%'
    or lower(coalesce(p.display_name,'')) like '%'||v_query||'%')
    and (v_status is null or p.profile_status::text=v_status)
    and (p_tier is null or coalesce(m.tier,'free'::public.luxy_membership_tier)=p_tier)
  order by u.created_at desc, p.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_list_luxy_users(uuid,text,text,public.luxy_membership_tier,integer,integer) from public,anon;
grant execute on function public.admin_list_luxy_users(uuid,text,text,public.luxy_membership_tier,integer,integer) to authenticated,service_role;

comment on function public.admin_list_luxy_users(uuid,text,text,public.luxy_membership_tier,integer,integer) is
  'Admin member list ordered by the authoritative auth.users.created_at signup timestamp. signup_at and last_sign_in_at remain Auth-derived read-model fields; profile creation time is not used for signup ordering.';
