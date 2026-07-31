create or replace function public.report_creator_activity(
  p_post_id uuid,
  p_media_id uuid default null::uuid,
  p_target_kind text default 'post'::text,
  p_reason_code text default 'other'::text,
  p_description text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_reporter uuid := auth.uid();
  v_post public.creator_posts;
  v_report_id uuid;
begin
  if v_reporter is null or not private.is_active_adult(v_reporter) then
    raise exception using errcode='42501', message='active_adult_reporter_required';
  end if;
  if p_target_kind not in ('post','image','external_link') then
    raise exception using errcode='22023', message='invalid_activity_report_target';
  end if;
  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception using errcode='22023', message='invalid_report_reason';
  end if;
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception using errcode='22023', message='report_description_too_long';
  end if;

  select p.* into v_post
  from public.creator_posts p
  where p.id = p_post_id
    and p.moderation_status = 'approved'::public.creator_activity_moderation_status
    and p.published_at is not null
    and p.deleted_at is null;

  if not found
     or v_post.creator_id = v_reporter
     or not private.can_view_creator_activity(v_post.creator_id, v_reporter)
  then
    raise exception using errcode='42501', message='activity_report_target_not_available';
  end if;

  if p_target_kind = 'image' then
    if p_media_id is null or not exists(
      select 1
      from public.creator_post_media pm
      join public.media_assets m on m.id = pm.media_id
      where pm.post_id = v_post.id
        and pm.media_id = p_media_id
        and m.moderation_status = 'approved'::public.media_moderation_status
        and m.deleted_at is null
    ) then
      raise exception using errcode='22023', message='activity_report_media_mismatch';
    end if;
  elsif p_media_id is not null then
    raise exception using errcode='22023', message='activity_report_media_not_expected';
  end if;

  if p_target_kind = 'external_link' and v_post.content_type <> 'video'::public.creator_activity_content_type then
    raise exception using errcode='22023', message='activity_report_link_not_available';
  end if;

  if exists(
    select 1
    from public.reports r
    where r.reporter_id = v_reporter
      and (
        (p_target_kind = 'image' and r.target_media_id = p_media_id)
        or (p_target_kind <> 'image' and r.target_creator_post_id = v_post.id)
      )
      and r.created_at > now() - interval '60 seconds'
  ) then
    raise exception using errcode='42901', message='report_rate_limited';
  end if;

  insert into public.reports(
    reporter_id,
    target_media_id,
    target_creator_post_id,
    reason_code,
    description,
    evidence_json
  ) values (
    v_reporter,
    case when p_target_kind = 'image' then p_media_id else null end,
    case when p_target_kind <> 'image' then v_post.id else null end,
    p_reason_code,
    nullif(btrim(p_description), ''),
    jsonb_build_object(
      'creator_post_id', v_post.id,
      'target_kind', p_target_kind,
      'external_provider', v_post.external_provider
    )
  ) returning id into v_report_id;

  return v_report_id;
end;
$function$;
