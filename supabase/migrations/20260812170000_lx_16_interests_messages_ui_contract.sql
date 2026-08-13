-- LX-16: Seeking-derived Interests + Messages UI read model.
--
-- This migration does not change LX-15 messaging entitlement:
-- - Free may receive/read but cannot start/send member-authored text.
-- - Premium/Diamond may start/send without friendship.
--
-- LX-16 only exposes profile facts needed by the Seeking row hierarchy and
-- adds a per-member archive state for the mailbox presentation.

alter table public.conversation_members
  add column if not exists archived_at timestamptz;

create index if not exists conversation_members_archived_idx
  on public.conversation_members(user_id,archived_at desc,conversation_id)
  where archived_at is not null;

comment on column public.conversation_members.archived_at is
  'LX-16 mailbox archive state owned by the conversation member. Does not remove or hide messages from the other participant.';

create or replace function public.set_conversation_archived(
  p_conversation_id uuid,
  p_archived boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_updated integer:=0;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501',message='active_adult_account_required';
  end if;
  if p_conversation_id is null or p_archived is null then
    raise exception using errcode='22023',message='invalid_archive_state';
  end if;

  update public.conversation_members cm
  set archived_at=case when p_archived then now() else null end
  where cm.conversation_id=p_conversation_id and cm.user_id=v_user_id;
  get diagnostics v_updated=row_count;

  if v_updated=0 then
    raise exception using errcode='42501',message='conversation_not_available';
  end if;
  return true;
end;
$$;

revoke all on function public.set_conversation_archived(uuid,boolean) from public,anon;
grant execute on function public.set_conversation_archived(uuid,boolean) to authenticated,service_role;

-- Extend the LX-15 mailbox read model with the profile facts shown by Seeking and
-- a member-owned archive flag. Entitlement and safety calculations remain unchanged.
drop function if exists public.list_my_conversations(integer,integer);

create function public.list_my_conversations(
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  conversation_id uuid,
  friendship_id uuid,
  other_user_id uuid,
  username text,
  display_name text,
  age smallint,
  headline text,
  province_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  is_creator boolean,
  is_online boolean,
  friendship_status text,
  can_send boolean,
  blocked boolean,
  is_archived boolean,
  last_message_id uuid,
  last_message_type text,
  last_message_body text,
  last_message_sender_id uuid,
  last_message_sent_at timestamptz,
  unread_count bigint
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_limit integer:=least(greatest(coalesce(p_limit,30),1),50);
  v_offset integer:=least(greatest(coalesce(p_offset,0),0),500);
  v_online_minutes integer:=15;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;

  select coalesce((cfg.value_json#>>'{}')::integer,15)
  into v_online_minutes
  from private.app_config cfg
  where cfg.key='luxy_search_online_minutes';
  v_online_minutes:=least(greatest(coalesce(v_online_minutes,15),1),120);

  return query
  with selected as (
    select c.id,c.friendship_id,c.last_message_at,c.created_at,f.status,
           private.get_direct_conversation_other_user(c.id,v_user_id) other_id,
           cm.last_read_at,cm.archived_at
    from public.conversation_members cm
    join public.conversations c on c.id=cm.conversation_id
    left join public.friendships f on f.id=c.friendship_id
    where cm.user_id=v_user_id
    order by c.last_message_at desc nulls last,c.created_at desc,c.id
    limit v_limit offset v_offset
  )
  select s.id,s.friendship_id,p.id,p.username::text,
         case when bs.blocked_by_other then 'Tài khoản không khả dụng' else p.display_name end,
         extract(year from age(current_date,ui.date_of_birth))::smallint,
         case when bs.blocked then null else p.headline end,
         case when bs.blocked then null else area.name_vi end,
         case when bs.blocked then null else p.avatar_media_id end,
         case when bs.blocked then null else avatar.storage_bucket end,
         case when bs.blocked then null else avatar.storage_path end,
         (not bs.blocked and p.is_creator and exists(
           select 1 from public.creator_profiles cp where cp.user_id=p.id and cp.creator_status='approved'::public.creator_status
         )),
         (not bs.blocked and p.last_active_at is not null and p.last_active_at>=now()-make_interval(mins=>v_online_minutes)),
         coalesce(s.status::text,'direct'),
         (not bs.blocked and private.is_active_adult(p.id) and private.can_message_with_luxy_membership(v_user_id)),
         bs.blocked,
         (s.archived_at is not null),
         lm.id,lm.message_type::text,
         case
           when lm.id is null then null
           when lm.deleted_at is not null or lm.moderation_status='removed'::public.message_moderation_status then null
           when lm.message_type='text'::public.message_type then left(lm.body,160)
           else null
         end,
         lm.sender_id,lm.sent_at,coalesce(unread.unread_count,0)::bigint
  from selected s
  join public.profiles p on p.id=s.other_id
  join private.user_identity ui on ui.user_id=p.id
  left join public.administrative_areas area on area.id=p.province_id
  cross join lateral (
    select exists(
             select 1 from public.user_blocks b
             where (b.blocker_id=v_user_id and b.blocked_id=s.other_id)
                or (b.blocker_id=s.other_id and b.blocked_id=v_user_id)
           ) blocked,
           exists(
             select 1 from public.user_blocks b
             where b.blocker_id=s.other_id and b.blocked_id=v_user_id
           ) blocked_by_other
  ) bs
  left join public.media_assets avatar
    on avatar.id=p.avatar_media_id and not bs.blocked and private.can_view_media_internal(avatar.id,v_user_id)
  left join lateral (
    select m.* from public.messages m
    where m.conversation_id=s.id and not private.is_message_hidden_for_user(m.id,v_user_id)
    order by m.sent_at desc,m.id desc limit 1
  ) lm on true
  left join lateral (
    select count(*)::bigint unread_count from public.messages m
    where m.conversation_id=s.id and m.sender_id<>v_user_id and m.deleted_at is null
      and m.moderation_status<>'removed'::public.message_moderation_status
      and not private.is_message_hidden_for_user(m.id,v_user_id)
      and (s.last_read_at is null or m.sent_at>s.last_read_at)
  ) unread on true
  where s.other_id is not null and p.deleted_at is null
  order by s.last_message_at desc nulls last,s.created_at desc,s.id;
end;
$$;

revoke all on function public.list_my_conversations(integer,integer) from public,anon;
grant execute on function public.list_my_conversations(integer,integer) to authenticated,service_role;

comment on function public.list_my_conversations(integer,integer) is
  'LX-16 Seeking mailbox read model on top of LX-15 direct messaging. Includes member archive state and non-sensitive profile presentation facts.';

-- Extend Interests rows with the same public profile facts Seeking displays.
-- Viewed-me is intentionally limited to the previous 180 days, matching the
-- product note in the supplied Seeking reference.
drop function if exists public.list_luxy_interests(text,integer,integer);

create function public.list_luxy_interests(
  p_scope text default 'favorites',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  id uuid,
  username text,
  display_name text,
  age smallint,
  province_name text,
  headline text,
  height_cm smallint,
  weight_kg smallint,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  photo_count integer,
  last_active_at timestamptz,
  is_online boolean,
  is_favorited boolean,
  is_favorited_by boolean,
  is_match boolean,
  interaction_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_scope text := lower(btrim(coalesce(p_scope,'')));
  v_limit integer := least(greatest(coalesce(p_limit,24),1),40);
  v_offset integer := least(greatest(coalesce(p_offset,0),0),199);
  v_online_minutes integer;
begin
  if v_user_id is null then
    raise exception using errcode='28000', message='authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode='42501', message='adult_onboarding_required';
  end if;
  if v_scope not in ('favorites','viewed_me','favorited_me') then
    raise exception using errcode='22023', message='invalid_interest_scope';
  end if;

  select coalesce((value_json#>>'{}')::integer,15)
  into v_online_minutes
  from private.app_config
  where key='luxy_search_online_minutes';
  v_online_minutes := least(greatest(coalesce(v_online_minutes,15),1),120);

  return query
  with relations as (
    select f.favorite_id target_id,f.created_at relation_at
    from public.profile_favorites f
    where v_scope='favorites' and f.owner_id=v_user_id

    union all

    select f.owner_id target_id,f.created_at relation_at
    from public.profile_favorites f
    where v_scope='favorited_me' and f.favorite_id=v_user_id

    union all

    select v.viewer_id target_id,v.last_viewed_at relation_at
    from public.profile_views v
    where v_scope='viewed_me'
      and v.viewed_id=v_user_id
      and v.last_viewed_at>=now()-interval '180 days'
  )
  select
    p.id,
    p.username::text,
    p.display_name,
    extract(year from age(current_date,ui.date_of_birth))::smallint,
    area.name_vi,
    p.headline,
    p.height_cm,
    p.weight_kg,
    p.avatar_media_id,
    avatar.storage_bucket,
    avatar.storage_path,
    coalesce(photos.photo_count,0)::integer,
    p.last_active_at,
    (p.last_active_at is not null and p.last_active_at>=now()-make_interval(mins=>v_online_minutes)),
    exists(select 1 from public.profile_favorites f where f.owner_id=v_user_id and f.favorite_id=p.id),
    exists(select 1 from public.profile_favorites f where f.owner_id=p.id and f.favorite_id=v_user_id),
    exists(
      select 1 from public.profile_favorites mine
      join public.profile_favorites theirs
        on theirs.owner_id=p.id and theirs.favorite_id=v_user_id
      where mine.owner_id=v_user_id and mine.favorite_id=p.id
    ),
    r.relation_at
  from relations r
  join public.profiles p on p.id=r.target_id
  join private.user_identity ui on ui.user_id=p.id
  left join public.administrative_areas area
    on area.id=p.province_id and area.country_code='VN' and area.is_active
  left join public.media_assets avatar
    on avatar.id=p.avatar_media_id
    and avatar.owner_id=p.id
    and avatar.visibility='avatar'
    and avatar.moderation_status in ('pending_review','approved')
    and avatar.deleted_at is null
    and avatar.uploaded_at is not null
    and private.can_view_media_internal(avatar.id,v_user_id)
  left join lateral (
    select count(*)::integer photo_count
    from public.media_assets m
    where m.owner_id=p.id
      and m.deleted_at is null
      and m.uploaded_at is not null
      and m.moderation_status in ('pending_review','approved')
      and m.visibility in ('avatar','public')
      and private.can_view_media_internal(m.id,v_user_id)
  ) photos on true
  where p.profile_status='active'
    and p.deleted_at is null
    and p.discovery_enabled
    and private.is_active_adult(p.id)
    and not private.users_are_blocked(v_user_id,p.id)
  order by r.relation_at desc,p.id
  offset v_offset
  limit least(v_limit,greatest(200-v_offset,0));
end;
$$;

revoke all on function public.list_luxy_interests(text,integer,integer) from public,anon;
grant execute on function public.list_luxy_interests(text,integer,integer) to authenticated,service_role;

comment on function public.list_luxy_interests(text,integer,integer) is
  'LX-16 Seeking-derived Interests list with public profile facts. Viewed-me returns only the previous 180 days.';
