create index if not exists creator_posts_public_highlights_idx
  on public.creator_posts (published_at desc, id desc)
  where moderation_status = 'approved'::public.creator_activity_moderation_status
    and published_at is not null
    and deleted_at is null;

create or replace function private.can_read_public_creator_avatar_object(
  p_bucket text,
  p_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.creator_profiles cp on cp.user_id = p.id
    join public.media_assets m on m.id = p.avatar_media_id
    where m.storage_bucket = p_bucket
      and m.storage_path = p_name
      and m.owner_id = p.id
      and m.media_type = 'image'::public.media_type
      and m.visibility = 'avatar'::public.media_visibility
      and m.moderation_status = 'approved'::public.media_moderation_status
      and m.deleted_at is null
      and p.profile_status = 'active'::public.profile_status
      and p.deleted_at is null
      and private.is_active_adult(p.id)
      and cp.creator_status = 'approved'::public.creator_status
      and cp.approved_at is not null
      and cp.suspended_at is null
  );
$$;

revoke all on function private.can_read_public_creator_avatar_object(text,text) from public;
grant execute on function private.can_read_public_creator_avatar_object(text,text)
  to anon, authenticated, service_role;

drop policy if exists public_creator_avatar_read on storage.objects;
create policy public_creator_avatar_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id in ('profile-media','pending-media')
  and private.can_read_public_creator_avatar_object(bucket_id, name)
);

create or replace function public.list_public_featured_creators(
  p_limit integer default 6
)
returns table(
  creator_id uuid,
  username text,
  display_name text,
  creator_bio text,
  avatar_media_id uuid,
  avatar_bucket text,
  avatar_path text,
  public_activity_count bigint,
  latest_activity_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username::text,
    coalesce(nullif(btrim(p.display_name), ''), p.username::text),
    nullif(btrim(cp.creator_bio), ''),
    case when avatar.id is not null then avatar.id end,
    case when avatar.id is not null then avatar.storage_bucket end,
    case when avatar.id is not null then avatar.storage_path end,
    activity.public_activity_count,
    activity.latest_activity_at
  from public.profiles p
  join public.creator_profiles cp on cp.user_id = p.id
  join lateral (
    select
      count(*)::bigint as public_activity_count,
      max(post.published_at) as latest_activity_at
    from public.creator_posts post
    where post.creator_id = p.id
      and post.moderation_status = 'approved'::public.creator_activity_moderation_status
      and post.published_at is not null
      and post.deleted_at is null
  ) activity on true
  left join public.media_assets avatar
    on avatar.id = p.avatar_media_id
   and avatar.owner_id = p.id
   and avatar.media_type = 'image'::public.media_type
   and avatar.visibility = 'avatar'::public.media_visibility
   and avatar.moderation_status = 'approved'::public.media_moderation_status
   and avatar.deleted_at is null
  where p.profile_status = 'active'::public.profile_status
    and p.deleted_at is null
    and private.is_active_adult(p.id)
    and cp.creator_status = 'approved'::public.creator_status
    and cp.approved_at is not null
    and cp.suspended_at is null
    and cp.activity_visibility = 'public'::public.creator_activity_visibility
    and activity.public_activity_count > 0
  order by activity.latest_activity_at desc nulls last, cp.approved_at desc, p.id
  limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;

create or replace function public.list_public_activity_highlights(
  p_limit integer default 6
)
returns table(
  post_id uuid,
  creator_id uuid,
  username text,
  display_name text,
  avatar_media_id uuid,
  avatar_bucket text,
  avatar_path text,
  body text,
  content_type text,
  external_url text,
  external_provider text,
  external_video_id text,
  published_at timestamptz,
  media_id uuid,
  media_bucket text,
  media_path text,
  media_width integer,
  media_height integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    post.id,
    post.creator_id,
    p.username::text,
    coalesce(nullif(btrim(p.display_name), ''), p.username::text),
    case when avatar.id is not null then avatar.id end,
    case when avatar.id is not null then avatar.storage_bucket end,
    case when avatar.id is not null then avatar.storage_path end,
    post.body,
    post.content_type::text,
    post.external_url,
    post.external_provider,
    post.external_video_id,
    post.published_at,
    case when media.id is not null then media.id end,
    case when media.id is not null then media.storage_bucket end,
    case when media.id is not null then media.storage_path end,
    case when media.id is not null then media.width end,
    case when media.id is not null then media.height end
  from public.creator_posts post
  join public.profiles p on p.id = post.creator_id
  join public.creator_profiles cp on cp.user_id = post.creator_id
  left join public.creator_post_media post_media on post_media.post_id = post.id
  left join public.media_assets media
    on media.id = post_media.media_id
   and media.owner_id = post.creator_id
   and media.media_type = 'image'::public.media_type
   and media.moderation_status = 'approved'::public.media_moderation_status
   and media.deleted_at is null
  left join public.media_assets avatar
    on avatar.id = p.avatar_media_id
   and avatar.owner_id = p.id
   and avatar.media_type = 'image'::public.media_type
   and avatar.visibility = 'avatar'::public.media_visibility
   and avatar.moderation_status = 'approved'::public.media_moderation_status
   and avatar.deleted_at is null
  where post.moderation_status = 'approved'::public.creator_activity_moderation_status
    and post.published_at is not null
    and post.deleted_at is null
    and (
      post.content_type <> 'image'::public.creator_activity_content_type
      or media.id is not null
    )
    and p.profile_status = 'active'::public.profile_status
    and p.deleted_at is null
    and private.is_active_adult(p.id)
    and cp.creator_status = 'approved'::public.creator_status
    and cp.approved_at is not null
    and cp.suspended_at is null
    and cp.activity_visibility = 'public'::public.creator_activity_visibility
  order by post.published_at desc, post.id desc
  limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;

revoke all on function public.list_public_featured_creators(integer) from public;
revoke all on function public.list_public_activity_highlights(integer) from public;
grant execute on function public.list_public_featured_creators(integer)
  to anon, authenticated, service_role;
grant execute on function public.list_public_activity_highlights(integer)
  to anon, authenticated, service_role;

comment on function public.list_public_featured_creators(integer) is
  'Public-safe homepage Creator cards. Only active adult approved Creators with public approved Activity are returned; avatar paths are included only for approved avatar media.';
comment on function public.list_public_activity_highlights(integer) is
  'Public-safe latest Creator Activity for the homepage. Only approved posts owned by active adult approved Creators whose Activity visibility is public are returned.';
comment on function private.can_read_public_creator_avatar_object(text,text) is
  'Storage authorization for an approved avatar belonging to an active adult approved Creator.';
