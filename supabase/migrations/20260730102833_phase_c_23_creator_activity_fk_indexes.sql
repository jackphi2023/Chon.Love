create index if not exists creator_posts_required_gift_idx
  on public.creator_posts(required_gift_id)
  where required_gift_id is not null;

create index if not exists creator_post_unlocks_creator_idx
  on private.creator_post_unlocks(creator_id);

create index if not exists creator_post_unlocks_required_gift_idx
  on private.creator_post_unlocks(required_gift_id);

create index if not exists creator_post_unlock_events_unlock_idx
  on private.creator_post_unlock_events(unlock_id);

create index if not exists creator_post_unlock_events_viewer_idx
  on private.creator_post_unlock_events(viewer_id);

create index if not exists creator_post_unlock_events_gift_transaction_idx
  on private.creator_post_unlock_events(gift_transaction_id);

create index if not exists gift_transactions_unlock_target_id_idx
  on public.gift_transactions(unlock_target_id)
  where unlock_target_id is not null;
