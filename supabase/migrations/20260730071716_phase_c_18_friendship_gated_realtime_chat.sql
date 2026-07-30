-- Phase C / Session 18: friendship-gated realtime text chat.

insert into private.app_config(key, value_json, value_type, description, is_public)
values
  ('chat_message_max_characters', '2000'::jsonb, 'integer'::private.config_value_type, 'Maximum Unicode characters in a text chat message.', true),
  ('chat_default_page_size', '40'::jsonb, 'integer'::private.config_value_type, 'Default number of messages returned per chat history page.', true),
  ('chat_max_page_size', '50'::jsonb, 'integer'::private.config_value_type, 'Maximum number of messages returned by a single chat history request.', true),
  ('chat_rate_limit_10_seconds', '8'::jsonb, 'integer'::private.config_value_type, 'Maximum text messages a user may send in ten seconds.', false),
  ('chat_rate_limit_5_minutes', '120'::jsonb, 'integer'::private.config_value_type, 'Maximum text messages a user may send in five minutes.', false)
on conflict (key) do update
set value_json = excluded.value_json,
    value_type = excluded.value_type,
    description = excluded.description,
    is_public = excluded.is_public,
    updated_at = now();

create table if not exists private.message_user_hides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table private.message_user_hides enable row level security;

create index if not exists message_user_hides_message_idx
  on private.message_user_hides(message_id, user_id);

create or replace function private.is_message_hidden_for_user(p_message_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from private.message_user_hides h
    where h.message_id = p_message_id and h.user_id = p_user_id
  )
$$;

revoke all on function private.is_message_hidden_for_user(uuid, uuid) from public, anon, authenticated;
grant execute on function private.is_message_hidden_for_user(uuid, uuid) to service_role;

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
);

create or replace function public.get_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_other_user_id is null or p_other_user_id=v_user_id then raise exception using errcode='22023',message='invalid_conversation_target'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  select c.id into v_conversation_id
  from public.conversations c
  join public.friendships f on f.id=c.friendship_id
  join public.conversation_members mine on mine.conversation_id=c.id and mine.user_id=v_user_id
  join public.conversation_members theirs on theirs.conversation_id=c.id and theirs.user_id=p_other_user_id
  where f.status='accepted'::public.friendship_status
  limit 1;
  return v_conversation_id;
end;
$$;

create or replace function public.get_conversation_detail(p_conversation_id uuid)
returns table(
  conversation_id uuid,
  friendship_id uuid,
  friendship_status text,
  other_user_id uuid,
  username text,
  display_name text,
  province_name text,
  avatar_media_id uuid,
  avatar_storage_bucket text,
  avatar_storage_path text,
  is_creator boolean,
  blocked_by_viewer boolean,
  blocked_by_other boolean,
  can_send boolean,
  message_max_characters integer,
  page_size integer,
  last_read_message_id uuid,
  last_read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if not private.is_conversation_member(p_conversation_id,v_user_id) then raise exception using errcode='42501',message='conversation_not_available'; end if;
  return query
  with base as (
    select c.id,c.friendship_id,f.status,
           case when f.requester_id=v_user_id then f.addressee_id else f.requester_id end other_id
    from public.conversations c join public.friendships f on f.id=c.friendship_id
    where c.id=p_conversation_id
  ), flags as (
    select b.*,
      exists(select 1 from public.user_blocks ub where ub.blocker_id=v_user_id and ub.blocked_id=b.other_id) viewer_blocked,
      exists(select 1 from public.user_blocks ub where ub.blocker_id=b.other_id and ub.blocked_id=v_user_id) other_blocked
    from base b
  )
  select f.id,f.friendship_id,f.status::text,p.id,p.username::text,
         case when f.other_blocked then 'Tài khoản không khả dụng' else p.display_name end,
         case when f.other_blocked then null else area.name_vi end,
         case when f.viewer_blocked or f.other_blocked then null else p.avatar_media_id end,
         case when f.viewer_blocked or f.other_blocked then null else avatar.storage_bucket end,
         case when f.viewer_blocked or f.other_blocked then null else avatar.storage_path end,
         (not f.viewer_blocked and not f.other_blocked and p.is_creator and exists(
           select 1 from public.creator_profiles cp where cp.user_id=p.id and cp.creator_status='approved'::public.creator_status
         )),
         f.viewer_blocked,f.other_blocked,
         (f.status='accepted'::public.friendship_status and not f.viewer_blocked and not f.other_blocked and private.is_active_adult(f.other_id)),
         coalesce((select (cfg.value_json#>>'{}')::integer from private.app_config cfg where cfg.key='chat_message_max_characters'),2000),
         coalesce((select (cfg.value_json#>>'{}')::integer from private.app_config cfg where cfg.key='chat_default_page_size'),40),
         cm.last_read_message_id,cm.last_read_at
  from flags f
  join public.profiles p on p.id=f.other_id
  join public.conversation_members cm on cm.conversation_id=f.id and cm.user_id=v_user_id
  left join public.administrative_areas area on area.id=p.province_id
  left join public.media_assets avatar on avatar.id=p.avatar_media_id and private.can_view_media_internal(avatar.id,v_user_id);
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
    select c.id,c.friendship_id,c.last_message_at,c.created_at,f.status,
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
  where m.conversation_id=p_conversation_id
    and not private.is_message_hidden_for_user(m.id,v_user_id)
    and (p_before_sent_at is null or (m.sent_at,m.id)<(p_before_sent_at,p_before_id))
  order by m.sent_at desc,m.id desc limit v_limit;
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
    select m.id,m.sent_at into v_message_id,v_sent_at from public.messages m
    where m.conversation_id=p_conversation_id and m.deleted_at is null and m.moderation_status<>'removed'::public.message_moderation_status
      and not private.is_message_hidden_for_user(m.id,v_user_id)
    order by m.sent_at desc,m.id desc limit 1;
  else
    select m.sent_at into v_sent_at from public.messages m where m.id=v_message_id and m.conversation_id=p_conversation_id;
    if not found then raise exception using errcode='23503',message='message_not_in_conversation'; end if;
  end if;
  update public.conversation_members cm set last_read_message_id=v_message_id,last_read_at=coalesce(v_sent_at,now())
  where cm.conversation_id=p_conversation_id and cm.user_id=v_user_id;
  return found;
end;
$$;

create or replace function public.hide_message_for_me(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid:=auth.uid(); v_conversation_id uuid;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  select m.conversation_id into v_conversation_id from public.messages m where m.id=p_message_id;
  if v_conversation_id is null or not private.is_conversation_member(v_conversation_id,v_user_id) then raise exception using errcode='42501',message='message_not_available'; end if;
  insert into private.message_user_hides(user_id,message_id) values(v_user_id,p_message_id) on conflict(user_id,message_id) do nothing;
  return true;
end;
$$;

revoke all on function public.get_direct_conversation(uuid) from public,anon;
revoke all on function public.get_conversation_detail(uuid) from public,anon;
revoke all on function public.list_my_conversations(integer,integer) from public,anon;
revoke all on function public.list_conversation_messages(uuid,integer,timestamptz,uuid) from public,anon;
revoke all on function public.send_message(uuid,text,uuid) from public,anon;
revoke all on function public.mark_conversation_read(uuid,uuid) from public,anon;
revoke all on function public.hide_message_for_me(uuid) from public,anon;
grant execute on function public.get_direct_conversation(uuid) to authenticated,service_role;
grant execute on function public.get_conversation_detail(uuid) to authenticated,service_role;
grant execute on function public.list_my_conversations(integer,integer) to authenticated,service_role;
grant execute on function public.list_conversation_messages(uuid,integer,timestamptz,uuid) to authenticated,service_role;
grant execute on function public.send_message(uuid,text,uuid) to authenticated,service_role;
grant execute on function public.mark_conversation_read(uuid,uuid) to authenticated,service_role;
grant execute on function public.hide_message_for_me(uuid) to authenticated,service_role;
