-- LX-14 policy correction (2026-08-12):
-- - FREE active members may add/remove Favorite / Interest.
-- - Sending text messages requires active Premium or Diamond.
-- - Requesting / viewing approved Private Photos continues to require active Premium or Diamond,
--   with explicit owner approval still mandatory.
-- - This migration is additive/corrective so the deployed migration history remains immutable.

-- Favorite / Interest is a FREE entitlement. Preserve safety, target-availability and block checks.
create or replace function public.set_profile_favorite(p_profile_id uuid,p_favorited boolean)
returns table(is_favorited boolean,is_favorited_by boolean,is_match boolean)
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reverse boolean := false;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;
  if p_profile_id is null or p_profile_id=v_user_id then raise exception using errcode='22023',message='invalid_favorite_target'; end if;
  if p_favorited is null then raise exception using errcode='22023',message='invalid_favorite_state'; end if;

  if p_favorited then
    if not private.is_active_adult(p_profile_id)
      or private.users_are_blocked(v_user_id,p_profile_id)
      or not exists(
        select 1
        from public.profiles p
        where p.id=p_profile_id
          and p.profile_status='active'
          and p.deleted_at is null
      ) then
      raise exception using errcode='42501',message='favorite_target_not_available';
    end if;

    insert into public.profile_favorites(owner_id,favorite_id)
    values(v_user_id,p_profile_id)
    on conflict(owner_id,favorite_id) do nothing;
  else
    delete from public.profile_favorites
    where owner_id=v_user_id and favorite_id=p_profile_id;
  end if;

  if not private.users_are_blocked(v_user_id,p_profile_id) then
    select exists(
      select 1
      from public.profile_favorites f
      where f.owner_id=p_profile_id and f.favorite_id=v_user_id
    ) into v_reverse;
  end if;

  return query select
    exists(
      select 1 from public.profile_favorites f
      where f.owner_id=v_user_id and f.favorite_id=p_profile_id
    ),
    v_reverse,
    exists(
      select 1
      from public.profile_favorites mine
      join public.profile_favorites theirs
        on theirs.owner_id=p_profile_id and theirs.favorite_id=v_user_id
      where mine.owner_id=v_user_id and mine.favorite_id=p_profile_id
    );
end;
$$;

-- Hard business gate for text-message insertion. The authenticated sender must still be paid
-- even if a client bypasses the Member Profile UI and calls send_message directly.
-- Trusted/server-authored gift/system inserts are intentionally left on their existing paths.
create or replace function private.validate_message_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_friendship public.friendships%rowtype;
  v_other_user uuid;
begin
  if not private.is_conversation_member(new.conversation_id,new.sender_id) then
    raise exception using errcode='42501',message='sender_not_conversation_member';
  end if;

  if new.message_type='text'::public.message_type
    and auth.uid() is not null
    and auth.uid()=new.sender_id
    and not private.has_active_luxy_paid_membership(new.sender_id) then
    raise exception using errcode='42501',message='premium_membership_required';
  end if;

  select f.* into v_friendship
  from public.conversations c
  join public.friendships f on f.id=c.friendship_id
  where c.id=new.conversation_id;

  if not found or v_friendship.status<>'accepted'::public.friendship_status then
    raise exception using errcode='42501',message='accepted_friendship_required';
  end if;

  v_other_user:=case
    when v_friendship.requester_id=new.sender_id then v_friendship.addressee_id
    else v_friendship.requester_id
  end;

  if private.users_are_blocked(new.sender_id,v_other_user) then
    raise exception using errcode='42501',message='messaging_blocked';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_message_insert() from public,anon,authenticated;

-- Present the corrected entitlements to every UI surface.
drop function public.get_my_luxy_membership_snapshot();
create function public.get_my_luxy_membership_snapshot()
returns table(
  tier public.luxy_membership_tier,
  can_message boolean,
  can_favorite boolean,
  can_request_private_photo boolean,
  status text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier public.luxy_membership_tier;
  v_paid boolean;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='adult_onboarding_required'; end if;

  v_tier:=private.get_active_luxy_membership_tier(v_user_id);
  v_paid:=v_tier in ('premium','diamond');

  return query
  select
    v_tier,
    private.can_message_with_luxy_membership(v_user_id),
    true,
    v_paid,
    case when v_tier='free' then 'free' else 'active' end,
    case when v_tier='free' then null else m.expires_at end
  from (select 1) seed
  left join private.luxy_memberships m
    on m.user_id=v_user_id
    and m.status='active'
    and m.tier=v_tier;
end;
$$;

revoke all on function public.get_my_luxy_membership_snapshot() from public,anon;
grant execute on function public.get_my_luxy_membership_snapshot() to authenticated,service_role;

comment on function public.set_profile_favorite(uuid,boolean) is
  'LX-14 corrected policy: Favorite/Interest is available to all active adult Luxy members, including FREE.';
comment on function public.get_my_luxy_membership_snapshot() is
  'LX-14 corrected entitlements: FREE can Favorite; Premium/Diamond are required for messaging and Private Photo requests.';
comment on function private.validate_message_insert() is
  'LX-14 hard gate: authenticated member-authored text messages require active Premium/Diamond; existing friendship/block rules remain enforced.';
