-- Luxy.Love signup selfie verification gate.
-- New member profiles must pass live-selfie/profile-photo comparison or remain pending_review.
-- Existing active profiles are grandfathered and are not forced back through this flow.

create or replace function private.is_profile_setup_adult(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join private.user_identity i on i.user_id = p.id
    where p.id = p_user_id
      and p.profile_status in ('incomplete'::public.profile_status, 'pending_review'::public.profile_status)
      and p.deleted_at is null
      and i.account_status = 'active'::private.account_status
      and i.age_verified_at is not null
      and i.date_of_birth <= (current_date - interval '18 years')::date
      and i.terms_accepted_at is not null
      and i.community_rules_accepted_at is not null
  )
$$;

revoke all on function private.is_profile_setup_adult(uuid) from public, anon, authenticated;

-- Allow an adult who has completed legal onboarding to upload the profile photos
-- needed for selfie comparison without granting discovery/social access.
create or replace function public.prepare_media_upload(
  p_visibility public.media_visibility,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_width integer,
  p_height integer,
  p_sha256 text default null::text,
  p_extension text default 'jpg'::text
)
returns table(
  media_id uuid,
  storage_bucket text,
  storage_path text,
  moderation_status public.media_moderation_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid := extensions.gen_random_uuid();
  v_extension text := lower(btrim(p_extension));
  v_path text;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;

  if not (
    private.is_active_adult(v_user_id)
    or private.is_profile_setup_adult(v_user_id)
  ) then
    raise exception using errcode='42501', message='active_or_profile_setup_adult_required';
  end if;

  if p_visibility not in ('avatar','public','fan','private') then
    raise exception using errcode='22023', message='client_visibility_not_allowed';
  end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp') then
    raise exception using errcode='22023', message='unsupported_media_mime_type';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 10485760 then
    raise exception using errcode='22023', message='invalid_media_file_size';
  end if;
  if p_width is null or p_height is null or p_width not between 1 and 12000 or p_height not between 1 and 12000 then
    raise exception using errcode='22023', message='invalid_media_dimensions';
  end if;
  if p_sha256 is not null and lower(p_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='invalid_sha256';
  end if;

  if v_extension = 'jpeg' then v_extension := 'jpg'; end if;
  if v_extension not in ('jpg','png','webp') then
    raise exception using errcode='22023', message='unsupported_media_extension';
  end if;
  if (p_mime_type='image/jpeg' and v_extension <> 'jpg')
     or (p_mime_type='image/png' and v_extension <> 'png')
     or (p_mime_type='image/webp' and v_extension <> 'webp') then
    raise exception using errcode='22023', message='mime_extension_mismatch';
  end if;

  v_path := v_user_id::text || '/' || v_id::text || '/original.' || v_extension;

  insert into public.media_assets(
    id, owner_id, storage_bucket, storage_path, mime_type,
    file_size_bytes, width, height, sha256, visibility
  )
  values(
    v_id, v_user_id, 'pending-media', v_path, p_mime_type,
    p_file_size_bytes, p_width, p_height,
    case when p_sha256 is null then null else lower(p_sha256) end,
    p_visibility
  );

  return query
    select v_id, 'pending-media'::text, v_path, 'pending_upload'::public.media_moderation_status;
end
$$;

revoke all on function public.prepare_media_upload(
  public.media_visibility, text, bigint, integer, integer, text, text
) from public, anon;
grant execute on function public.prepare_media_upload(
  public.media_visibility, text, bigint, integer, integer, text, text
) to authenticated;

-- Keep live selfies private and service-role-only. Client code never receives a
-- direct bucket policy; verification functions issue only short-lived signed URLs to admins.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-verification',
  'member-verification',
  false,
  5242880,
  array['image/jpeg']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create index if not exists moderation_cases_member_photo_verification_idx
  on public.moderation_cases(reported_user_id, created_at desc)
  where reported_user_id is not null
    and 'member_photo_verification' = any(rule_codes);

-- A profile created during signup cannot become active simply by calling the
-- existing profile update RPC. Only a resolved/approved selfie verification case
-- opens the activation gate. This keeps Search/Favorite/social RPCs protected by
-- private.is_active_adult(), which already requires profile_status = active.
create or replace function private.enforce_member_photo_verification_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.profile_status in ('incomplete'::public.profile_status, 'pending_review'::public.profile_status)
     and new.profile_status = 'active'::public.profile_status
     and not exists (
       select 1
       from public.moderation_cases mc
       where mc.reported_user_id = new.id
         and 'member_photo_verification' = any(mc.rule_codes)
         and mc.status = 'resolved'::public.moderation_case_status
         and mc.decision = 'approve'::public.moderation_decision
     ) then
    new.profile_status := 'pending_review'::public.profile_status;
    new.discovery_enabled := false;
  end if;

  return new;
end
$$;

revoke all on function private.enforce_member_photo_verification_gate() from public, anon, authenticated;

drop trigger if exists profiles_member_photo_verification_gate on public.profiles;
create trigger profiles_member_photo_verification_gate
before update of profile_status on public.profiles
for each row
execute function private.enforce_member_photo_verification_gate();
