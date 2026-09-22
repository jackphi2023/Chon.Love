-- SESSION B performance guard.
-- Keep the Search V2 recent index as the canonical copy and remove the older
-- identical discovery index. This does not change query semantics.
drop index if exists public.profiles_discovery_recent_idx;

-- OPT-01 added listing_reviewed_by as an auth.users FK. Give the FK a covering
-- index so admin-user deletion/review integrity checks do not require a table scan.
create index if not exists member_profile_verifications_listing_reviewed_by_idx
  on private.member_profile_verifications(listing_reviewed_by)
  where listing_reviewed_by is not null;
