create index if not exists creator_profiles_activity_visibility_idx
  on public.creator_profiles(activity_visibility,user_id)
  where creator_status='approved' and approved_at is not null;

create index if not exists fan_memberships_active_access_idx
  on public.fan_memberships(creator_id,fan_user_id)
  where status='active';

create index if not exists friendships_accepted_pair_idx
  on public.friendships(pair_low_id,pair_high_id)
  where status='accepted';
