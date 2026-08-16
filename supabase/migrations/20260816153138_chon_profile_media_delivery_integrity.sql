create or replace function private.enforce_approved_profile_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_avatar_valid boolean := false;
begin
  if new.avatar_media_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.media_assets m
    where m.id = new.avatar_media_id
      and m.owner_id = new.id
      and m.visibility = 'avatar'::public.media_visibility
      and m.moderation_status = 'approved'::public.media_moderation_status
      and m.deleted_at is null
      and m.uploaded_at is not null
  ) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.avatar_media_id is not null then
    select exists (
      select 1
      from public.media_assets m
      where m.id = old.avatar_media_id
        and m.owner_id = old.id
        and m.visibility = 'avatar'::public.media_visibility
        and m.moderation_status = 'approved'::public.media_moderation_status
        and m.deleted_at is null
        and m.uploaded_at is not null
    ) into v_old_avatar_valid;
  end if;

  new.avatar_media_id := case when v_old_avatar_valid then old.avatar_media_id else null end;
  return new;
end;
$function$;

drop trigger if exists profiles_enforce_approved_avatar on public.profiles;
create trigger profiles_enforce_approved_avatar
before insert or update of avatar_media_id on public.profiles
for each row execute function private.enforce_approved_profile_avatar();

update public.profiles p
set avatar_media_id = (
  select m.id
  from public.media_assets m
  where m.owner_id = p.id
    and m.visibility = 'avatar'::public.media_visibility
    and m.moderation_status = 'approved'::public.media_moderation_status
    and m.deleted_at is null
    and m.uploaded_at is not null
  order by m.approved_at desc nulls last, m.uploaded_at desc, m.created_at desc, m.id
  limit 1
)
where p.avatar_media_id is not null
  and not exists (
    select 1
    from public.media_assets current_avatar
    where current_avatar.id = p.avatar_media_id
      and current_avatar.owner_id = p.id
      and current_avatar.visibility = 'avatar'::public.media_visibility
      and current_avatar.moderation_status = 'approved'::public.media_moderation_status
      and current_avatar.deleted_at is null
      and current_avatar.uploaded_at is not null
  );

create or replace function private.can_view_media_internal(p_media_id uuid, p_viewer_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_media public.media_assets%rowtype;
begin
  if p_viewer_id is null then return false; end if;
  select m.* into v_media from public.media_assets m where m.id=p_media_id;
  if not found or v_media.deleted_at is not null or v_media.moderation_status='deleted' then return false; end if;

  if v_media.owner_id=p_viewer_id then
    return v_media.visibility<>'kyc'
      and v_media.moderation_status in ('pending_upload','pending_review','approved','rejected','quarantined');
  end if;

  -- Other members must never receive signed access to media that is still waiting
  -- for moderation. Public profile/avatar presentation is approved-only.
  if v_media.moderation_status <> 'approved'::public.media_moderation_status
     or v_media.uploaded_at is null then
    return false;
  end if;
  if private.users_are_blocked(v_media.owner_id,p_viewer_id) then return false; end if;
  if not private.is_active_adult(v_media.owner_id) or not private.is_active_adult(p_viewer_id) then return false; end if;

  if v_media.visibility='private' then return private.has_active_luxy_paid_membership(p_viewer_id); end if;
  if v_media.visibility='kyc' then return false; end if;
  if v_media.visibility='avatar' then
    return exists(
      select 1 from public.profiles p
      where p.id=v_media.owner_id
        and p.avatar_media_id=v_media.id
        and p.profile_status='active'
        and p.deleted_at is null
    );
  end if;
  if v_media.visibility='public' then
    return exists(
      select 1
      from public.album_media am
      join public.albums a on a.id=am.album_id
      where am.media_id=v_media.id
        and a.owner_id=v_media.owner_id
        and a.album_type='public'
        and a.is_active
        and a.deleted_at is null
    );
  end if;
  if v_media.visibility='fan' then
    return exists(
      select 1
      from public.album_media am
      join public.albums a on a.id=am.album_id
      where am.media_id=v_media.id
        and a.owner_id=v_media.owner_id
        and a.album_type='fan'
        and a.is_active
        and a.deleted_at is null
    ) and private.has_active_fan_membership(v_media.owner_id,p_viewer_id);
  end if;
  return false;
end;
$function$;
