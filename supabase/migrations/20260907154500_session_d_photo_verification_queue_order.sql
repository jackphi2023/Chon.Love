-- Session D repair — keep the Admin photo verification queue operationally safe.
--
-- The Admin surface requests a bounded page. New verification cases must therefore
-- appear on the first page; ordering oldest-first can hide fresh signups once the
-- queue grows beyond the page limit.

create or replace function public.admin_list_member_photo_verifications(
  p_actor_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  case_id uuid,
  user_id uuid,
  username text,
  display_name text,
  declared_gender text,
  profile_status text,
  case_status text,
  priority text,
  max_similarity numeric,
  automated_score_json jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_role private.user_role;
begin
  v_role := private.actor_role_for(
    p_actor_user_id,
    array['moderator'::private.user_role, 'super_admin'::private.user_role]
  );

  return query
  select
    mc.id,
    mc.reported_user_id,
    p.username::text,
    p.display_name::text,
    p.gender::text,
    p.profile_status::text,
    mc.status::text,
    mc.priority::text,
    nullif(mc.automated_score_json ->> 'maxSimilarity', '')::numeric,
    mc.automated_score_json,
    mc.created_at
  from public.moderation_cases mc
  join public.profiles p on p.id = mc.reported_user_id
  where 'member_photo_verification' = any(mc.rule_codes)
    and mc.status in (
      'open'::public.moderation_case_status,
      'queued'::public.moderation_case_status,
      'in_review'::public.moderation_case_status
    )
  order by mc.created_at desc, mc.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end
$function$;

revoke all on function public.admin_list_member_photo_verifications(uuid,integer,integer)
from public, anon, authenticated;
grant execute on function public.admin_list_member_photo_verifications(uuid,integer,integer)
to service_role;

comment on function public.admin_list_member_photo_verifications(uuid,integer,integer) is
  'Session D Admin photo-verification queue. Newest open cases first with stable id tie-breaker and bounded offset pagination.';
