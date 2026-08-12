-- LX-15: Seeking-style direct messaging entitlement with a stable public schema.
--
-- Product contract:
-- - Friendship is no longer a prerequisite for a direct conversation.
-- - Premium/Diamond may start a direct conversation and send member-authored text.
-- - Free members may receive/read conversations addressed to them but cannot start/send text.
-- - Block, active-adult, rate-limit, moderation, idempotency and retention rules remain enforced.
-- - Existing friendship-backed conversations remain compatible.
-- - Canonical direct participant pairs live in private schema so exact participant mapping is not
--   added to the generated public client contract.
-- - No billing activation is implemented here; LX-17/LX-18 remain authoritative.

create table if not exists private.direct_conversation_pairs (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  member_low_id uuid not null references public.profiles(id) on delete cascade,
  member_high_id uuid not null references public.profiles(id) on delete cascade,
  synthetic_friendship_id uuid references public.friendships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_conversation_pairs_not_self check(member_low_id<>member_high_id),
  constraint direct_conversation_pairs_canonical check(
    member_low_id=least(member_low_id,member_high_id)
    and member_high_id=greatest(member_low_id,member_high_id)
  ),
  unique(member_low_id,member_high_id)
);

create index if not exists direct_conversation_pairs_low_idx
  on private.direct_conversation_pairs(member_low_id,member_high_id,conversation_id);
create index if not exists direct_conversation_pairs_high_idx
  on private.direct_conversation_pairs(member_high_id,member_low_id,conversation_id);

alter table private.direct_conversation_pairs enable row level security;
revoke all on table private.direct_conversation_pairs from public,anon,authenticated;
revoke all on table private.direct_conversation_pairs from service_role;
grant select,insert,update,delete on table private.direct_conversation_pairs to service_role;

drop policy if exists direct_conversation_pairs_deny_client on private.direct_conversation_pairs;
create policy direct_conversation_pairs_deny_client
  on private.direct_conversation_pairs
  for all
  to anon,authenticated
  using(false)
  with check(false);

comment on table private.direct_conversation_pairs is
  'LX-15 canonical direct-message participants. Server-only; preserves the existing public conversations contract.';
comment on column private.direct_conversation_pairs.synthetic_friendship_id is
  'Technical cancelled friendship row used only to satisfy the legacy conversations FK for direct-only conversations; never represents an accepted friendship.';

-- Backfill every existing legacy conversation from its actual friendship participants.
insert into private.direct_conversation_pairs(conversation_id,member_low_id,member_high_id,synthetic_friendship_id)
select c.id,least(f.requester_id,f.addressee_id),greatest(f.requester_id,f.addressee_id),null
from public.conversations c
join public.friendships f on f.id=c.friendship_id
on conflict(conversation_id) do update
set member_low_id=excluded.member_low_id,
    member_high_id=excluded.member_high_id,
    updated_at=now();

create or replace function private.get_direct_conversation_other_user(
  p_conversation_id uuid,
  p_user_id uuid
)
returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select case
    when d.member_low_id=p_user_id then d.member_high_id
    when d.member_high_id=p_user_id then d.member_low_id
    else null::uuid
  end
  from private.direct_conversation_pairs d
  where d.conversation_id=p_conversation_id
$$;

create or replace function private.is_synthetic_direct_friendship(
  p_conversation_id uuid,
  p_friendship_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from private.direct_conversation_pairs d
    where d.conversation_id=p_conversation_id
      and d.synthetic_friendship_id=p_friendship_id
  )
$$;

revoke all on function private.get_direct_conversation_other_user(uuid,uuid) from public,anon,authenticated;
revoke all on function private.is_synthetic_direct_friendship(uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_direct_conversation_other_user(uuid,uuid) to service_role;
grant execute on function private.is_synthetic_direct_friendship(uuid,uuid) to service_role;

-- Preserve the legacy accepted-friendship lifecycle. If a direct-only conversation already
-- exists, accepting a real friendship attaches that relationship to the same conversation and
-- removes the technical cancelled row used solely for the legacy FK.
create or replace function private.ensure_direct_conversation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_conversation_id uuid;
  v_low uuid;
  v_high uuid;
  v_synthetic_friendship_id uuid;
begin
  if new.status='accepted'::public.friendship_status and old.status is distinct from new.status then
    v_low:=least(new.requester_id,new.addressee_id);
    v_high:=greatest(new.requester_id,new.addressee_id);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_low::text||':'||v_high::text,0));

    select d.conversation_id,d.synthetic_friendship_id
      into v_conversation_id,v_synthetic_friendship_id
    from private.direct_conversation_pairs d
    where d.member_low_id=v_low and d.member_high_id=v_high
    limit 1;

    if v_conversation_id is null then
      insert into public.conversations(friendship_id)
      values(new.id)
      on conflict(friendship_id) do update set updated_at=now()
      returning id into v_conversation_id;

      insert into private.direct_conversation_pairs(
        conversation_id,member_low_id,member_high_id,synthetic_friendship_id
      ) values(v_conversation_id,v_low,v_high,null)
      on conflict(member_low_id,member_high_id) do update
        set updated_at=now();
    else
      update public.conversations
      set friendship_id=new.id,updated_at=now()
      where id=v_conversation_id;

      update private.direct_conversation_pairs
      set synthetic_friendship_id=null,updated_at=now()
      where conversation_id=v_conversation_id;

      if v_synthetic_friendship_id is not null and v_synthetic_friendship_id<>new.id then
        delete from public.friendships where id=v_synthetic_friendship_id;
      end if;
    end if;

    insert into public.conversation_members(conversation_id,user_id)
    values(v_conversation_id,new.requester_id),(v_conversation_id,new.addressee_id)
    on conflict(conversation_id,user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.ensure_direct_conversation() from public,anon,authenticated;

create or replace function public.get_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_conversation_id uuid;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if p_other_user_id is null or p_other_user_id=v_user_id then raise exception using errcode='22023',message='invalid_conversation_target'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;

  select d.conversation_id into v_conversation_id
  from private.direct_conversation_pairs d
  where d.member_low_id=least(v_user_id,p_other_user_id)
    and d.member_high_id=greatest(v_user_id,p_other_user_id)
    and private.is_conversation_member(d.conversation_id,v_user_id)
  limit 1;

  return v_conversation_id;
end;
$$;

-- Paid profile CTA: atomically get/create a canonical direct conversation.
-- A technical cancelled friendship row is created only to satisfy the unchanged legacy FK;
-- it is not accepted, is not used as entitlement, and is removed if a real friendship is accepted.
create or replace function public.get_luxy_profile_conversation(p_profile_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_conversation_id uuid;
  v_low uuid;
  v_high uuid;
  v_synthetic_friendship_id uuid;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if not private.can_message_with_luxy_membership(v_user_id) then
    raise exception using errcode='42501',message='premium_membership_required';
  end if;
  if p_profile_id is null or p_profile_id=v_user_id then
    raise exception using errcode='22023',message='invalid_conversation_target';
  end if;
  if private.users_are_blocked(v_user_id,p_profile_id)
    or not private.is_active_adult(p_profile_id)
    or not exists(
      select 1 from public.profiles p
      where p.id=p_profile_id and p.profile_status='active' and p.deleted_at is null
    ) then
    raise exception using errcode='42501',message='conversation_target_not_available';
  end if;

  v_low:=least(v_user_id,p_profile_id);
  v_high:=greatest(v_user_id,p_profile_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_low::text||':'||v_high::text,0));

  select d.conversation_id into v_conversation_id
  from private.direct_conversation_pairs d
  where d.member_low_id=v_low and d.member_high_id=v_high
  limit 1;

  if v_conversation_id is null then
    insert into public.friendships(requester_id,addressee_id,status,responded_at)
    values(v_low,v_high,'cancelled'::public.friendship_status,now())
    returning id into v_synthetic_friendship_id;

    insert into public.conversations(friendship_id)
    values(v_synthetic_friendship_id)
    returning id into v_conversation_id;

    insert into private.direct_conversation_pairs(
      conversation_id,member_low_id,member_high_id,synthetic_friendship_id
    ) values(v_conversation_id,v_low,v_high,v_synthetic_friendship_id);
  end if;

  insert into public.conversation_members(conversation_id,user_id)
  values(v_conversation_id,v_user_id),(v_conversation_id,p_profile_id)
  on conflict(conversation_id,user_id) do nothing;

  return v_conversation_id;
end;
$$;

create or replace function private.validate_message_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_other_user uuid;
begin
  if not private.is_conversation_member(new.conversation_id,new.sender_id) then
    raise exception using errcode='42501',message='sender_not_conversation_member';
  end if;

  v_other_user:=private.get_direct_conversation_other_user(new.conversation_id,new.sender_id);
  if v_other_user is null then
    raise exception using errcode='42501',message='conversation_not_available';
  end if;

  if new.message_type='text'::public.message_type
    and auth.uid() is not null
    and auth.uid()=new.sender_id
    and not private.has_active_luxy_paid_membership(new.sender_id) then
    raise exception using errcode='42501',message='premium_membership_required';
  end if;

  if private.users_are_blocked(new.sender_id,v_other_user) then
    raise exception using errcode='42501',message='messaging_blocked';
  end if;
  if not private.is_active_adult(v_other_user) then
    raise exception using errcode='42501',message='recipient_not_available';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_message_insert() from public,anon,authenticated;

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
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if not private.is_conversation_member(p_conversation_id,v_user_id) then raise exception using errcode='42501',message='conversation_not_available'; end if;

  return query
  with base as (
    select c.id,c.friendship_id,f.status,
           private.is_synthetic_direct_friendship(c.id,c.friendship_id) synthetic_relation,
           private.get_direct_conversation_other_user(c.id,v_user_id) other_id
    from public.conversations c
    left join public.friendships f on f.id=c.friendship_id
    where c.id=p_conversation_id
  ), flags as (
    select b.*,
      exists(select 1 from public.user_blocks ub where ub.blocker_id=v_user_id and ub.blocked_id=b.other_id) viewer_blocked,
      exists(select 1 from public.user_blocks ub where ub.blocker_id=b.other_id and ub.blocked_id=v_user_id) other_blocked
    from base b
    where b.other_id is not null
  )
  select f.id,f.friendship_id,
         case when f.synthetic_relation then 'direct' else coalesce(f.status::text,'direct') end,
         p.id,p.username::text,
         case when f.other_blocked then 'Tài khoản không khả dụng' else p.display_name end,
         case when f.other_blocked then null else area.name_vi end,
         case when f.viewer_blocked or f.other_blocked then null else p.avatar_media_id end,
         case when f.viewer_blocked or f.other_blocked then null else avatar.storage_bucket end,
         case when f.viewer_blocked or f.other_blocked then null else avatar.storage_path end,
         (not f.viewer_blocked and not f.other_blocked and p.is_creator and exists(
           select 1 from public.creator_profiles cp where cp.user_id=p.id and cp.creator_status='approved'::public.creator_status
         )),
         f.viewer_blocked,f.other_blocked,
         (not f.viewer_blocked and not f.other_blocked and private.is_active_adult(f.other_id)
           and private.can_message_with_luxy_membership(v_user_id)),
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
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_limit integer:=least(greatest(coalesce(p_limit,30),1),50);
  v_offset integer:=least(greatest(coalesce(p_offset,0),0),500);
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;

  return query
  with selected as (
    select c.id,c.friendship_id,c.last_message_at,c.created_at,f.status,
           private.is_synthetic_direct_friendship(c.id,c.friendship_id) synthetic_relation,
           private.get_direct_conversation_other_user(c.id,v_user_id) other_id,
           cm.last_read_at
    from public.conversation_members cm
    join public.conversations c on c.id=cm.conversation_id
    left join public.friendships f on f.id=c.friendship_id
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
         (not bs.blocked and p.is_creator and exists(
           select 1 from public.creator_profiles cp where cp.user_id=p.id and cp.creator_status='approved'::public.creator_status
         )),
         case when s.synthetic_relation then 'direct' else coalesce(s.status::text,'direct') end,
         (not bs.blocked and private.is_active_adult(p.id) and private.can_message_with_luxy_membership(v_user_id)),
         bs.blocked,lm.id,lm.message_type::text,
         case
           when lm.id is null then null
           when lm.deleted_at is not null or lm.moderation_status='removed'::public.message_moderation_status then null
           when lm.message_type='text'::public.message_type then left(lm.body,160)
           else null
         end,
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
  where s.other_id is not null and p.deleted_at is null
  order by s.last_message_at desc nulls last,s.created_at desc,s.id;
end;
$$;

create or replace function public.send_message(p_conversation_id uuid,p_body text,p_client_message_id uuid)
returns public.messages
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_existing public.messages%rowtype;
  v_result public.messages%rowtype;
  v_other_user_id uuid;
  v_short_limit integer:=8;
  v_long_limit integer:=120;
  v_max_characters integer:=2000;
  v_body text:=btrim(coalesce(p_body,''));
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if p_client_message_id is null then raise exception using errcode='22023',message='client_message_id_required'; end if;
  if not private.is_conversation_member(p_conversation_id,v_user_id) then
    raise exception using errcode='42501',message='sender_not_conversation_member';
  end if;
  if not private.can_message_with_luxy_membership(v_user_id) then
    raise exception using errcode='42501',message='premium_membership_required';
  end if;

  select * into v_existing
  from public.messages m
  where m.sender_id=v_user_id and m.client_message_id=p_client_message_id;
  if found then
    if v_existing.conversation_id<>p_conversation_id or coalesce(v_existing.body,'')<>v_body then
      raise exception using errcode='22023',message='client_message_id_conflict';
    end if;
    return v_existing;
  end if;

  select coalesce((cfg.value_json#>>'{}')::integer,2000)
  into v_max_characters from private.app_config cfg where cfg.key='chat_message_max_characters';
  v_max_characters:=coalesce(v_max_characters,2000);
  if v_body='' or char_length(v_body)>v_max_characters then raise exception using errcode='22023',message='invalid_message_body'; end if;

  v_other_user_id:=private.get_direct_conversation_other_user(p_conversation_id,v_user_id);
  if v_other_user_id is null then raise exception using errcode='42501',message='conversation_not_available'; end if;
  if private.users_are_blocked(v_user_id,v_other_user_id) then raise exception using errcode='42501',message='messaging_blocked'; end if;
  if not private.is_active_adult(v_other_user_id) then raise exception using errcode='42501',message='recipient_not_available'; end if;

  select coalesce((cfg.value_json#>>'{}')::integer,8)
  into v_short_limit from private.app_config cfg where cfg.key='chat_rate_limit_10_seconds';
  select coalesce((cfg.value_json#>>'{}')::integer,120)
  into v_long_limit from private.app_config cfg where cfg.key='chat_rate_limit_5_minutes';
  v_short_limit:=coalesce(v_short_limit,8);
  v_long_limit:=coalesce(v_long_limit,120);

  if (select count(*) from public.messages m where m.sender_id=v_user_id and m.sent_at>now()-interval '10 seconds')>=v_short_limit then
    raise exception using errcode='54000',message='message_rate_limited_short';
  end if;
  if (select count(*) from public.messages m where m.sender_id=v_user_id and m.sent_at>now()-interval '5 minutes')>=v_long_limit then
    raise exception using errcode='54000',message='message_rate_limited_long';
  end if;

  insert into public.messages(conversation_id,sender_id,message_type,body,client_message_id)
  values(p_conversation_id,v_user_id,'text'::public.message_type,v_body,p_client_message_id)
  returning * into v_result;

  update public.conversations c
  set last_message_at=greatest(coalesce(c.last_message_at,v_result.sent_at),v_result.sent_at)
  where c.id=p_conversation_id;

  return v_result;
end;
$$;

revoke all on function public.get_direct_conversation(uuid) from public,anon;
revoke all on function public.get_luxy_profile_conversation(uuid) from public,anon;
revoke all on function public.get_conversation_detail(uuid) from public,anon;
revoke all on function public.list_my_conversations(integer,integer) from public,anon;
revoke all on function public.send_message(uuid,text,uuid) from public,anon;

grant execute on function public.get_direct_conversation(uuid) to authenticated,service_role;
grant execute on function public.get_luxy_profile_conversation(uuid) to authenticated,service_role;
grant execute on function public.get_conversation_detail(uuid) to authenticated,service_role;
grant execute on function public.list_my_conversations(integer,integer) to authenticated,service_role;
grant execute on function public.send_message(uuid,text,uuid) to authenticated,service_role;

comment on function public.get_luxy_profile_conversation(uuid) is
  'LX-15 Premium/Diamond direct-conversation get-or-create. No accepted friendship is required; canonical participants are private.';
comment on function public.get_direct_conversation(uuid) is
  'LX-15 participant-pair lookup independent of friendship state.';
comment on function private.validate_message_insert() is
  'LX-15 validates participant, paid text entitlement, block and active recipient without accepted-friendship prerequisite.';
comment on function public.send_message(uuid,text,uuid) is
  'LX-15 Premium/Diamond text send with membership-after-conversation authorization, idempotency, rate limits and safety.';
