begin;

-- BR-09: privacy-safe runtime observability. Ingestion remains fail-closed until explicitly enabled.
insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('runtime_observability_ingest_enabled','false'::jsonb,'boolean','Allow authenticated clients to submit privacy-safe runtime observations.',false),
  ('runtime_observability_retention_days','30'::jsonb,'integer','Retention period for privacy-safe runtime observations.',false),
  ('runtime_observability_rate_limit_per_hour','120'::jsonb,'integer','Maximum runtime observations accepted per authenticated user per hour.',false)
on conflict (key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=false,
    updated_at=now();

create table if not exists private.runtime_observability_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'app_render_error','auth_restore_error','api_read_error','api_timeout','network_offline',
    'network_recovered','query_retry_exhausted','route_recovered','accessibility_fallback','circuit_opened'
  )),
  severity text not null check (severity in ('info','warning','error')),
  platform text not null check (platform in ('mobile_web','android','ios','admin_web','public_web','edge')),
  release_channel text not null check (release_channel in ('development','staging','beta','production')),
  route_group text not null check (route_group ~ '^[a-z0-9][a-z0-9_/-]{0,63}$'),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9][a-z0-9_/-]{0,63}$'),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 300000),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint runtime_observability_metadata_object check (jsonb_typeof(metadata_json)='object'),
  constraint runtime_observability_metadata_size check (pg_column_size(metadata_json)<=2048)
);

create index if not exists runtime_observability_created_idx
  on private.runtime_observability_events(created_at desc,id);
create index if not exists runtime_observability_event_created_idx
  on private.runtime_observability_events(event_name,severity,created_at desc);
create index if not exists runtime_observability_user_rate_idx
  on private.runtime_observability_events(user_id,created_at desc);

alter table private.runtime_observability_events enable row level security;
drop policy if exists runtime_observability_events_deny_direct_access on private.runtime_observability_events;
create policy runtime_observability_events_deny_direct_access
  on private.runtime_observability_events for all to public
  using (false) with check (false);

create or replace function private.sanitize_runtime_observability_metadata(p_metadata jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_key text;
  v_value jsonb;
  v_type text;
  v_allowed constant text[] := array[
    'attempt','network_state','http_status','feature','source','retryable','recovered',
    'query_key_hash','component'
  ];
begin
  if p_metadata is null then return '{}'::jsonb; end if;
  if jsonb_typeof(p_metadata)<>'object' then
    raise exception using errcode='22023',message='runtime_metadata_object_required';
  end if;
  if (select count(*) from jsonb_object_keys(p_metadata))>8 or pg_column_size(p_metadata)>2048 then
    raise exception using errcode='22023',message='runtime_metadata_too_large';
  end if;
  for v_key,v_value in select key,value from jsonb_each(p_metadata)
  loop
    if not (v_key=any(v_allowed)) then
      raise exception using errcode='22023',message='runtime_metadata_key_not_allowed';
    end if;
    if v_key ~* '(access|refresh|purchase)[_-]?token|password|email|phone|latitude|longitude|message|document|bank|legal[_-]?name|address' then
      raise exception using errcode='22023',message='runtime_metadata_sensitive_key_forbidden';
    end if;
    v_type:=jsonb_typeof(v_value);
    if v_type not in ('string','number','boolean','null') then
      raise exception using errcode='22023',message='runtime_metadata_primitive_required';
    end if;
    if v_type='string' and char_length(v_value#>>'{}')>120 then
      raise exception using errcode='22023',message='runtime_metadata_string_too_long';
    end if;
  end loop;
  return p_metadata;
end
$function$;

create or replace function private.prevent_runtime_observability_mutation()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op='DELETE' and current_setting('myfan.runtime_observability_purge',true)='on' then
    return old;
  end if;
  raise exception using errcode='42501',message='runtime_observability_events_are_immutable';
end
$function$;

drop trigger if exists runtime_observability_events_immutable on private.runtime_observability_events;
create trigger runtime_observability_events_immutable
before update or delete on private.runtime_observability_events
for each row execute function private.prevent_runtime_observability_mutation();

create or replace function public.record_runtime_observability_event(
  p_event_id uuid,
  p_event_name text,
  p_severity text,
  p_platform text,
  p_release_channel text,
  p_route_group text,
  p_error_code text default null,
  p_duration_ms integer default null,
  p_metadata_json jsonb default '{}'::jsonb
)
returns table(observation_id uuid,already_recorded boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_existing private.runtime_observability_events%rowtype;
  v_observation private.runtime_observability_events%rowtype;
  v_limit bigint:=coalesce(private.config_integer('runtime_observability_rate_limit_per_hour'),120);
  v_metadata jsonb;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if coalesce(private.config_boolean('runtime_observability_ingest_enabled'),false) is not true then
    raise exception using errcode='55000',message='runtime_observability_ingest_enabled_disabled';
  end if;
  if p_event_id is null then raise exception using errcode='22023',message='event_id_required'; end if;

  select * into v_existing from private.runtime_observability_events where event_id=p_event_id;
  if found then
    if v_existing.user_id is distinct from v_user_id then
      raise exception using errcode='23505',message='runtime_event_id_conflict';
    end if;
    return query select v_existing.id,true;
    return;
  end if;

  if (select count(*) from private.runtime_observability_events e
      where e.user_id=v_user_id and e.created_at>=now()-interval '1 hour')>=greatest(v_limit,1) then
    raise exception using errcode='54000',message='runtime_observability_rate_limit_exceeded';
  end if;

  if p_event_name not in (
    'app_render_error','auth_restore_error','api_read_error','api_timeout','network_offline',
    'network_recovered','query_retry_exhausted','route_recovered','accessibility_fallback','circuit_opened'
  ) then raise exception using errcode='22023',message='invalid_runtime_event_name'; end if;
  if p_severity not in ('info','warning','error') then raise exception using errcode='22023',message='invalid_runtime_severity'; end if;
  if p_platform not in ('mobile_web','android','ios','admin_web','public_web','edge') then raise exception using errcode='22023',message='invalid_runtime_platform'; end if;
  if p_release_channel not in ('development','staging','beta','production') then raise exception using errcode='22023',message='invalid_runtime_release_channel'; end if;
  if p_route_group is null or p_route_group !~ '^[a-z0-9][a-z0-9_/-]{0,63}$' then raise exception using errcode='22023',message='invalid_runtime_route_group'; end if;
  if p_error_code is not null and p_error_code !~ '^[a-z0-9][a-z0-9_/-]{0,63}$' then raise exception using errcode='22023',message='invalid_runtime_error_code'; end if;
  if p_duration_ms is not null and p_duration_ms not between 0 and 300000 then raise exception using errcode='22023',message='invalid_runtime_duration'; end if;

  v_metadata:=private.sanitize_runtime_observability_metadata(p_metadata_json);
  insert into private.runtime_observability_events(
    event_id,user_id,event_name,severity,platform,release_channel,route_group,error_code,duration_ms,metadata_json
  ) values(
    p_event_id,v_user_id,p_event_name,p_severity,p_platform,p_release_channel,p_route_group,
    nullif(p_error_code,''),p_duration_ms,v_metadata
  ) returning * into v_observation;
  return query select v_observation.id,false;
end
$function$;

create or replace function public.admin_runtime_observability_snapshot(
  p_actor_user_id uuid,
  p_window_minutes integer default 60
)
returns table(
  event_name text,
  severity text,
  event_count bigint,
  affected_users bigint,
  retryable_count bigint,
  latest_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.actor_role_for(p_actor_user_id,array['super_admin']::private.user_role[]);
  if p_window_minutes not between 5 and 1440 then
    raise exception using errcode='22023',message='invalid_observability_window';
  end if;
  return query
  select e.event_name,e.severity,count(*),count(distinct e.user_id),
    count(*) filter(where e.metadata_json->>'retryable'='true'),max(e.created_at)
  from private.runtime_observability_events e
  where e.created_at>=now()-make_interval(mins=>p_window_minutes)
  group by e.event_name,e.severity
  order by count(*) desc,e.event_name,e.severity;
end
$function$;

create or replace function public.purge_expired_runtime_observability_events(p_batch_size integer default 10000)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_retention_days bigint:=coalesce(private.config_integer('runtime_observability_retention_days'),30);
  v_deleted integer;
begin
  if p_batch_size not between 1 and 50000 then
    raise exception using errcode='22023',message='invalid_purge_batch_size';
  end if;
  perform set_config('myfan.runtime_observability_purge','on',true);
  with candidates as (
    select id from private.runtime_observability_events
    where created_at<now()-make_interval(days=>greatest(v_retention_days,1)::integer)
    order by created_at,id
    limit p_batch_size
  )
  delete from private.runtime_observability_events e using candidates c where e.id=c.id;
  get diagnostics v_deleted=row_count;
  return v_deleted;
end
$function$;

revoke all on table private.runtime_observability_events from public,anon,authenticated;
revoke all on function private.sanitize_runtime_observability_metadata(jsonb) from public,anon,authenticated;
revoke all on function private.prevent_runtime_observability_mutation() from public,anon,authenticated;
revoke all on function public.record_runtime_observability_event(uuid,text,text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.admin_runtime_observability_snapshot(uuid,integer) from public,anon,authenticated;
revoke all on function public.purge_expired_runtime_observability_events(integer) from public,anon,authenticated;
grant execute on function public.record_runtime_observability_event(uuid,text,text,text,text,text,text,integer,jsonb) to authenticated,service_role;
grant execute on function public.admin_runtime_observability_snapshot(uuid,integer) to service_role;
grant execute on function public.purge_expired_runtime_observability_events(integer) to service_role;

commit;
