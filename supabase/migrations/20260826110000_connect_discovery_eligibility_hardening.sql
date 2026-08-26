-- Fail closed for Connect/Search listing eligibility.
-- A member must be active and discoverable across Chon.Love-owned profile/account
-- state and must not have an unresolved signup photo-verification case. Diamond
-- hide-from-listing remains an additional privacy control after eligibility.

create or replace function private.luxy_listing_hidden(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when not exists (
        select 1
        from public.profiles p
        join private.user_identity i on i.user_id = p.id
        where p.id = p_user_id
          and p.profile_status = 'active'
          and p.deleted_at is null
          and p.discovery_enabled
          and i.account_status = 'active'
          and not exists (
            select 1
            from public.moderation_cases mc
            where mc.reported_user_id = p.id
              and 'member_photo_verification' = any(mc.rule_codes)
              and mc.status::text in ('open', 'queued', 'in_review')
          )
      ) then true
      when private.get_active_luxy_membership_tier(p_user_id) = 'diamond'
      then coalesce((
        select s.hide_from_listing
        from private.luxy_membership_privacy s
        where s.user_id = p_user_id
      ), false)
      else false
    end
$$;

comment on function private.luxy_listing_hidden(uuid) is
  'Returns true when a member must be excluded from Connect/Search due to inactive/hidden profile, inactive identity, unresolved signup photo verification, or Diamond hide-from-listing privacy.';
