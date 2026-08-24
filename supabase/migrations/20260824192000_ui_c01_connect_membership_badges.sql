-- UI-C01: expose only the public-facing paid male membership badge signal used by Connect cards.
-- Keep Search V2 ranking/signature stable; this companion RPC batches one page of already visible profile ids.

create or replace function public.get_luxy_search_membership_badges(p_user_ids uuid[])
returns table(
  user_id uuid,
  badge_tier public.luxy_membership_tier
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_viewer_id uuid := (select auth.uid());
  v_count integer := coalesce(cardinality(p_user_ids), 0);
begin
  if v_viewer_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;

  if not private.is_active_adult(v_viewer_id) then
    raise exception using errcode = '42501', message = 'adult_onboarding_required';
  end if;

  if v_count > 40 then
    raise exception using errcode = '22023', message = 'membership_badge_batch_too_large';
  end if;

  return query
  select distinct
    p.id,
    membership.tier
  from unnest(coalesce(p_user_ids, '{}'::uuid[])) as requested(user_id)
  join public.profiles p
    on p.id = requested.user_id
   and p.profile_status = 'active'::public.profile_status
   and p.deleted_at is null
   and p.gender = 'male'::public.gender_identity
   and private.is_active_adult(p.id)
  cross join lateral (
    select private.get_active_luxy_membership_tier(p.id) as tier
  ) membership
  where membership.tier in ('premium'::public.luxy_membership_tier, 'diamond'::public.luxy_membership_tier)
    and not exists (
      select 1
      from public.user_blocks b
      where b.blocker_id = p.id
        and b.blocked_id = v_viewer_id
    );
end;
$function$;

revoke all on function public.get_luxy_search_membership_badges(uuid[]) from public, anon;
grant execute on function public.get_luxy_search_membership_badges(uuid[]) to authenticated, service_role;

comment on function public.get_luxy_search_membership_badges(uuid[]) is
  'UI-C01 batched Connect-card presentation signal. Returns only Premium/Diamond badge tiers for active adult male profiles that have not blocked the authenticated viewer; does not grant membership entitlements.';
