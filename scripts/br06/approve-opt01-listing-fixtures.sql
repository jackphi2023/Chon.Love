begin;

-- BR-06 actors are established browser fixtures, not fresh Free signups.
-- Keep their Connect visibility explicit under the OPT-01 listing approval contract.
insert into private.member_profile_verifications(
  user_id,
  listing_status,
  listing_submitted_at,
  listing_reviewed_at,
  listing_reason_code
)
select
  u.id,
  'approved',
  now(),
  now(),
  'br06_browser_fixture'
from auth.users u
where u.email in (
  'br06.creator@example.test',
  'br06.viewer@example.test',
  'br06.fan@example.test',
  'br06.outsider@example.test',
  'br06.moderator@example.test'
)
on conflict(user_id) do update
set
  listing_status='approved',
  listing_submitted_at=coalesce(
    private.member_profile_verifications.listing_submitted_at,
    excluded.listing_submitted_at
  ),
  listing_reviewed_at=coalesce(
    private.member_profile_verifications.listing_reviewed_at,
    excluded.listing_reviewed_at
  ),
  listing_reason_code=coalesce(
    private.member_profile_verifications.listing_reason_code,
    excluded.listing_reason_code
  ),
  updated_at=now();

-- Session D Admin browser E2E uses the existing local-only moderator actor with an
-- additional super_admin role. This script is executed only after the localhost
-- guard in setup-local-fixtures.mjs and is never a production migration.
insert into private.user_roles(user_id, role, granted_by)
select u.id, 'super_admin'::private.user_role, u.id
from auth.users u
where u.email='br06.moderator@example.test'
on conflict do nothing;

commit;
