-- OPT-02 — Media moderation integrity
--
-- Contract:
-- 1. Every non-deleted pending_review media row owns exactly one active moderation case.
-- 2. Existing approved profile media remains authoritative until a replacement is approved.
-- 3. Resolving/deleting the only active case while media is still pending is self-healing.
--
-- The existing profile/avatar presentation trigger remains the source of truth for approved-only
-- public references. This migration adds the missing moderation-queue invariant without creating
-- a parallel media state model.

-- Reconcile historical duplicate active cases before installing the uniqueness guard.
with ranked_active_cases as (
  select
    mc.id,
    row_number() over (
      partition by mc.media_id
      order by mc.created_at, mc.id
    ) as active_rank
  from public.moderation_cases mc
  where mc.media_id is not null
    and mc.status in (
      'open'::public.moderation_case_status,
      'queued'::public.moderation_case_status,
      'in_review'::public.moderation_case_status
    )
)
update public.moderation_cases mc
set
  status='closed'::public.moderation_case_status,
  decision_notes=coalesce(
    mc.decision_notes,
    'Closed duplicate active media review case during OPT-02 reconciliation.'
  ),
  resolved_at=coalesce(mc.resolved_at,now()),
  updated_at=now()
from ranked_active_cases ranked
where mc.id=ranked.id
  and ranked.active_rank>1;

create unique index if not exists moderation_cases_one_active_case_per_media_idx
on public.moderation_cases(media_id)
where media_id is not null
  and status in (
    'open'::public.moderation_case_status,
    'queued'::public.moderation_case_status,
    'in_review'::public.moderation_case_status
  );

create or replace function private.ensure_open_media_moderation_case(
  p_media_id uuid,
  p_source public.moderation_source default 'admin_review'::public.moderation_source
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_media public.media_assets%rowtype;
  v_case_id uuid;
begin
  if p_media_id is null then
    return null;
  end if;

  select media.*
  into v_media
  from public.media_assets media
  where media.id=p_media_id
  for update;

  if not found
     or v_media.deleted_at is not null
     or v_media.moderation_status<>'pending_review'::public.media_moderation_status then
    return null;
  end if;

  select mc.id
  into v_case_id
  from public.moderation_cases mc
  where mc.media_id=p_media_id
    and mc.status in (
      'open'::public.moderation_case_status,
      'queued'::public.moderation_case_status,
      'in_review'::public.moderation_case_status
    )
  order by mc.created_at,mc.id
  limit 1;

  if v_case_id is not null then
    return v_case_id;
  end if;

  insert into public.moderation_cases(
    media_id,
    source,
    status,
    priority,
    rule_codes
  ) values (
    p_media_id,
    coalesce(p_source,'admin_review'::public.moderation_source),
    'queued'::public.moderation_case_status,
    'normal'::public.moderation_priority,
    array['pending_media_review']::text[]
  )
  on conflict do nothing
  returning id into v_case_id;

  if v_case_id is null then
    select mc.id
    into v_case_id
    from public.moderation_cases mc
    where mc.media_id=p_media_id
      and mc.status in (
        'open'::public.moderation_case_status,
        'queued'::public.moderation_case_status,
        'in_review'::public.moderation_case_status
      )
    order by mc.created_at,mc.id
    limit 1;
  end if;

  return v_case_id;
end;
$function$;

revoke all on function private.ensure_open_media_moderation_case(uuid,public.moderation_source)
from public,anon,authenticated;
grant execute on function private.ensure_open_media_moderation_case(uuid,public.moderation_source)
to service_role;

create or replace function private.ensure_pending_media_case_from_media()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.ensure_open_media_moderation_case(new.id,'admin_review'::public.moderation_source);
  return null;
end;
$function$;

revoke all on function private.ensure_pending_media_case_from_media()
from public,anon,authenticated;

create or replace function private.ensure_pending_media_case_from_case()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if tg_op='DELETE' then
    perform private.ensure_open_media_moderation_case(old.media_id,'admin_review'::public.moderation_source);
    return null;
  end if;

  if tg_op='UPDATE' and old.media_id is distinct from new.media_id then
    perform private.ensure_open_media_moderation_case(old.media_id,'admin_review'::public.moderation_source);
  end if;

  perform private.ensure_open_media_moderation_case(new.media_id,'admin_review'::public.moderation_source);
  return null;
end;
$function$;

revoke all on function private.ensure_pending_media_case_from_case()
from public,anon,authenticated;

drop trigger if exists media_assets_ensure_pending_moderation_case on public.media_assets;
create constraint trigger media_assets_ensure_pending_moderation_case
after insert or update of moderation_status,deleted_at,uploaded_at on public.media_assets
deferrable initially deferred
for each row
when (
  new.moderation_status='pending_review'::public.media_moderation_status
  and new.deleted_at is null
)
execute function private.ensure_pending_media_case_from_media();

drop trigger if exists moderation_cases_preserve_pending_media_case on public.moderation_cases;
create constraint trigger moderation_cases_preserve_pending_media_case
after insert or update of media_id,status or delete on public.moderation_cases
deferrable initially deferred
for each row
execute function private.ensure_pending_media_case_from_case();

-- Backfill any pending media that predates this invariant. The helper is idempotent and the
-- partial unique index guarantees one active case even if this migration is replayed locally.
do $block$
declare
  v_media_id uuid;
begin
  for v_media_id in
    select media.id
    from public.media_assets media
    where media.moderation_status='pending_review'::public.media_moderation_status
      and media.deleted_at is null
    order by media.created_at,media.id
  loop
    perform private.ensure_open_media_moderation_case(
      v_media_id,
      'admin_review'::public.moderation_source
    );
  end loop;
end;
$block$;
