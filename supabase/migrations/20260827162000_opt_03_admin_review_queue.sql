-- Chon.Love OPT-03 — Admin Review
-- Keep the Admin review surface aligned with the OPT-01 listing contract:
-- only active Free members that still require a human listing decision belong in the queue.
-- Premium/Diamond remain automatically discoverable after trusted signup verification and must
-- never create unnecessary manual work for Admin.

create or replace function public.admin_list_member_listing_verifications(
  p_actor_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  user_id uuid,
  public_profile_code text,
  username text,
  display_name text,
  listing_status text,
  listing_submitted_at timestamptz,
  membership_tier public.luxy_membership_tier,
  is_paid_override boolean,
  discovery_preference_enabled boolean,
  effective_discoverable boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_role private.user_role;
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
  v_offset integer:=least(greatest(coalesce(p_offset,0),0),5000);
begin
  v_role:=private.actor_role_for(
    p_actor_user_id,
    array['moderator'::private.user_role,'super_admin'::private.user_role]
  );

  return query
  select
    v.user_id,
    p.public_profile_code,
    p.username::text,
    p.display_name,
    v.listing_status,
    v.listing_submitted_at,
    private.get_active_luxy_membership_tier(p.id),
    false,
    p.discovery_enabled,
    false,
    v.updated_at
  from private.member_profile_verifications v
  join public.profiles p on p.id=v.user_id
  where v.listing_status='pending'
    and p.profile_status='active'::public.profile_status
    and p.deleted_at is null
    and not private.has_active_luxy_paid_membership(p.id)
  order by
    v.listing_submitted_at desc nulls last,
    v.updated_at desc,
    v.user_id
  limit v_limit
  offset v_offset;
end;
$function$;

revoke all on function public.admin_list_member_listing_verifications(uuid,integer,integer)
from public,anon,authenticated;
grant execute on function public.admin_list_member_listing_verifications(uuid,integer,integer)
to service_role;

comment on function public.admin_list_member_listing_verifications(uuid,integer,integer) is
  'OPT-03 manual listing review queue. Returns newest active Free pending members only; paid membership auto-approval stays outside the Admin queue.';
