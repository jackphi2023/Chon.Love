-- Chon.Love OPT-01 follow-up — retire the legacy discovery list from client execution.
-- Connect/Search V2 is the canonical discovery path and applies private.luxy_listing_hidden().
-- Keeping the old RPC client-executable would leave a parallel read path that predates
-- listing approval and could expose Free members before Admin approval.

revoke execute on function public.list_discovery_profiles(text,bigint,integer,integer)
from authenticated;

comment on function public.list_discovery_profiles(text,bigint,integer,integer) is
  'Legacy discovery read model retained for migration/history only. Client execution retired by OPT-01; Connect must use Search V2 so listing approval and paid override remain centralized.';
