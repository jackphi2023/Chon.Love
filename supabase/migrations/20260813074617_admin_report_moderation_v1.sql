create or replace function public.admin_list_luxy_reports(
  p_actor_user_id uuid,
  p_status text default null,
  p_priority text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  report_id uuid,
  reporter_id uuid,
  reporter_username text,
  reporter_display_name text,
  target_user_id uuid,
  target_username text,
  target_display_name text,
  target_media_id uuid,
  target_message_id uuid,
  reason_code text,
  description text,
  status public.report_status,
  priority public.report_priority,
  assigned_to uuid,
  resolution_code text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_status text := nullif(lower(btrim(coalesce(p_status,''))), '');
  v_priority text := nullif(lower(btrim(coalesce(p_priority,''))), '');
begin
  perform private.actor_role_for(p_actor_user_id, array['moderator','super_admin']::private.user_role[]);
  if p_limit not between 1 and 200 or p_offset < 0 then raise exception using errcode='22023',message='invalid_pagination'; end if;
  if v_status is not null and v_status not in ('submitted','triaged','in_review','resolved','dismissed') then raise exception using errcode='22023',message='invalid_report_status'; end if;
  if v_priority is not null and v_priority not in ('low','normal','high','urgent') then raise exception using errcode='22023',message='invalid_report_priority'; end if;

  return query
  select
    r.id,
    r.reporter_id,
    rp.username::text,
    rp.display_name,
    r.target_user_id,
    tp.username::text,
    tp.display_name,
    r.target_media_id,
    r.target_message_id,
    r.reason_code,
    r.description,
    r.status,
    r.priority,
    r.assigned_to,
    r.resolution_code,
    r.created_at,
    r.updated_at,
    count(*) over()
  from public.reports r
  join public.profiles rp on rp.id=r.reporter_id
  left join public.profiles tp on tp.id=r.target_user_id
  where (v_status is null or r.status::text=v_status)
    and (v_priority is null or r.priority::text=v_priority)
  order by
    case r.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
    case r.status when 'submitted' then 0 when 'triaged' then 1 when 'in_review' then 2 else 3 end,
    r.created_at,
    r.id
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_review_luxy_report(
  p_actor_user_id uuid,
  p_report_id uuid,
  p_action text,
  p_resolution_code text,
  p_request_id uuid
)
returns public.report_status
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor_role private.user_role;
  v_action text := lower(btrim(coalesce(p_action,'')));
  v_resolution text := nullif(lower(btrim(coalesce(p_resolution_code,''))), '');
  v_before jsonb;
  v_after jsonb;
  v_status public.report_status;
begin
  v_actor_role := private.actor_role_for(p_actor_user_id,array['moderator','super_admin']::private.user_role[]);
  if v_action not in ('start_review','resolve','dismiss') then raise exception using errcode='22023',message='invalid_report_admin_action'; end if;
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  if v_action in ('resolve','dismiss') and (v_resolution is null or v_resolution !~ '^[a-z][a-z0-9_]{1,63}$') then
    raise exception using errcode='22023',message='resolution_code_required';
  end if;

  select to_jsonb(r) into v_before from public.reports r where r.id=p_report_id for update;
  if v_before is null then raise exception using errcode='P0002',message='report_not_found'; end if;

  if v_action='start_review' then
    update public.reports
      set status='in_review'::public.report_status,assigned_to=p_actor_user_id,updated_at=now()
      where id=p_report_id and status not in ('resolved','dismissed');
  elsif v_action='resolve' then
    update public.reports
      set status='resolved'::public.report_status,assigned_to=coalesce(assigned_to,p_actor_user_id),resolution_code=v_resolution,resolved_at=now(),updated_at=now()
      where id=p_report_id;
  else
    update public.reports
      set status='dismissed'::public.report_status,assigned_to=coalesce(assigned_to,p_actor_user_id),resolution_code=v_resolution,resolved_at=now(),updated_at=now()
      where id=p_report_id;
  end if;

  select to_jsonb(r),r.status into v_after,v_status from public.reports r where r.id=p_report_id;
  perform private.append_admin_audit(
    p_actor_user_id,v_actor_role,'luxy_report_'||v_action,'report',p_report_id,
    v_before,v_after,coalesce(v_resolution,v_action),p_request_id,null,null
  );
  return v_status;
end;
$$;

revoke all on function public.admin_list_luxy_reports(uuid,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_review_luxy_report(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_list_luxy_reports(uuid,text,text,integer,integer) to service_role;
grant execute on function public.admin_review_luxy_report(uuid,uuid,text,text,uuid) to service_role;
