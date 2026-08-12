-- LX-20 — Seeking-aligned member verification + owner-controlled private photos.
--
-- Product override (2026-08-12):
-- - Activity is intentionally NOT part of LX-20 and remains hidden from the Luxy V1 surface.
-- - Normal profile photo uploads are public by default at the client surface.
-- - An owner may toggle an eligible profile photo Public <-> Private at any time.
-- - Private photos are a paid membership entitlement: Premium/Diamond can view automatically.
-- - Free members may see only a locked private-photo count/upgrade affordance; no storage path leaks.
-- - Legacy private-photo request rows/RPCs are retained only for backward compatibility and no
--   longer participate in authorization. Gifts, Fan and friendship state never unlock photos.
-- - Selfie verification reuses the existing live-camera + >=60% profile-photo comparison gate.
-- - CCCD and LinkedIn use a separate member-profile verification contract, not payout KYC.

create table if not exists private.member_profile_verifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  identity_status text not null default 'not_started',
  identity_submitted_at timestamptz,
  identity_reviewed_at timestamptz,
  identity_reviewed_by uuid references auth.users(id) on delete set null,
  identity_reason_code text,
  linkedin_status text not null default 'not_started',
  linkedin_profile_url text,
  linkedin_submitted_at timestamptz,
  linkedin_reviewed_at timestamptz,
  linkedin_reviewed_by uuid references auth.users(id) on delete set null,
  linkedin_reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_profile_identity_status_check check(identity_status in ('not_started','pending','approved','rejected')),
  constraint member_profile_linkedin_status_check check(linkedin_status in ('not_started','pending','approved','rejected')),
  constraint member_profile_identity_reason_check check(identity_reason_code is null or identity_reason_code~'^[a-z][a-z0-9_]{1,63}$'),
  constraint member_profile_linkedin_reason_check check(linkedin_reason_code is null or linkedin_reason_code~'^[a-z][a-z0-9_]{1,63}$')
);

create table if not exists private.member_identity_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_side text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  storage_bucket text not null default 'member-identity-verification',
  storage_path text not null,
  status text not null default 'prepared',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_identity_side_check check(document_side in ('front','back')),
  constraint member_identity_mime_check check(mime_type in ('image/jpeg','image/png','image/webp')),
  constraint member_identity_size_check check(file_size_bytes>0 and file_size_bytes<=10485760),
  constraint member_identity_bucket_check check(storage_bucket='member-identity-verification'),
  constraint member_identity_path_check check(storage_path~'^[0-9a-f-]{36}/[0-9a-f-]{36}/(front|back)\.(jpg|png|webp)$'),
  constraint member_identity_status_check check(status in ('prepared','submitted','superseded')),
  unique(storage_bucket,storage_path)
);

create index if not exists member_identity_documents_user_side_idx
  on private.member_identity_documents(user_id,document_side,created_at desc);
create index if not exists member_profile_verifications_identity_queue_idx
  on private.member_profile_verifications(identity_status,identity_submitted_at)
  where identity_status='pending';
create index if not exists member_profile_verifications_linkedin_queue_idx
  on private.member_profile_verifications(linkedin_status,linkedin_submitted_at)
  where linkedin_status='pending';

revoke all on private.member_profile_verifications,private.member_identity_documents from public,anon,authenticated;
grant all on private.member_profile_verifications,private.member_identity_documents to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'member-identity-verification',
  'member-identity-verification',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict(id) do update
set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.member_identity_object_allowed(p_name text,p_owner_id text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from private.member_identity_documents d
    where d.user_id::text=p_owner_id
      and d.storage_bucket='member-identity-verification'
      and d.storage_path=p_name
      and d.status='prepared'
      and split_part(p_name,'/',1)=p_owner_id
  )
$$;
revoke all on function private.member_identity_object_allowed(text,text) from public,anon,authenticated;
grant execute on function private.member_identity_object_allowed(text,text) to authenticated;

drop policy if exists member_identity_insert_prepared on storage.objects;
create policy member_identity_insert_prepared on storage.objects
for insert to authenticated
with check(
  bucket_id='member-identity-verification'
  and owner_id=(select auth.uid()::text)
  and (storage.foldername(name))[1]=(select auth.uid()::text)
  and private.member_identity_object_allowed(name,owner_id)
);

create or replace function public.prepare_member_identity_document(
  p_side text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_extension text default 'jpg'
)
returns table(document_id uuid,storage_bucket text,storage_path text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_side text:=lower(btrim(coalesce(p_side,'')));
  v_extension text:=lower(btrim(coalesce(p_extension,'jpg')));
  v_id uuid:=extensions.gen_random_uuid();
  v_path text;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if v_side not in ('front','back') then raise exception using errcode='22023',message='invalid_identity_document_side'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception using errcode='22023',message='unsupported_identity_mime_type'; end if;
  if p_file_size_bytes is null or p_file_size_bytes<=0 or p_file_size_bytes>10485760 then raise exception using errcode='22023',message='invalid_identity_file_size'; end if;
  if v_extension='jpeg' then v_extension:='jpg'; end if;
  if v_extension not in ('jpg','png','webp') then raise exception using errcode='22023',message='unsupported_identity_extension'; end if;
  if (p_mime_type='image/jpeg' and v_extension<>'jpg')
     or (p_mime_type='image/png' and v_extension<>'png')
     or (p_mime_type='image/webp' and v_extension<>'webp') then
    raise exception using errcode='22023',message='identity_mime_extension_mismatch';
  end if;

  v_path:=v_user_id::text||'/'||v_id::text||'/'||v_side||'.'||v_extension;
  insert into private.member_identity_documents(id,user_id,document_side,mime_type,file_size_bytes,storage_path)
  values(v_id,v_user_id,v_side,p_mime_type,p_file_size_bytes,v_path);
  return query select v_id,'member-identity-verification'::text,v_path;
end;
$$;
revoke all on function public.prepare_member_identity_document(text,text,bigint,text) from public,anon;
grant execute on function public.prepare_member_identity_document(text,text,bigint,text) to authenticated,service_role;

create or replace function public.finalize_member_identity_document(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_doc private.member_identity_documents%rowtype;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  select d.* into v_doc from private.member_identity_documents d
  where d.id=p_document_id and d.user_id=v_user_id for update;
  if not found or v_doc.status<>'prepared' then raise exception using errcode='42501',message='identity_document_not_available'; end if;
  if not exists(
    select 1 from storage.objects o
    where o.bucket_id=v_doc.storage_bucket and o.name=v_doc.storage_path and o.owner_id=v_user_id::text
  ) then raise exception using errcode='23503',message='identity_storage_object_not_found'; end if;
  update private.member_identity_documents d set status='submitted',submitted_at=now(),updated_at=now() where d.id=v_doc.id;
  return true;
end;
$$;
revoke all on function public.finalize_member_identity_document(uuid) from public,anon;
grant execute on function public.finalize_member_identity_document(uuid) to authenticated,service_role;

create or replace function public.submit_my_member_identity_verification()
returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if not exists(select 1 from private.member_identity_documents d where d.user_id=v_user_id and d.document_side='front' and d.status='submitted')
     or not exists(select 1 from private.member_identity_documents d where d.user_id=v_user_id and d.document_side='back' and d.status='submitted') then
    raise exception using errcode='22023',message='identity_front_and_back_required';
  end if;
  insert into private.member_profile_verifications(user_id,identity_status,identity_submitted_at)
  values(v_user_id,'pending',now())
  on conflict(user_id) do update set
    identity_status='pending',identity_submitted_at=now(),identity_reviewed_at=null,identity_reviewed_by=null,identity_reason_code=null,updated_at=now();
  return 'pending';
end;
$$;
revoke all on function public.submit_my_member_identity_verification() from public,anon;
grant execute on function public.submit_my_member_identity_verification() to authenticated,service_role;

create or replace function public.submit_my_linkedin_verification(p_profile_url text)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_url text:=btrim(coalesce(p_profile_url,''));
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if char_length(v_url)>300 or v_url !~* '^https://(www\.)?linkedin\.com/in/[a-z0-9%._~-]+/?([?#][^[:space:]]*)?$' then
    raise exception using errcode='22023',message='invalid_linkedin_profile_url';
  end if;
  insert into private.member_profile_verifications(user_id,linkedin_status,linkedin_profile_url,linkedin_submitted_at)
  values(v_user_id,'pending',v_url,now())
  on conflict(user_id) do update set
    linkedin_status='pending',linkedin_profile_url=v_url,linkedin_submitted_at=now(),linkedin_reviewed_at=null,linkedin_reviewed_by=null,linkedin_reason_code=null,updated_at=now();
  return 'pending';
end;
$$;
revoke all on function public.submit_my_linkedin_verification(text) from public,anon;
grant execute on function public.submit_my_linkedin_verification(text) to authenticated,service_role;

create or replace function public.get_my_member_verification_status()
returns table(
  selfie_status text,
  selfie_similarity numeric,
  identity_status text,
  linkedin_status text,
  linkedin_profile_url text
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  return query
  select
    case
      when exists(select 1 from public.moderation_cases mc where mc.reported_user_id=v_user_id and 'member_photo_verification'=any(mc.rule_codes) and mc.status='resolved' and mc.decision='approve') then 'approved'
      when exists(select 1 from public.moderation_cases mc where mc.reported_user_id=v_user_id and 'member_photo_verification'=any(mc.rule_codes) and mc.status in ('open','queued','in_review')) then 'pending'
      when exists(select 1 from public.moderation_cases mc where mc.reported_user_id=v_user_id and 'member_photo_verification'=any(mc.rule_codes) and mc.status='resolved') then 'rejected'
      else 'not_started'
    end,
    (select nullif(mc.automated_score_json->>'maxSimilarity','')::numeric
     from public.moderation_cases mc
     where mc.reported_user_id=v_user_id and 'member_photo_verification'=any(mc.rule_codes)
     order by mc.created_at desc limit 1),
    coalesce(v.identity_status,'not_started'),
    coalesce(v.linkedin_status,'not_started'),
    v.linkedin_profile_url
  from (select 1) seed
  left join private.member_profile_verifications v on v.user_id=v_user_id;
end;
$$;
revoke all on function public.get_my_member_verification_status() from public,anon;
grant execute on function public.get_my_member_verification_status() to authenticated,service_role;

create or replace function public.get_luxy_member_verification_badges(p_user_id uuid)
returns table(selfie_verified boolean,identity_verified boolean,linkedin_verified boolean)
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_viewer uuid:=auth.uid();
begin
  if v_viewer is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_viewer) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if p_user_id is null or private.users_are_blocked(v_viewer,p_user_id) then return; end if;
  return query select
    exists(select 1 from public.moderation_cases mc where mc.reported_user_id=p_user_id and 'member_photo_verification'=any(mc.rule_codes) and mc.status='resolved' and mc.decision='approve'),
    coalesce(v.identity_status='approved',false),
    coalesce(v.linkedin_status='approved',false)
  from (select 1) seed
  left join private.member_profile_verifications v on v.user_id=p_user_id;
end;
$$;
revoke all on function public.get_luxy_member_verification_badges(uuid) from public,anon;
grant execute on function public.get_luxy_member_verification_badges(uuid) to authenticated,service_role;

create or replace function public.admin_review_member_profile_verification(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_kind text,
  p_decision text,
  p_reason_code text,
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role private.user_role;
  v_kind text:=lower(btrim(coalesce(p_kind,'')));
  v_decision text:=lower(btrim(coalesce(p_decision,'')));
  v_status text;
begin
  v_role:=private.actor_role_for(p_actor_user_id,array['moderator'::private.user_role,'super_admin'::private.user_role]);
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  if v_kind not in ('identity','linkedin') then raise exception using errcode='22023',message='invalid_member_verification_kind'; end if;
  if v_decision not in ('approve','reject') then raise exception using errcode='22023',message='invalid_member_verification_decision'; end if;
  if p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$' then raise exception using errcode='22023',message='invalid_verification_reason_code'; end if;
  v_status:=case when v_decision='approve' then 'approved' else 'rejected' end;

  insert into private.member_profile_verifications(user_id) values(p_user_id) on conflict(user_id) do nothing;
  if v_kind='identity' then
    if not exists(select 1 from private.member_profile_verifications v where v.user_id=p_user_id and v.identity_status='pending') then
      raise exception using errcode='42501',message='pending_identity_verification_required';
    end if;
    update private.member_profile_verifications v set identity_status=v_status,identity_reviewed_at=now(),identity_reviewed_by=p_actor_user_id,identity_reason_code=p_reason_code,updated_at=now() where v.user_id=p_user_id;
  else
    if not exists(select 1 from private.member_profile_verifications v where v.user_id=p_user_id and v.linkedin_status='pending') then
      raise exception using errcode='42501',message='pending_linkedin_verification_required';
    end if;
    update private.member_profile_verifications v set linkedin_status=v_status,linkedin_reviewed_at=now(),linkedin_reviewed_by=p_actor_user_id,linkedin_reason_code=p_reason_code,updated_at=now() where v.user_id=p_user_id;
  end if;
  perform private.append_admin_audit(
    p_actor_user_id,v_role,'member_profile_verification_'||v_kind||'_'||v_decision,'profile',p_user_id,
    jsonb_build_object('kind',v_kind,'status','pending'),jsonb_build_object('kind',v_kind,'status',v_status),p_reason_code,p_request_id,null,null
  );
  return v_status;
end;
$$;
revoke all on function public.admin_review_member_profile_verification(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_review_member_profile_verification(uuid,uuid,text,text,text,uuid) to service_role;

-- Paid-membership private-photo authorization. Legacy request state is no longer consulted.
create or replace function private.has_approved_private_photo_access(p_owner_id uuid,p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_owner_id=p_viewer_id or private.has_active_luxy_paid_membership(p_viewer_id)
$$;
revoke all on function private.has_approved_private_photo_access(uuid,uuid) from public,anon,authenticated;
grant execute on function private.has_approved_private_photo_access(uuid,uuid) to service_role;

create or replace function private.can_view_media_internal(p_media_id uuid,p_viewer_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_media public.media_assets%rowtype;
begin
  if p_viewer_id is null then return false; end if;
  select m.* into v_media from public.media_assets m where m.id=p_media_id;
  if not found or v_media.deleted_at is not null or v_media.moderation_status='deleted' then return false; end if;
  if v_media.owner_id=p_viewer_id then
    return v_media.visibility<>'kyc'
      and v_media.moderation_status in ('pending_upload','pending_review','approved','rejected','quarantined');
  end if;
  if v_media.moderation_status not in ('pending_review','approved') or v_media.uploaded_at is null then return false; end if;
  if private.users_are_blocked(v_media.owner_id,p_viewer_id) then return false; end if;
  if not private.is_active_adult(v_media.owner_id) or not private.is_active_adult(p_viewer_id) then return false; end if;
  if v_media.visibility='private' then return private.has_active_luxy_paid_membership(p_viewer_id); end if;
  if v_media.visibility='kyc' then return false; end if;
  if v_media.visibility='avatar' then
    return exists(select 1 from public.profiles p where p.id=v_media.owner_id and p.avatar_media_id=v_media.id and p.profile_status='active' and p.deleted_at is null);
  end if;
  if v_media.visibility='public' then
    return exists(
      select 1 from public.album_media am join public.albums a on a.id=am.album_id
      where am.media_id=v_media.id and a.owner_id=v_media.owner_id and a.album_type='public' and a.is_active and a.deleted_at is null
    );
  end if;
  if v_media.visibility='fan' then
    return exists(
      select 1 from public.album_media am join public.albums a on a.id=am.album_id
      where am.media_id=v_media.id and a.owner_id=v_media.owner_id and a.album_type='fan' and a.is_active and a.deleted_at is null
    ) and private.has_active_fan_membership(v_media.owner_id,p_viewer_id);
  end if;
  return false;
end;
$$;
revoke all on function private.can_view_media_internal(uuid,uuid) from public,anon,authenticated;

create or replace function public.get_private_photo_access_state(p_owner_id uuid)
returns table(request_id uuid,status text,has_access boolean,can_request boolean,private_photo_count integer)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_count integer:=0;
  v_paid boolean:=false;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if p_owner_id is null or p_owner_id=v_user_id then raise exception using errcode='22023',message='invalid_private_photo_target'; end if;
  if private.users_are_blocked(v_user_id,p_owner_id) or not private.is_active_adult(p_owner_id)
     or not exists(select 1 from public.profiles p where p.id=p_owner_id and p.profile_status='active' and p.deleted_at is null) then
    return query select null::uuid,'unavailable'::text,false,false,0;
    return;
  end if;
  select count(*)::integer into v_count from public.media_assets m
  where m.owner_id=p_owner_id and m.visibility='private' and m.moderation_status in ('pending_review','approved') and m.deleted_at is null and m.uploaded_at is not null;
  v_paid:=private.has_active_luxy_paid_membership(v_user_id);
  return query select null::uuid,case when v_paid then 'approved' else 'not_requested' end,v_paid,false,v_count;
end;
$$;
revoke all on function public.get_private_photo_access_state(uuid) from public,anon;
grant execute on function public.get_private_photo_access_state(uuid) to authenticated,service_role;

create or replace function public.list_profile_private_media(p_owner_id uuid)
returns table(media_id uuid,storage_bucket text,storage_path text,width integer,height integer,created_at timestamptz)
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if p_owner_id is null or p_owner_id=v_user_id then raise exception using errcode='22023',message='invalid_private_photo_target'; end if;
  if private.users_are_blocked(v_user_id,p_owner_id) or not private.is_active_adult(p_owner_id) then return; end if;
  if not private.has_active_luxy_paid_membership(v_user_id) then raise exception using errcode='42501',message='premium_membership_required'; end if;
  return query select m.id,m.storage_bucket,m.storage_path,m.width,m.height,m.created_at
  from public.media_assets m
  where m.owner_id=p_owner_id and m.visibility='private' and m.moderation_status in ('pending_review','approved') and m.deleted_at is null and m.uploaded_at is not null
    and private.can_view_media_internal(m.id,v_user_id)
  order by m.created_at desc,m.id;
end;
$$;
revoke all on function public.list_profile_private_media(uuid) from public,anon;
grant execute on function public.list_profile_private_media(uuid) to authenticated,service_role;

create or replace function public.set_my_profile_photo_visibility(p_media_id uuid,p_visibility text)
returns table(media_id uuid,visibility text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_target text:=lower(btrim(coalesce(p_visibility,'')));
  v_media public.media_assets%rowtype;
  v_album_id uuid;
begin
  if v_user_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if v_target not in ('public','private') then raise exception using errcode='22023',message='invalid_profile_photo_visibility'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text||':profile-photo-visibility',0));
  select m.* into v_media from public.media_assets m where m.id=p_media_id and m.owner_id=v_user_id for update;
  if not found or v_media.visibility not in ('public','private') or v_media.deleted_at is not null
     or v_media.moderation_status not in ('pending_review','approved') or v_media.uploaded_at is null then
    raise exception using errcode='42501',message='profile_photo_not_toggleable';
  end if;
  if v_media.visibility::text=v_target then return query select v_media.id,v_target; return; end if;

  delete from public.album_media am where am.media_id=v_media.id;
  update public.media_assets m set visibility=v_target::public.media_visibility where m.id=v_media.id returning m.* into v_media;

  if v_target='public' then
    select a.id into v_album_id from public.albums a
    where a.owner_id=v_user_id and a.album_type='public' and a.is_active and a.deleted_at is null
    order by a.created_at limit 1;
    if v_album_id is null then
      insert into public.albums(owner_id,name,album_type,fan_threshold_units)
      values(v_user_id,'Ảnh công khai','public',0) returning id into v_album_id;
    end if;
    insert into public.album_media(album_id,media_id,sort_order) values(v_album_id,v_media.id,0)
    on conflict(album_id,media_id) do nothing;
  end if;
  return query select v_media.id,v_target;
end;
$$;
revoke all on function public.set_my_profile_photo_visibility(uuid,text) from public,anon;
grant execute on function public.set_my_profile_photo_visibility(uuid,text) to authenticated,service_role;

comment on function public.set_my_profile_photo_visibility(uuid,text) is
  'LX-20 owner-only Public/Private toggle. Avatar/Fan/KYC media cannot be toggled. Private access is Premium/Diamond server entitlement.';
comment on function public.list_profile_private_media(uuid) is
  'LX-20 Premium/Diamond direct private-photo read model; legacy per-viewer approval requests are ignored.';
comment on function public.get_my_member_verification_status() is
  'LX-20 caller-owned selfie/CCCD/LinkedIn status; no raw CCCD data is returned.';
