-- SESSION B Connect eligibility hardening.
-- One centralized helper is consumed by canonical Search V2 + Count V2.
-- Direct Profile routes intentionally use private.is_chon_public_profile_allowed()
-- and therefore remain independent from Connect discovery eligibility.
create or replace function private.luxy_listing_hidden(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    -- Admin moderation always wins, including for active paid memberships.
    coalesce((
      select moderation.admin_hidden
      from private.chon_public_profile_moderation moderation
      where moderation.user_id=p_user_id
    ),false)
    or
    -- A Connect card must have one current, approved, public avatar that can be
    -- resolved without exposing pending moderation media.
    not exists(
      select 1
      from public.profiles profile
      join public.media_assets media
        on media.id=profile.avatar_media_id
       and media.owner_id=profile.id
       and media.visibility='avatar'::public.media_visibility
       and media.moderation_status='approved'::public.media_moderation_status
       and media.deleted_at is null
       and media.uploaded_at is not null
      where profile.id=p_user_id
    )
    or
    case
      -- Active Premium/Diamond bypass manual listing approval, but never the
      -- admin-hidden or approved-avatar gates above.
      when private.has_active_luxy_paid_membership(p_user_id) then
        case
          when private.get_active_luxy_membership_tier(p_user_id)='diamond'
          then coalesce((
            select privacy.hide_from_listing
            from private.luxy_membership_privacy privacy
            where privacy.user_id=p_user_id
          ),false)
          else false
        end
      -- Free members require an explicit Admin listing approval.
      when coalesce((
        select verification.listing_status
        from private.member_profile_verifications verification
        where verification.user_id=p_user_id
      ),'not_started')<>'approved' then true
      else false
    end
$$;

revoke all on function private.luxy_listing_hidden(uuid) from public,anon,authenticated;
grant execute on function private.luxy_listing_hidden(uuid) to service_role;

comment on function private.luxy_listing_hidden(uuid) is
  'SESSION B canonical Connect gate: admin hidden always excluded; current avatar must be approved; Free requires listing approval; active Premium/Diamond bypass manual approval only; Diamond hide-from-listing remains authoritative. Direct Profile availability is separate.';
