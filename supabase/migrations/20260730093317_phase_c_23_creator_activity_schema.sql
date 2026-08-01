create type public.creator_activity_content_type as enum ('text','image','video');
create type public.creator_activity_image_access_mode as enum ('public','gift_locked');
create type public.creator_activity_moderation_status as enum ('draft','pending_review','approved','rejected','archived','deleted');
create type public.creator_activity_preview_status as enum ('pending','ready','failed');
create type private.creator_activity_unlock_status as enum ('active','revoked','refunded','fraud_hold');

create table public.creator_posts (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  content_type public.creator_activity_content_type not null,
  external_url text,
  external_provider text,
  external_video_id text,
  external_metadata jsonb not null default '{}'::jsonb,
  image_access_mode public.creator_activity_image_access_mode not null default 'public',
  required_gift_id uuid references public.gift_catalog(id) on delete restrict,
  required_gift_units_snapshot bigint,
  moderation_status public.creator_activity_moderation_status not null default 'pending_review',
  moderation_reason_code text,
  published_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  constraint creator_posts_body_length check (char_length(btrim(body)) between 1 and 3000),
  constraint creator_posts_external_metadata_object check (jsonb_typeof(external_metadata)='object'),
  constraint creator_posts_content_shape check (
    (content_type='text' and external_url is null and external_provider is null and external_video_id is null and image_access_mode='public' and required_gift_id is null and required_gift_units_snapshot is null)
    or (content_type='image' and external_url is null and external_provider is null and external_video_id is null and ((image_access_mode='public' and required_gift_id is null and required_gift_units_snapshot is null) or (image_access_mode='gift_locked' and required_gift_id is not null and required_gift_units_snapshot>0)))
    or (content_type='video' and external_url is not null and external_provider in ('youtube','of_tv') and image_access_mode='public' and required_gift_id is null and required_gift_units_snapshot is null)
  ),
  constraint creator_posts_https_link check (external_url is null or external_url ~ '^https://'),
  constraint creator_posts_video_id_pair check ((external_provider='youtube' and external_video_id is not null) or (external_provider='of_tv' and external_video_id is null) or external_provider is null),
  constraint creator_posts_moderation_timestamps check (
    (moderation_status='approved' and published_at is not null and deleted_at is null)
    or (moderation_status='archived' and archived_at is not null and deleted_at is null)
    or (moderation_status='deleted' and deleted_at is not null)
    or moderation_status in ('draft','pending_review','rejected')
  )
);

create table public.creator_post_media (
  post_id uuid primary key references public.creator_posts(id) on delete cascade,
  media_id uuid not null unique references public.media_assets(id) on delete restrict,
  sort_order integer not null default 0,
  preview_bucket text not null default 'activity-previews',
  preview_path text,
  preview_width integer,
  preview_height integer,
  preview_status public.creator_activity_preview_status not null default 'pending',
  preview_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_post_media_single_position check (sort_order=0),
  constraint creator_post_media_preview_pair check ((preview_status='ready' and preview_path is not null and preview_width>0 and preview_height>0) or preview_status in ('pending','failed'))
);

create table private.creator_post_unlocks (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.creator_posts(id) on delete restrict,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  gift_transaction_id uuid not null unique references public.gift_transactions(id) on delete restrict,
  required_gift_id uuid not null references public.gift_catalog(id) on delete restrict,
  gift_units_snapshot bigint not null,
  status private.creator_activity_unlock_status not null default 'active',
  unlocked_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_post_unlocks_one_per_viewer unique(post_id,viewer_id),
  constraint creator_post_unlocks_not_self check (viewer_id<>creator_id),
  constraint creator_post_unlocks_units_positive check (gift_units_snapshot>0),
  constraint creator_post_unlocks_revocation_pair check ((status='active' and revoked_at is null) or (status<>'active' and revoked_at is not null))
);

create table private.creator_post_unlock_events (
  id bigint generated always as identity primary key,
  unlock_id uuid not null references private.creator_post_unlocks(id) on delete cascade,
  post_id uuid not null references public.creator_posts(id) on delete restrict,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  gift_transaction_id uuid not null references public.gift_transactions(id) on delete restrict,
  event_type text not null check (event_type in ('unlocked','revoked','refunded','fraud_hold','reactivated')),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json)='object'),
  created_at timestamptz not null default now()
);

alter table public.gift_transactions add column unlock_target_type text;
alter table public.gift_transactions add column unlock_target_id uuid references public.creator_posts(id) on delete restrict;
alter table public.gift_transactions add constraint gift_transactions_unlock_target_pair check ((unlock_target_type is null and unlock_target_id is null) or (unlock_target_type='creator_post' and unlock_target_id is not null));

create index creator_posts_creator_feed_idx on public.creator_posts(creator_id,coalesce(published_at,created_at) desc,id desc) where deleted_at is null;
create index creator_posts_moderation_queue_idx on public.creator_posts(moderation_status,submitted_at,id) where deleted_at is null;
create index creator_post_media_media_idx on public.creator_post_media(media_id);
create index creator_post_unlocks_viewer_status_idx on private.creator_post_unlocks(viewer_id,status,updated_at desc);
create index creator_post_unlocks_post_status_idx on private.creator_post_unlocks(post_id,status);
create index creator_post_unlock_events_post_idx on private.creator_post_unlock_events(post_id,created_at desc);
create index gift_transactions_unlock_target_idx on public.gift_transactions(unlock_target_type,unlock_target_id,sender_id) where unlock_target_id is not null;

create trigger creator_posts_set_updated_at before update on public.creator_posts for each row execute function private.set_updated_at();
create trigger creator_post_media_set_updated_at before update on public.creator_post_media for each row execute function private.set_updated_at();
create trigger creator_post_unlocks_set_updated_at before update on private.creator_post_unlocks for each row execute function private.set_updated_at();

alter table public.creator_posts enable row level security;
alter table public.creator_post_media enable row level security;
alter table private.creator_post_unlocks enable row level security;
alter table private.creator_post_unlock_events enable row level security;
revoke all on public.creator_posts,public.creator_post_media from public,anon,authenticated;
revoke all on private.creator_post_unlocks,private.creator_post_unlock_events from public,anon,authenticated;
grant select,insert,update,delete on public.creator_posts,public.creator_post_media to service_role;
grant select,insert,update,delete on private.creator_post_unlocks,private.creator_post_unlock_events to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('activity-previews','activity-previews',false,1048576,array['image/png','image/webp','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into private.app_config(key,value_json,value_type,description,is_public) values
('creator_activity_text_max','3000'::jsonb,'integer','Maximum Creator activity body length in Unicode characters.',true),
('creator_activity_image_max','1'::jsonb,'integer','V1 maximum images attached to one Creator activity post.',true),
('creator_activity_video_max','1'::jsonb,'integer','V1 maximum allowlisted video links attached to one Creator activity post.',true),
('creator_activity_signed_url_seconds','30'::jsonb,'integer','Short-lived signed URL duration for Creator activity media.',true)
on conflict(key) do update set value_json=excluded.value_json,value_type=excluded.value_type,description=excluded.description,is_public=excluded.is_public,updated_at=now();

comment on table public.creator_posts is 'Moderated Creator activity posts. V1 permits text, text plus exactly one image, or text plus one allowlisted video link.';
comment on table public.creator_post_media is 'One-image-only V1 post media mapping with a server-generated safe blurred preview.';
comment on table private.creator_post_unlocks is 'Server-only per-viewer, per-post gift unlock entitlements.';
comment on column public.gift_transactions.unlock_target_id is 'Creator post unlocked by this transaction when unlock_target_type=creator_post.';
