-- BR-01: make the RPC-only access model explicit and reproducible.
-- These tables are intentionally not queried directly by anon/authenticated clients.

revoke all on table public.creator_posts from anon, authenticated;
revoke all on table public.creator_post_media from anon, authenticated;
revoke all on table private.creator_post_unlocks from anon, authenticated;
revoke all on table private.creator_post_unlock_events from anon, authenticated;
revoke all on table private.message_user_hides from anon, authenticated;
revoke all on table private.vietqr_payment_orders from anon, authenticated;

drop policy if exists creator_posts_deny_direct_client_access on public.creator_posts;
create policy creator_posts_deny_direct_client_access
on public.creator_posts
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists creator_post_media_deny_direct_client_access on public.creator_post_media;
create policy creator_post_media_deny_direct_client_access
on public.creator_post_media
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists creator_post_unlocks_deny_direct_client_access on private.creator_post_unlocks;
create policy creator_post_unlocks_deny_direct_client_access
on private.creator_post_unlocks
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists creator_post_unlock_events_deny_direct_client_access on private.creator_post_unlock_events;
create policy creator_post_unlock_events_deny_direct_client_access
on private.creator_post_unlock_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists message_user_hides_deny_direct_client_access on private.message_user_hides;
create policy message_user_hides_deny_direct_client_access
on private.message_user_hides
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists vietqr_payment_orders_deny_direct_client_access on private.vietqr_payment_orders;
create policy vietqr_payment_orders_deny_direct_client_access
on private.vietqr_payment_orders
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

comment on table public.creator_posts is
  'RPC-only Creator Activity source table. Direct anon/authenticated access is explicitly denied; approved access is served through bounded RPCs.';
comment on table public.creator_post_media is
  'RPC-only Creator Activity media link table. Direct anon/authenticated access is explicitly denied.';
comment on table private.creator_post_unlocks is
  'Internal legacy unlock state retained for migration history. Direct client access is explicitly denied.';
comment on table private.creator_post_unlock_events is
  'Internal legacy unlock audit state retained for migration history. Direct client access is explicitly denied.';
comment on table private.message_user_hides is
  'Internal per-user message hide state. Direct client access is explicitly denied and exposed only through bounded RPCs.';
comment on table private.vietqr_payment_orders is
  'Internal VietQR order state. Direct client access is explicitly denied; owner reads and service settlement use bounded RPCs.';

-- One-time beta transport used pg_net temporarily; the final product schema must not depend on it.
drop extension if exists pg_net;
