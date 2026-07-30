-- Phase C / Session 17: profile viewer, Fan Album access summary and social safety lists.
-- All client-facing functions authenticate with auth.uid(), expose only public-safe fields,
-- and keep exact location, private identity, finance and moderation data out of the response.

create or replace function public.get_profile_viewer(p_username text)
returns table(
  id uuid,
  username text,
  display_name text,
  bio text,
  gender public.gender_identity,
  province_id bigint,
  province_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  is_creator boolean,
  creator_bio text,
  interests text[],
  friendship_id uuid,
  friendship_status text,
  friendship_direction text,
  blocked_by_viewer boolean,
  public_album_count bigint,
  fan_album_available boolean,
  fan_access_granted boolean,
  fan_threshold_units bigint,
  fan_eligible_units bigint,
  fan_remaining_units bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_target_id uuid;
  v_blocked_by_viewer boolean := false;
  v_blocked_by_target boolean := false;
begin
  if v_viewer_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.is_active_adult(v_viewer_id) then
    raise exception using errcode = '42501', message = 'active_adult_account_required';
  end if;
  if nullif(btrim(p_username), '') is null then
    raise exception using errcode = '22023', message = 'profile_username_required';
  end if;

  select p.id
    into v_target_id
  from public.profiles p
  where lower(p.username::text) = lower(btrim(p_username))
    and p.profile_status = 'active'::public.profile_status
    and p.deleted_at is null
    and private.is_active_adult(p.id)
  limit 1;

  if v_target_id is null then
    return;
  end if;

  select exists(
    select 1 from public.user_blocks b
    where b.blocker_id = v_viewer_id and b.blocked_id = v_target_id
  ) into v_blocked_by_viewer;

  select exists(
    select 1 from public.user_blocks b
    where b.blocker_id = v_target_id and b.blocked_id = v_viewer_id
  ) into v_blocked_by_target;

  if v_blocked_by_target then
    return;
  end if;

  return query
  with relationship as (
    select f.*
    from public.friendships f
    where f.pair_low_id = least(v_viewer_id, v_target_id)
      and f.pair_high_id = greatest(v_viewer_id, v_target_id)
      and f.status in ('pending'::public.friendship_status, 'accepted'::public.friendship_status)
    order by f.created_at desc
    limit 1
  ),
  public_media as (
    select count(*)::bigint as media_count
    from public.albums a
    join public.album_media am on am.album_id = a.id
    join public.media_assets m on m.id = am.media_id
    where a.owner_id = v_target_id
      and a.album_type = 'public'::public.album_type
      and a.is_active
      and a.deleted_at is null
      and m.deleted_at is null
      and m.moderation_status in ('pending_review'::public.media_moderation_status, 'approved'::public.media_moderation_status)
      and not v_blocked_by_viewer
      and private.can_view_media_internal(m.id, v_viewer_id)
  ),
  creator as (
    select cp.creator_bio,
           cp.creator_status,
           cp.fan_threshold_units
    from public.creator_profiles cp
    where cp.user_id = v_target_id
    limit 1
  ),
  fan_album as (
    select exists(
      select 1
      from public.albums a
      where a.owner_id = v_target_id
        and a.album_type = 'fan'::public.album_type
        and a.is_active
        and a.deleted_at is null
    ) as available,
    coalesce(
      (select max(nullif(a.fan_threshold_units, 0))
       from public.albums a
       where a.owner_id = v_target_id
         and a.album_type = 'fan'::public.album_type
         and a.is_active
         and a.deleted_at is null),
      (select c.fan_threshold_units from creator c),
      (select (cfg.value_json #>> '{}')::bigint from private.app_config cfg where cfg.key = 'fan_minimum_units'),
      1000
    )::bigint as threshold_units
  ),
  progress as (
    select coalesce(fp.eligible_units, 0)::bigint as eligible_units
    from public.fan_progress fp
    where fp.creator_id = v_target_id and fp.fan_user_id = v_viewer_id
    union all
    select 0::bigint
    where not exists (
      select 1 from public.fan_progress fp
      where fp.creator_id = v_target_id and fp.fan_user_id = v_viewer_id
    )
    limit 1
  )
  select p.id,
         p.username::text,
         p.display_name,
         p.bio,
         p.gender,
         p.province_id,
         area.name_vi,
         case when v_blocked_by_viewer then null else p.avatar_media_id end,
         case when v_blocked_by_viewer then null else avatar.storage_bucket end,
         case when v_blocked_by_viewer then null else avatar.storage_path end,
         (p.is_creator and coalesce(c.creator_status = 'approved'::public.creator_status, false)),
         case when c.creator_status = 'approved'::public.creator_status then c.creator_bio else null end,
         coalesce(p.interests, '{}'::text[]),
         r.id,
         case
           when v_blocked_by_viewer then 'blocked'
           when r.id is null then 'none'
           else r.status::text
         end,
         case
           when v_blocked_by_viewer then 'outgoing_block'
           when r.id is null then 'none'
           when r.status = 'accepted'::public.friendship_status then 'mutual'
           when r.requester_id = v_viewer_id then 'outgoing'
           else 'incoming'
         end,
         v_blocked_by_viewer,
         case when v_blocked_by_viewer then 0 else pm.media_count end,
         (not v_blocked_by_viewer and fa.available and coalesce(c.creator_status = 'approved'::public.creator_status, false)),
         (not v_blocked_by_viewer
           and fa.available
           and coalesce(c.creator_status = 'approved'::public.creator_status, false)
           and private.has_active_fan_membership(v_target_id, v_viewer_id)),
         fa.threshold_units,
         pr.eligible_units,
         greatest(fa.threshold_units - pr.eligible_units, 0)::bigint
  from public.profiles p
  left join public.administrative_areas area on area.id = p.province_id
  left join public.media_assets avatar
    on avatar.id = p.avatar_media_id
   and private.can_view_media_internal(avatar.id, v_viewer_id)
  left join relationship r on true
  left join creator c on true
  cross join public_media pm
  cross join fan_album fa
  cross join progress pr
  where p.id = v_target_id;
end;
$$;

create or replace function public.list_my_social_connections(
  p_view text default 'friends',
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  friendship_id uuid,
  friendship_status text,
  direction text,
  greeting_message text,
  other_user_id uuid,
  username text,
  display_name text,
  bio text,
  province_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  is_creator boolean,
  created_at timestamptz,
  responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 500);
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode = '42501', message = 'active_adult_account_required';
  end if;
  if p_view not in ('friends', 'received', 'sent') then
    raise exception using errcode = '22023', message = 'invalid_social_connection_view';
  end if;

  return query
  with selected as (
    select f.*,
           case when f.requester_id = v_user_id then f.addressee_id else f.requester_id end as other_id,
           case
             when f.status = 'accepted'::public.friendship_status then 'mutual'
             when f.requester_id = v_user_id then 'outgoing'
             else 'incoming'
           end as relationship_direction
    from public.friendships f
    where (
      (p_view = 'friends' and f.status = 'accepted'::public.friendship_status and (f.requester_id = v_user_id or f.addressee_id = v_user_id))
      or (p_view = 'received' and f.status = 'pending'::public.friendship_status and f.addressee_id = v_user_id)
      or (p_view = 'sent' and f.status = 'pending'::public.friendship_status and f.requester_id = v_user_id)
    )
    order by coalesce(f.responded_at, f.created_at) desc, f.id
    limit v_limit offset v_offset
  )
  select s.id,
         s.status::text,
         s.relationship_direction,
         s.greeting_message,
         p.id,
         p.username::text,
         p.display_name,
         p.bio,
         area.name_vi,
         p.avatar_media_id,
         avatar.storage_bucket,
         avatar.storage_path,
         (p.is_creator and exists(
           select 1 from public.creator_profiles cp
           where cp.user_id = p.id and cp.creator_status = 'approved'::public.creator_status
         )),
         s.created_at,
         s.responded_at
  from selected s
  join public.profiles p on p.id = s.other_id
  left join public.administrative_areas area on area.id = p.province_id
  left join public.media_assets avatar
    on avatar.id = p.avatar_media_id
   and private.can_view_media_internal(avatar.id, v_user_id)
  where p.profile_status = 'active'::public.profile_status
    and p.deleted_at is null
    and private.is_active_adult(p.id)
    and not private.users_are_blocked(v_user_id, p.id)
  order by coalesce(s.responded_at, s.created_at) desc, s.id;
end;
$$;

create or replace function public.list_my_blocked_profiles(
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  blocked_user_id uuid,
  username text,
  display_name text,
  reason_code text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id,
         p.username::text,
         coalesce(p.display_name, 'Tài khoản MyFan'),
         b.reason_code,
         b.created_at
  from public.user_blocks b
  left join public.profiles p on p.id = b.blocked_id and p.deleted_at is null
  where b.blocker_id = auth.uid()
  order by b.created_at desc, b.blocked_id
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 500)
$$;

create or replace function public.create_report(
  p_target_user_id uuid default null,
  p_target_media_id uuid default null,
  p_target_message_id uuid default null,
  p_reason_code text default 'other',
  p_description text default null,
  p_evidence_json jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_reason text := lower(btrim(coalesce(p_reason_code, '')));
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode = '42501', message = 'active_adult_account_required';
  end if;
  if num_nonnulls(p_target_user_id, p_target_media_id, p_target_message_id) <> 1 then
    raise exception using errcode = '22023', message = 'exactly_one_report_target_required';
  end if;
  if v_reason not in ('spam', 'harassment', 'impersonation', 'sexual_content', 'underage', 'scam', 'violence', 'other') then
    raise exception using errcode = '22023', message = 'invalid_report_reason';
  end if;
  if p_description is not null and char_length(btrim(p_description)) > 1000 then
    raise exception using errcode = '22001', message = 'report_description_too_long';
  end if;
  if jsonb_typeof(coalesce(p_evidence_json, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'report_evidence_must_be_object';
  end if;
  if p_target_user_id = v_user_id then
    raise exception using errcode = '22023', message = 'cannot_report_self';
  end if;
  if p_target_user_id is not null and not exists(
    select 1 from public.profiles p where p.id = p_target_user_id and p.deleted_at is null
  ) then
    raise exception using errcode = '23503', message = 'report_target_not_found';
  end if;
  if p_target_media_id is not null and not private.can_view_media_internal(p_target_media_id, v_user_id) then
    raise exception using errcode = '42501', message = 'media_not_reportable';
  end if;
  if p_target_message_id is not null and not exists(
    select 1 from public.messages m
    where m.id = p_target_message_id and private.is_conversation_member(m.conversation_id, v_user_id)
  ) then
    raise exception using errcode = '42501', message = 'message_not_reportable';
  end if;
  if exists(
    select 1 from public.reports r
    where r.reporter_id = v_user_id
      and r.target_user_id is not distinct from p_target_user_id
      and r.target_media_id is not distinct from p_target_media_id
      and r.target_message_id is not distinct from p_target_message_id
      and r.reason_code = v_reason
      and r.created_at > now() - interval '60 seconds'
  ) then
    raise exception using errcode = '54000', message = 'report_rate_limited';
  end if;

  insert into public.reports(
    reporter_id, target_user_id, target_media_id, target_message_id,
    reason_code, description, evidence_json
  ) values (
    v_user_id, p_target_user_id, p_target_media_id, p_target_message_id,
    v_reason, nullif(btrim(p_description), ''), coalesce(p_evidence_json, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.get_profile_viewer(text) from public, anon;
revoke all on function public.list_my_social_connections(text, integer, integer) from public, anon;
revoke all on function public.list_my_blocked_profiles(integer, integer) from public, anon;
revoke all on function public.create_report(uuid, uuid, uuid, text, text, jsonb) from public, anon;

grant execute on function public.get_profile_viewer(text) to authenticated, service_role;
grant execute on function public.list_my_social_connections(text, integer, integer) to authenticated, service_role;
grant execute on function public.list_my_blocked_profiles(integer, integer) to authenticated, service_role;
grant execute on function public.create_report(uuid, uuid, uuid, text, text, jsonb) to authenticated, service_role;
