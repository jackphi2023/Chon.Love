-- Phase C / Session 18 addendum: per-conversation seven-day physical message deletion.
-- Either participant may toggle the setting. It applies to both participants.

alter table public.conversations
  add column if not exists auto_delete_messages_after_days smallint null,
  add column if not exists message_retention_updated_at timestamptz null,
  add column if not exists message_retention_updated_by uuid null references public.profiles(id) on delete set null;

alter table public.conversations
  drop constraint if exists conversations_auto_delete_days;
alter table public.conversations
  add constraint conversations_auto_delete_days
  check (auto_delete_messages_after_days is null or auto_delete_messages_after_days = 7);

create index if not exists conversations_auto_delete_enabled_idx
  on public.conversations(id, auto_delete_messages_after_days)
  where auto_delete_messages_after_days = 7;

-- A report linked to an expiring message must not retain or block its physical deletion.
alter table public.reports
  drop constraint if exists reports_target_message_id_fkey;
alter table public.reports
  add constraint reports_target_message_id_fkey
  foreign key (target_message_id)
  references public.messages(id)
  on delete cascade;

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
  )
  select count(*)::bigint into v_deleted from deleted;

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

create or replace function public.get_conversation_retention(p_conversation_id uuid)
returns table(
  conversation_id uuid,
  auto_delete_enabled boolean,
  auto_delete_after_days integer,
  updated_at timestamptz
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
         c.message_retention_updated_at
  from public.conversations c
  where c.id = p_conversation_id;
end;
$$;

create or replace function public.set_conversation_auto_delete(
  p_conversation_id uuid,
  p_enabled boolean
)
returns table(
  conversation_id uuid,
  auto_delete_enabled boolean,
  auto_delete_after_days integer,
  updated_at timestamptz,
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
    )
    where c.id = p_conversation_id;
  end if;

  return query
  select c.id,
         (c.auto_delete_messages_after_days = 7),
         c.auto_delete_messages_after_days::integer,
         c.message_retention_updated_at,
         v_deleted
  from public.conversations c
  where c.id = p_conversation_id;
end;
$$;

revoke all on function public.get_conversation_retention(uuid) from public, anon;
revoke all on function public.set_conversation_auto_delete(uuid, boolean) from public, anon;
grant execute on function public.get_conversation_retention(uuid) to authenticated, service_role;
grant execute on function public.set_conversation_auto_delete(uuid, boolean) to authenticated, service_role;

alter table public.messages replica identity full;

create extension if not exists pg_cron;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'myfan-purge-ephemeral-chat'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'myfan-purge-ephemeral-chat',
    '*/5 * * * *',
    'select private.purge_expired_conversation_messages();'
  );
end;
$$;
