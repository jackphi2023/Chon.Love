create or replace function public.admin_list_luxy_users(
  p_actor_user_id uuid,
  p_query text default null,
  p_status text default null,
  p_tier public.luxy_membership_tier default null,
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
language plpgsql stable security definer set search_path=''
as $$
declare
  v_query text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
begin
  perform private.actor_role_for(p_actor_user_id, array['super_admin']::private.user_role[]);
  if p_limit not between 1 and 200 or p_offset < 0 then raise exception using errcode='22023', message='invalid_pagination'; end if;
  if v_status is not null and v_status not in ('incomplete','pending_review','active','suspended','deactivated','deleted') then raise exception using errcode='22023', message='invalid_profile_status'; end if;

  return query
  select
    p.id,u.email::text,p.username::text,p.display_name,p.gender,
    case when ui.date_of_birth is null then null else extract(year from age(current_date, ui.date_of_birth))::integer end,
    p.province_id,p.profile_status,p.discovery_enabled,p.nearby_enabled,p.last_active_at,u.created_at,u.last_sign_in_at,u.email_confirmed_at,
    coalesce(m.tier,'free'::public.luxy_membership_tier),m.expires_at,
    coalesce(v.identity_status,'not_submitted'),coalesce(v.linkedin_status,'not_submitted'),
    (select count(*) from public.media_assets ma where ma.owner_id=p.id and ma.deleted_at is null),
    (select count(*) from public.reports r where r.target_user_id=p.id),
    (select count(*) from public.user_blocks b where b.blocked_id=p.id),count(*) over()
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
  order by p.created_at desc,p.id
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_get_luxy_user_detail(p_actor_user_id uuid,p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
  perform private.actor_role_for(p_actor_user_id,array['super_admin']::private.user_role[]);
  select jsonb_build_object(
    'account',jsonb_build_object('user_id',p.id,'email',u.email,'email_confirmed_at',u.email_confirmed_at,'created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at),
    'profile',to_jsonb(p),
    'age',case when ui.date_of_birth is null then null else extract(year from age(current_date,ui.date_of_birth))::integer end,
    'account_status',ui.account_status,
    'membership',coalesce(to_jsonb(m),jsonb_build_object('tier','free','status','inactive')),
    'verification',coalesce(to_jsonb(v),jsonb_build_object('identity_status','not_submitted','linkedin_status','not_submitted')),
    'roles',coalesce((select jsonb_agg(ur.role order by ur.role::text) from private.user_roles ur where ur.user_id=p.id and ur.revoked_at is null),'[]'::jsonb),
    'counts',jsonb_build_object(
      'photos',(select count(*) from public.media_assets ma where ma.owner_id=p.id and ma.deleted_at is null),
      'reports_received',(select count(*) from public.reports r where r.target_user_id=p.id),
      'reports_made',(select count(*) from public.reports r where r.reporter_id=p.id),
      'blocked_by',(select count(*) from public.user_blocks b where b.blocked_id=p.id),
      'blocks_made',(select count(*) from public.user_blocks b where b.blocker_id=p.id)
    )
  ) into v_result
  from public.profiles p
  join auth.users u on u.id=p.id
  left join private.user_identity ui on ui.user_id=p.id
  left join private.luxy_memberships m on m.user_id=p.id
  left join private.member_profile_verifications v on v.user_id=p.id
  where p.id=p_user_id;
  if v_result is null then raise exception using errcode='P0002',message='user_not_found'; end if;
  return v_result;
end;
$$;

create or replace function public.admin_set_luxy_user_status(p_actor_user_id uuid,p_user_id uuid,p_status text,p_reason text,p_request_id uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare
  v_actor_role private.user_role;
  v_status text:=lower(btrim(coalesce(p_status,'')));
  v_reason text:=btrim(coalesce(p_reason,''));
  v_before jsonb;
  v_after jsonb;
begin
  v_actor_role:=private.actor_role_for(p_actor_user_id,array['super_admin']::private.user_role[]);
  if p_actor_user_id=p_user_id and v_status<>'active' then raise exception using errcode='22023',message='cannot_suspend_self'; end if;
  if v_status not in ('active','suspended','deactivated') then raise exception using errcode='22023',message='invalid_admin_profile_status'; end if;
  if char_length(v_reason)<3 or p_request_id is null then raise exception using errcode='22023',message='reason_and_request_id_required'; end if;

  select jsonb_build_object('profile_status',p.profile_status,'discovery_enabled',p.discovery_enabled,'nearby_enabled',p.nearby_enabled,'account_status',ui.account_status)
  into v_before
  from public.profiles p left join private.user_identity ui on ui.user_id=p.id
  where p.id=p_user_id for update of p;
  if v_before is null then raise exception using errcode='P0002',message='user_not_found'; end if;

  update public.profiles
  set profile_status=v_status::public.profile_status,
      discovery_enabled=case when v_status in ('suspended','deactivated') then false else discovery_enabled end,
      nearby_enabled=case when v_status in ('suspended','deactivated') then false else nearby_enabled end,
      updated_at=now()
  where id=p_user_id;

  update private.user_identity
  set account_status=v_status::private.account_status,
      suspension_reason_code=case when v_status='suspended' then left(v_reason,128) else null end,
      updated_at=now()
  where user_id=p_user_id;

  select jsonb_build_object('profile_status',p.profile_status,'discovery_enabled',p.discovery_enabled,'nearby_enabled',p.nearby_enabled,'account_status',ui.account_status)
  into v_after
  from public.profiles p left join private.user_identity ui on ui.user_id=p.id
  where p.id=p_user_id;

  perform private.append_admin_audit(p_actor_user_id,v_actor_role,'luxy_user_status_set','user',p_user_id,v_before,v_after,v_reason,p_request_id,null,null);
  return v_status;
end;
$$;

create or replace function public.admin_set_luxy_user_discovery(p_actor_user_id uuid,p_user_id uuid,p_hidden boolean,p_reason text,p_request_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare
  v_actor_role private.user_role;
  v_reason text:=btrim(coalesce(p_reason,''));
  v_before jsonb;
  v_after jsonb;
begin
  v_actor_role:=private.actor_role_for(p_actor_user_id,array['super_admin']::private.user_role[]);
  if char_length(v_reason)<3 or p_request_id is null then raise exception using errcode='22023',message='reason_and_request_id_required'; end if;
  select jsonb_build_object('profile_status',profile_status,'discovery_enabled',discovery_enabled,'nearby_enabled',nearby_enabled)
    into v_before from public.profiles where id=p_user_id for update;
  if v_before is null then raise exception using errcode='P0002',message='user_not_found'; end if;
  if p_hidden=false and (v_before->>'profile_status')<>'active' then raise exception using errcode='22023',message='inactive_user_cannot_be_unhidden'; end if;
  update public.profiles set discovery_enabled=not p_hidden,nearby_enabled=case when p_hidden then false else nearby_enabled end,updated_at=now() where id=p_user_id;
  select jsonb_build_object('profile_status',profile_status,'discovery_enabled',discovery_enabled,'nearby_enabled',nearby_enabled)
    into v_after from public.profiles where id=p_user_id;
  perform private.append_admin_audit(p_actor_user_id,v_actor_role,case when p_hidden then 'luxy_user_hidden' else 'luxy_user_unhidden' end,'user',p_user_id,v_before,v_after,v_reason,p_request_id,null,null);
  return not p_hidden;
end;
$$;

revoke all on function public.admin_list_luxy_users(uuid,text,text,public.luxy_membership_tier,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_get_luxy_user_detail(uuid,uuid) from public,anon,authenticated;
revoke all on function public.admin_set_luxy_user_status(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.admin_set_luxy_user_discovery(uuid,uuid,boolean,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_list_luxy_users(uuid,text,text,public.luxy_membership_tier,integer,integer) to service_role;
grant execute on function public.admin_get_luxy_user_detail(uuid,uuid) to service_role;
grant execute on function public.admin_set_luxy_user_status(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.admin_set_luxy_user_discovery(uuid,uuid,boolean,text,uuid) to service_role;
