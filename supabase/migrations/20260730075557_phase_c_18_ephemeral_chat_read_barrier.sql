-- Enforce the seven-day boundary at read time and optimize physical purge.

create index if not exists messages_retention_purge_idx
  on public.messages(sent_at, id, conversation_id);

drop policy if exists messages_select_members on public.messages;
create policy messages_select_members
on public.messages
for select
to authenticated
using (
  private.is_active_adult((select auth.uid()))
  and private.is_conversation_member(conversation_id, (select auth.uid()))
  and moderation_status <> 'removed'::public.message_moderation_status
  and deleted_at is null
  and not private.is_message_hidden_for_user(id, (select auth.uid()))
  and exists (
    select 1
    from public.conversations retention_conversation
    where retention_conversation.id = conversation_id
      and (
        retention_conversation.auto_delete_messages_after_days is null
        or sent_at > now() - interval '7 days'
      )
  )
);

create or replace function private.purge_expired_conversation_messages()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint := 0;
begin
  with targets as (
    select m.id
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.auto_delete_messages_after_days = 7
      and m.sent_at <= now() - interval '7 days'
    order by m.sent_at, m.id
    limit 5000
    for update of m skip locked
  ), deleted as (
    delete from public.messages m
    using targets t
    where m.id = t.id
    returning m.conversation_id
  ), affected as (
    select distinct d.conversation_id
    from deleted d
  ), refreshed as (
    update public.conversations c
    set last_message_at = (
          select max(remaining.sent_at)
          from public.messages remaining
          where remaining.conversation_id = c.id
        ),
        updated_at = now()
    from affected a
    where c.id = a.conversation_id
    returning c.id
  )
  select count(*)::bigint into v_deleted from deleted;

  return v_deleted;
end;
$$;

create or replace function public.list_my_conversations(p_limit integer default 30,p_offset integer default 0)
returns table(
  conversation_id uuid,
  friendship_id uuid,
  other_user_id uuid,
  username text,
  display_name text,
  province_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  is_creator boolean,
  friendship_status text,
  can_send boolean,
  blocked boolean,
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
declare v_user_id uuid:=auth.uid(); v_limit integer:=least(greatest(coalesce(p_limit,30),1),50); v_offset integer:=least(greatest(coalesce(p_offset,0),0),500);
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  return query
  with selected as (
    select c.id,c.friendship_id,c.last_message_at,c.created_at,c.auto_delete_messages_after_days,f.status,
           case when f.requester_id=v_user_id then f.addressee_id else f.requester_id end other_id,
           cm.last_read_at
    from public.conversation_members cm
    join public.conversations c on c.id=cm.conversation_id
    join public.friendships f on f.id=c.friendship_id
    where cm.user_id=v_user_id
    order by c.last_message_at desc nulls last,c.created_at desc,c.id
    limit v_limit offset v_offset
  )
  select s.id,s.friendship_id,p.id,p.username::text,
         case when bs.blocked_by_other then 'Tài khoản không khả dụng' else p.display_name end,
         case when bs.blocked then null else area.name_vi end,
         case when bs.blocked then null else p.avatar_media_id end,
         case when bs.blocked then null else avatar.storage_bucket end,
         case when bs.blocked then null else avatar.storage_path end,
         (not bs.blocked and p.is_creator and exists(select 1 from public.creator_profiles cp where cp.user_id=p.id and cp.creator_status='approved'::public.creator_status)),
         s.status::text,
         (s.status='accepted'::public.friendship_status and not bs.blocked and private.is_active_adult(p.id)),
         bs.blocked,lm.id,lm.message_type::text,
         case when lm.id is null then null when lm.deleted_at is not null or lm.moderation_status='removed'::public.message_moderation_status then null when lm.message_type='text'::public.message_type then left(lm.body,160) else null end,
         lm.sender_id,lm.sent_at,coalesce(unread.unread_count,0)::bigint
  from selected s
  join public.profiles p on p.id=s.other_id
  left join public.administrative_areas area on area.id=p.province_id
  cross join lateral (
    select exists(select 1 from public.user_blocks b where (b.blocker_id=v_user_id and b.blocked_id=s.other_id) or (b.blocker_id=s.other_id and b.blocked_id=v_user_id)) blocked,
           exists(select 1 from public.user_blocks b where b.blocker_id=s.other_id and b.blocked_id=v_user_id) blocked_by_other
  ) bs
  left join public.media_assets avatar on avatar.id=p.avatar_media_id and not bs.blocked and private.can_view_media_internal(avatar.id,v_user_id)
  left join lateral (
    select m.* from public.messages m
    where m.conversation_id=s.id
      and not private.is_message_hidden_for_user(m.id,v_user_id)
      and (s.auto_delete_messages_after_days is null or m.sent_at > now()-interval '7 days')
    order by m.sent_at desc,m.id desc limit 1
  ) lm on true
  left join lateral (
    select count(*)::bigint unread_count from public.messages m
    where m.conversation_id=s.id and m.sender_id<>v_user_id and m.deleted_at is null
      and m.moderation_status<>'removed'::public.message_moderation_status
      and not private.is_message_hidden_for_user(m.id,v_user_id)
      and (s.auto_delete_messages_after_days is null or m.sent_at > now()-interval '7 days')
      and (s.last_read_at is null or m.sent_at>s.last_read_at)
  ) unread on true
  where p.deleted_at is null
  order by s.last_message_at desc nulls last,s.created_at desc,s.id;
end;
$$;

create or replace function public.list_conversation_messages(
  p_conversation_id uuid,
  p_limit integer default 40,
  p_before_sent_at timestamptz default null,
  p_before_id uuid default null
)
returns table(
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  message_type text,
  body text,
  gift_transaction_id uuid,
  client_message_id uuid,
  sent_at timestamptz,
  edited_at timestamptz,
  removed boolean,
  is_own boolean,
  is_read_by_other boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid:=auth.uid(); v_limit integer:=least(greatest(coalesce(p_limit,40),1),50);
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if not private.is_conversation_member(p_conversation_id,v_user_id) then raise exception using errcode='42501',message='conversation_not_available'; end if;
  if (p_before_sent_at is null)<>(p_before_id is null) then raise exception using errcode='22023',message='invalid_message_cursor'; end if;
  return query
  select m.id,m.conversation_id,m.sender_id,m.message_type::text,
         case when m.deleted_at is not null or m.moderation_status='removed'::public.message_moderation_status then null else m.body end,
         m.gift_transaction_id,m.client_message_id,m.sent_at,m.edited_at,
         (m.deleted_at is not null or m.moderation_status='removed'::public.message_moderation_status),
         (m.sender_id=v_user_id),
         exists(select 1 from public.conversation_members om where om.conversation_id=m.conversation_id and om.user_id<>v_user_id and om.last_read_at is not null and om.last_read_at>=m.sent_at)
  from public.messages m
  join public.conversations c on c.id=m.conversation_id
  where m.conversation_id=p_conversation_id
    and not private.is_message_hidden_for_user(m.id,v_user_id)
    and (c.auto_delete_messages_after_days is null or m.sent_at > now()-interval '7 days')
    and (p_before_sent_at is null or (m.sent_at,m.id)<(p_before_sent_at,p_before_id))
  order by m.sent_at desc,m.id desc limit v_limit;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid,p_message_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid:=auth.uid(); v_message_id uuid:=p_message_id; v_sent_at timestamptz;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if not private.is_conversation_member(p_conversation_id,v_user_id) then raise exception using errcode='42501',message='conversation_not_available'; end if;
  if v_message_id is null then
    select m.id,m.sent_at into v_message_id,v_sent_at
    from public.messages m
    join public.conversations c on c.id=m.conversation_id
    where m.conversation_id=p_conversation_id and m.deleted_at is null and m.moderation_status<>'removed'::public.message_moderation_status
      and not private.is_message_hidden_for_user(m.id,v_user_id)
      and (c.auto_delete_messages_after_days is null or m.sent_at > now()-interval '7 days')
    order by m.sent_at desc,m.id desc limit 1;
  else
    select m.sent_at into v_sent_at
    from public.messages m
    join public.conversations c on c.id=m.conversation_id
    where m.id=v_message_id and m.conversation_id=p_conversation_id
      and (c.auto_delete_messages_after_days is null or m.sent_at > now()-interval '7 days');
    if not found then raise exception using errcode='23503',message='message_not_in_conversation'; end if;
  end if;
  update public.conversation_members cm set last_read_message_id=v_message_id,last_read_at=coalesce(v_sent_at,now())
  where cm.conversation_id=p_conversation_id and cm.user_id=v_user_id;
  return found;
end;
$$;

create or replace function public.send_message(p_conversation_id uuid,p_body text,p_client_message_id uuid)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid:=auth.uid(); v_existing public.messages%rowtype; v_result public.messages%rowtype;
  v_friendship public.friendships%rowtype; v_other_user_id uuid;
  v_short_limit integer:=8; v_long_limit integer:=120; v_max_characters integer:=2000;
  v_body text:=btrim(coalesce(p_body,''));
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if p_client_message_id is null then raise exception using errcode='22023',message='client_message_id_required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  select * into v_existing from public.messages m where m.sender_id=v_user_id and m.client_message_id=p_client_message_id;
  if found then
    if v_existing.conversation_id<>p_conversation_id or coalesce(v_existing.body,'')<>v_body then raise exception using errcode='22023',message='client_message_id_conflict'; end if;
    return v_existing;
  end if;
  select coalesce((cfg.value_json#>>'{}')::integer,2000) into v_max_characters from private.app_config cfg where cfg.key='chat_message_max_characters';
  v_max_characters:=coalesce(v_max_characters,2000);
  if v_body='' or char_length(v_body)>v_max_characters then raise exception using errcode='22023',message='invalid_message_body'; end if;
  if not private.is_conversation_member(p_conversation_id,v_user_id) then raise exception using errcode='42501',message='sender_not_conversation_member'; end if;
  select f.* into v_friendship from public.conversations c join public.friendships f on f.id=c.friendship_id where c.id=p_conversation_id;
  if not found or v_friendship.status<>'accepted'::public.friendship_status then raise exception using errcode='42501',message='accepted_friendship_required'; end if;
  v_other_user_id:=case when v_friendship.requester_id=v_user_id then v_friendship.addressee_id else v_friendship.requester_id end;
  if private.users_are_blocked(v_user_id,v_other_user_id) then raise exception using errcode='42501',message='messaging_blocked'; end if;
  if not private.is_active_adult(v_other_user_id) then raise exception using errcode='42501',message='recipient_not_available'; end if;
  select coalesce((cfg.value_json#>>'{}')::integer,8) into v_short_limit from private.app_config cfg where cfg.key='chat_rate_limit_10_seconds';
  select coalesce((cfg.value_json#>>'{}')::integer,120) into v_long_limit from private.app_config cfg where cfg.key='chat_rate_limit_5_minutes';
  v_short_limit:=coalesce(v_short_limit,8); v_long_limit:=coalesce(v_long_limit,120);
  if (select count(*) from public.messages m where m.sender_id=v_user_id and m.sent_at>now()-interval '10 seconds')>=v_short_limit then raise exception using errcode='54000',message='message_rate_limited_short'; end if;
  if (select count(*) from public.messages m where m.sender_id=v_user_id and m.sent_at>now()-interval '5 minutes')>=v_long_limit then raise exception using errcode='54000',message='message_rate_limited_long'; end if;
  insert into public.messages(conversation_id,sender_id,message_type,body,client_message_id)
  values(p_conversation_id,v_user_id,'text'::public.message_type,v_body,p_client_message_id) returning * into v_result;
  update public.conversations c set last_message_at=greatest(coalesce(c.last_message_at,v_result.sent_at),v_result.sent_at) where c.id=p_conversation_id;
  return v_result;
end;
$$;

do $$
declare v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname='myfan-purge-ephemeral-chat' loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule('myfan-purge-ephemeral-chat','* * * * *','select private.purge_expired_conversation_messages();');
end;
$$;
