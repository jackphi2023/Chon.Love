create or replace function public.list_creator_activity(
  p_creator_username text,
  p_limit integer default 20,
  p_before_at timestamptz default null,
  p_before_id uuid default null
)
returns table(
  post_id uuid, creator_id uuid, username text, display_name text, is_verified boolean,
  avatar_media_id uuid, avatar_bucket text, avatar_path text, body text, content_type text,
  external_url text, external_provider text, external_video_id text, image_access_mode text,
  required_gift_id uuid, required_gift_name_vi text, required_gift_icon_emoji text,
  required_gift_hearts integer, required_gift_active boolean, moderation_status text,
  published_at timestamptz, created_at timestamptz, media_id uuid, preview_bucket text,
  preview_path text, preview_width integer, preview_height integer, original_bucket text,
  original_path text, original_width integer, original_height integer, is_owner boolean,
  is_unlocked boolean, unlock_status text, unlock_count bigint
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_viewer uuid := auth.uid();
  v_creator uuid;
  v_owner boolean;
  v_allowed boolean;
  v_limit integer := least(greatest(coalesce(p_limit,20),1),40);
begin
  select p.id into v_creator
  from public.profiles p
  where lower(p.username::text)=lower(btrim(p_creator_username))
    and p.deleted_at is null
  limit 1;

  if v_creator is null then return; end if;

  v_owner := coalesce(v_viewer = v_creator, false);
  v_allowed := private.can_view_creator_activity(v_creator,v_viewer);
  if not v_owner and not v_allowed then return; end if;

  return query
  select
    p.id,p.creator_id,pr.username::text,coalesce(pr.display_name,pr.username::text),true,
    pr.avatar_media_id,av.storage_bucket,av.storage_path,
    p.body,p.content_type::text,p.external_url,p.external_provider,p.external_video_id,
    'public'::text,null::uuid,null::text,null::text,null::integer,null::boolean,
    p.moderation_status::text,p.published_at,p.created_at,pm.media_id,
    case when v_owner and pm.preview_status='ready' then pm.preview_bucket end,
    case when v_owner and pm.preview_status='ready' then pm.preview_path end,
    case when v_owner and pm.preview_status='ready' then pm.preview_width end,
    case when v_owner and pm.preview_status='ready' then pm.preview_height end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved') then m.storage_bucket end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved') then m.storage_path end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved') then m.width end,
    case when v_owner or (p.moderation_status='approved' and m.moderation_status='approved') then m.height end,
    v_owner,(v_owner or v_allowed),case when v_owner or v_allowed then 'active'::text else 'none'::text end,0::bigint
  from public.creator_posts p
  join public.profiles pr on pr.id=p.creator_id
  left join public.media_assets av on av.id=pr.avatar_media_id and av.moderation_status='approved' and av.deleted_at is null
  left join public.creator_post_media pm on pm.post_id=p.id
  left join public.media_assets m on m.id=pm.media_id
  where p.creator_id=v_creator
    and p.deleted_at is null
    and (
      (v_owner and p.moderation_status<>'deleted')
      or (
        not v_owner
        and p.moderation_status='approved'
        and p.published_at is not null
        and (p.content_type<>'image' or (m.moderation_status='approved' and m.deleted_at is null))
      )
    )
    and (
      p_before_at is null
      or (coalesce(p.published_at,p.created_at),p.id)<(
        p_before_at,
        coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
      )
    )
  order by coalesce(p.published_at,p.created_at) desc,p.id desc
  limit v_limit;
end;
$function$;
