-- UI-MSG02: retain conversation presentation metadata after seven-day physical message deletion.
--
-- The retention job still physically deletes expired messages. This migration adds only a
-- conversation-level marker so clients can distinguish a genuinely purged conversation from
-- a brand-new conversation that has never contained a message.

alter table public.conversations
  add column if not exists message_retention_purged_at timestamptz null;

comment on column public.conversations.message_retention_purged_at is
  'UI-MSG02 timestamp of the most recent physical seven-day retention purge that deleted at least one message. Preserved when retention is disabled so clients never infer a purge from an empty conversation.';

create or replace function private.purge_expired_conversation_messages()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint := 0;
begin
  with deleted as (
    delete from public.messages m
    using public.conversations c
    where c.id = m.conversation_id
      and c.auto_delete_messages_after_days = 7
      and m.sent_at <= now() - interval '7 days'
    returning m.conversation_id
  ), per_conversation as (
    select d.conversation_id, count(*)::bigint as deleted_count
    from deleted d
    group by d.conversation_id
  ), marked as (
    update public.conversations c
    set message_retention_purged_at = now(),
        updated_at = now()
    from per_conversation d
    where c.id = d.conversation_id
    returning d.deleted_count
  )
  select coalesce(sum(m.deleted_count), 0)::bigint
  into v_deleted
  from marked m;

  update public.conversations c
  set last_message_at = latest.sent_at,
      updated_at = now()
  from (
    select enabled.id,
           (
             select max(m.sent_at)
             from public.messages m
             where m.conversation_id = enabled.id
           ) as sent_at
    from public.conversations enabled
    where enabled.auto_delete_messages_after_days = 7
  ) latest
  where c.id = latest.id
    and c.last_message_at is distinct from latest.sent_at;

  return v_deleted;
end;
$$;

revoke all on function private.purge_expired_conversation_messages() from public, anon, authenticated;
grant execute on function private.purge_expired_conversation_messages() to service_role;

drop function if exists public.get_conversation_retention(uuid);
create function public.get_conversation_retention(p_conversation_id uuid)
returns table(
  conversation_id uuid,
  auto_delete_enabled boolean,
  auto_delete_after_days integer,
  updated_at timestamptz,
  purged_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode = '42501', message = 'active_adult_account_required';
  end if;
  if not private.is_conversation_member(p_conversation_id, v_user_id) then
    raise exception using errcode = '42501', message = 'conversation_not_available';
  end if;

  return query
  select c.id,
         (c.auto_delete_messages_after_days = 7),
         c.auto_delete_messages_after_days::integer,
         c.message_retention_updated_at,
         c.message_retention_purged_at
  from public.conversations c
  where c.id = p_conversation_id;
end;
$$;

revoke all on function public.get_conversation_retention(uuid) from public, anon;
grant execute on function public.get_conversation_retention(uuid) to authenticated, service_role;

drop function if exists public.set_conversation_auto_delete(uuid, boolean);
create function public.set_conversation_auto_delete(
  p_conversation_id uuid,
  p_enabled boolean
)
returns table(
  conversation_id uuid,
  auto_delete_enabled boolean,
  auto_delete_after_days integer,
  updated_at timestamptz,
  purged_at timestamptz,
  deleted_messages bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted bigint := 0;
  v_updated_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_enabled is null then
    raise exception using errcode = '22023', message = 'auto_delete_setting_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode = '42501', message = 'active_adult_account_required';
  end if;
  if not private.is_conversation_member(p_conversation_id, v_user_id) then
    raise exception using errcode = '42501', message = 'conversation_not_available';
  end if;

  update public.conversations c
  set auto_delete_messages_after_days = case when p_enabled then 7 else null end,
      message_retention_updated_at = v_updated_at,
      message_retention_updated_by = v_user_id,
      updated_at = v_updated_at
  where c.id = p_conversation_id;

  if not found then
    raise exception using errcode = '42501', message = 'conversation_not_available';
  end if;

  if p_enabled then
    with deleted as (
      delete from public.messages m
      where m.conversation_id = p_conversation_id
        and m.sent_at <= now() - interval '7 days'
      returning m.id
    )
    select count(*)::bigint into v_deleted from deleted;

    update public.conversations c
    set last_message_at = (
          select max(m.sent_at)
          from public.messages m
          where m.conversation_id = p_conversation_id
        ),
        message_retention_purged_at = case
          when v_deleted > 0 then v_updated_at
          else c.message_retention_purged_at
        end,
        updated_at = v_updated_at
    where c.id = p_conversation_id;
  end if;

  return query
  select c.id,
         (c.auto_delete_messages_after_days = 7),
         c.auto_delete_messages_after_days::integer,
         c.message_retention_updated_at,
         c.message_retention_purged_at,
         v_deleted
  from public.conversations c
  where c.id = p_conversation_id;
end;
$$;

revoke all on function public.set_conversation_auto_delete(uuid, boolean) from public, anon;
grant execute on function public.set_conversation_auto_delete(uuid, boolean) to authenticated, service_role;

drop function if exists public.list_my_conversations(integer, integer);
create function public.list_my_conversations(p_limit integer default 30, p_offset integer default 0)
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
  membership_tier public.luxy_membership_tier,
  friendship_status text,
  can_send boolean,
  blocked boolean,
  is_archived boolean,
  retention_purged_at timestamptz,
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
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 500);
  v_online_minutes integer := 15;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.is_active_adult(v_user_id) then
    raise exception using errcode = '42501', message = 'active_adult_account_required';
  end if;

  select coalesce((cfg.value_json #>> '{}')::integer, 15)
  into v_online_minutes
  from private.app_config cfg
  where cfg.key = 'luxy_search_online_minutes';
  v_online_minutes := least(greatest(coalesce(v_online_minutes, 15), 1), 120);

  return query
  with selected as (
    select c.id,
           c.friendship_id,
           c.last_message_at,
           c.created_at,
           c.message_retention_purged_at,
           f.status,
           private.get_direct_conversation_other_user(c.id, v_user_id) other_id,
           cm.last_read_at,
           cm.archived_at
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    left join public.friendships f on f.id = c.friendship_id
    where cm.user_id = v_user_id
    order by c.last_message_at desc nulls last, c.created_at desc, c.id
    limit v_limit offset v_offset
  )
  select s.id,
         s.friendship_id,
         p.id,
         p.username::text,
         case when bs.blocked_by_other then 'Tài khoản không khả dụng' else p.display_name end,
         extract(year from age(current_date, ui.date_of_birth))::smallint,
         case when bs.blocked then null else p.headline end,
         case when bs.blocked then null else area.name_vi end,
         case when bs.blocked then null else p.avatar_media_id end,
         case when bs.blocked then null else avatar.storage_bucket end,
         case when bs.blocked then null else avatar.storage_path end,
         (not bs.blocked and p.is_creator and exists(
           select 1
           from public.creator_profiles cp
           where cp.user_id = p.id
             and cp.creator_status = 'approved'::public.creator_status
         )),
         (not bs.blocked
           and not private.luxy_online_hidden(p.id)
           and p.last_active_at is not null
           and p.last_active_at >= now() - make_interval(mins => v_online_minutes)),
         private.get_active_luxy_membership_tier(p.id),
         coalesce(s.status::text, 'direct'),
         (not bs.blocked
           and private.is_active_adult(p.id)
           and private.can_message_with_luxy_membership(v_user_id)),
         bs.blocked,
         (s.archived_at is not null),
         s.message_retention_purged_at,
         lm.id,
         lm.message_type::text,
         case
           when lm.id is null then null
           when lm.deleted_at is not null
             or lm.moderation_status = 'removed'::public.message_moderation_status then null
           when lm.message_type = 'text'::public.message_type then left(lm.body, 160)
           else null
         end,
         lm.sender_id,
         lm.sent_at,
         coalesce(unread.unread_count, 0)::bigint
  from selected s
  join public.profiles p on p.id = s.other_id
  join private.user_identity ui on ui.user_id = p.id
  left join public.administrative_areas area on area.id = p.province_id
  cross join lateral (
    select exists(
             select 1
             from public.user_blocks b
             where (b.blocker_id = v_user_id and b.blocked_id = s.other_id)
                or (b.blocker_id = s.other_id and b.blocked_id = v_user_id)
           ) blocked,
           exists(
             select 1
             from public.user_blocks b
             where b.blocker_id = s.other_id and b.blocked_id = v_user_id
           ) blocked_by_other
  ) bs
  left join public.media_assets avatar
    on avatar.id = p.avatar_media_id
   and not bs.blocked
   and private.can_view_media_internal(avatar.id, v_user_id)
  left join lateral (
    select m.*
    from public.messages m
    where m.conversation_id = s.id
      and not private.is_message_hidden_for_user(m.id, v_user_id)
    order by m.sent_at desc, m.id desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*)::bigint unread_count
    from public.messages m
    where m.conversation_id = s.id
      and m.sender_id <> v_user_id
      and m.deleted_at is null
      and m.moderation_status <> 'removed'::public.message_moderation_status
      and not private.is_message_hidden_for_user(m.id, v_user_id)
      and (s.last_read_at is null or m.sent_at > s.last_read_at)
  ) unread on true
  where s.other_id is not null
    and p.deleted_at is null
  order by s.last_message_at desc nulls last, s.created_at desc, s.id;
end;
$$;

revoke all on function public.list_my_conversations(integer, integer) from public, anon;
grant execute on function public.list_my_conversations(integer, integer) to authenticated, service_role;

comment on function public.get_conversation_retention(uuid) is
  'UI-MSG02 retention state for a conversation member. purged_at is populated only after physical seven-day deletion removes at least one message.';
comment on function public.set_conversation_auto_delete(uuid, boolean) is
  'UI-MSG02 retention toggle. Immediate physical deletion updates purged_at only when at least one expired message is removed.';
comment on function public.list_my_conversations(integer, integer) is
  'UI-MSG02 mailbox read model preserving LX-17 membership presentation and exposing retention_purged_at without synthesizing message tombstones.';
