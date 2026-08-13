-- LX-15 hardening: validate conversation membership before paid entitlement.
-- This avoids leaking membership-state errors to authenticated non-members who probe
-- a conversation UUID, while preserving Premium/Diamond send enforcement for members.

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
  if v_body='' or char_length(v_body)>v_max_characters then
    raise exception using errcode='22023',message='invalid_message_body';
  end if;

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

revoke all on function public.send_message(uuid,text,uuid) from public,anon;
grant execute on function public.send_message(uuid,text,uuid) to authenticated,service_role;

comment on function public.send_message(uuid,text,uuid) is
  'LX-15 Premium/Diamond text send. Membership is checked only after conversation membership, then block/recipient/idempotency/rate limits are enforced.';
