create or replace function private.prevent_immutable_media_audit_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception using errcode='42501',message='media_moderation_events_are_immutable';
end $$;
create trigger media_moderation_events_immutable before update or delete on private.media_moderation_events for each row execute function private.prevent_immutable_media_audit_mutation();

create or replace function private.current_user_has_any_role(p_roles private.user_role[])
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from private.user_roles r
    where r.user_id=auth.uid() and r.role=any(p_roles) and r.revoked_at is null
  )
$$;

create or replace function private.has_active_fan_membership(p_creator_id uuid,p_viewer_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_result boolean:=false;
begin
  if p_creator_id=p_viewer_id then return true; end if;
  if to_regclass('public.fan_memberships') is null then return false; end if;
  begin
    execute 'select exists(select 1 from public.fan_memberships where creator_id=$1 and fan_user_id=$2 and status=''active'' and revoked_at is null)'
      into v_result using p_creator_id,p_viewer_id;
  exception when undefined_column then
    return false;
  end;
  return coalesce(v_result,false);
end $$;

create or replace function private.can_view_media_internal(p_media_id uuid,p_viewer_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_media public.media_assets%rowtype;
begin
  if p_viewer_id is null then return false; end if;
  select * into v_media from public.media_assets where id=p_media_id;
  if not found or v_media.deleted_at is not null or v_media.moderation_status='deleted' then return false; end if;
  if v_media.owner_id=p_viewer_id then return true; end if;
  if v_media.moderation_status<>'approved' or v_media.visibility in ('private','kyc') then return false; end if;
  if private.users_are_blocked(v_media.owner_id,p_viewer_id) then return false; end if;
  if not private.is_active_adult(v_media.owner_id) or not private.is_active_adult(p_viewer_id) then return false; end if;
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
end $$;

create or replace function private.validate_album_media_owner()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_album public.albums%rowtype; v_media public.media_assets%rowtype;
begin
  select * into v_album from public.albums where id=new.album_id;
  select * into v_media from public.media_assets where id=new.media_id;
  if v_album.id is null or v_media.id is null then raise exception using errcode='23503',message='album_or_media_not_found'; end if;
  if v_album.owner_id<>v_media.owner_id then raise exception using errcode='42501',message='album_media_owner_mismatch'; end if;
  if v_media.visibility in ('kyc','private','avatar') then raise exception using errcode='22023',message='media_visibility_not_album_eligible'; end if;
  if (v_album.album_type='public' and v_media.visibility<>'public') or (v_album.album_type='fan' and v_media.visibility<>'fan') then
    raise exception using errcode='22023',message='album_media_visibility_mismatch';
  end if;
  if v_album.deleted_at is not null or v_media.deleted_at is not null then raise exception using errcode='22023',message='deleted_album_or_media'; end if;
  return new;
end $$;
create trigger album_media_validate_owner before insert or update on public.album_media for each row execute function private.validate_album_media_owner();

create or replace function private.pending_media_object_allowed(p_name text,p_owner_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.media_assets m
    where m.owner_id::text=p_owner_id
      and m.storage_bucket='pending-media'
      and m.storage_path=p_name
      and m.moderation_status='pending_upload'
      and m.deleted_at is null
      and split_part(p_name,'/',1)=p_owner_id
      and split_part(p_name,'/',2)=m.id::text
  )
$$;

create or replace function private.pending_media_object_deletable(p_name text,p_owner_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.media_assets m
    where m.owner_id::text=p_owner_id
      and m.storage_bucket='pending-media'
      and m.storage_path=p_name
      and m.moderation_status in ('pending_upload','pending_review','rejected')
      and m.deleted_at is null
  )
$$;

revoke all on function private.current_user_has_any_role(private.user_role[]) from public,anon,authenticated;
revoke all on function private.has_active_fan_membership(uuid,uuid) from public,anon,authenticated;
revoke all on function private.can_view_media_internal(uuid,uuid) from public,anon,authenticated;
revoke all on function private.validate_album_media_owner() from public,anon,authenticated;
revoke all on function private.pending_media_object_allowed(text,text) from public,anon,authenticated;
revoke all on function private.pending_media_object_deletable(text,text) from public,anon,authenticated;
grant execute on function private.pending_media_object_allowed(text,text) to authenticated;
grant execute on function private.pending_media_object_deletable(text,text) to authenticated;
revoke all on function private.prevent_immutable_media_audit_mutation() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('pending-media','pending-media',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('profile-media','profile-media',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('kyc-private','kyc-private',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy pending_media_insert_own_immutable on storage.objects
for insert to authenticated
with check (
  bucket_id='pending-media'
  and owner_id=(select auth.uid()::text)
  and (storage.foldername(name))[1]=(select auth.uid()::text)
  and private.pending_media_object_allowed(name,owner_id)
);
create policy pending_media_select_own on storage.objects
for select to authenticated
using (
  bucket_id='pending-media'
  and owner_id=(select auth.uid()::text)
  and (storage.foldername(name))[1]=(select auth.uid()::text)
);
create policy pending_media_delete_own_unapproved on storage.objects
for delete to authenticated
using (
  bucket_id='pending-media'
  and owner_id=(select auth.uid()::text)
  and private.pending_media_object_deletable(name,owner_id)
);

create or replace function public.prepare_media_upload(
  p_visibility public.media_visibility,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_width integer,
  p_height integer,
  p_sha256 text default null,
  p_extension text default 'jpg'
)
returns table(media_id uuid,storage_bucket text,storage_path text,moderation_status public.media_moderation_status)
language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_id uuid:=extensions.gen_random_uuid(); v_extension text:=lower(btrim(p_extension)); v_path text;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if p_visibility not in ('avatar','public','fan','private') then raise exception using errcode='22023',message='client_visibility_not_allowed'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception using errcode='22023',message='unsupported_media_mime_type'; end if;
  if p_file_size_bytes is null or p_file_size_bytes<=0 or p_file_size_bytes>10485760 then raise exception using errcode='22023',message='invalid_media_file_size'; end if;
  if p_width is null or p_height is null or p_width not between 1 and 12000 or p_height not between 1 and 12000 then raise exception using errcode='22023',message='invalid_media_dimensions'; end if;
  if p_sha256 is not null and lower(p_sha256)!~'^[0-9a-f]{64}$' then raise exception using errcode='22023',message='invalid_sha256'; end if;
  if v_extension='jpeg' then v_extension:='jpg'; end if;
  if v_extension not in ('jpg','png','webp') then raise exception using errcode='22023',message='unsupported_media_extension'; end if;
  if (p_mime_type='image/jpeg' and v_extension<>'jpg') or (p_mime_type='image/png' and v_extension<>'png') or (p_mime_type='image/webp' and v_extension<>'webp') then
    raise exception using errcode='22023',message='mime_extension_mismatch';
  end if;
  v_path:=v_user_id::text||'/'||v_id::text||'/original.'||v_extension;
  insert into public.media_assets(id,owner_id,storage_bucket,storage_path,mime_type,file_size_bytes,width,height,sha256,visibility)
  values(v_id,v_user_id,'pending-media',v_path,p_mime_type,p_file_size_bytes,p_width,p_height,case when p_sha256 is null then null else lower(p_sha256) end,p_visibility);
  return query select v_id,'pending-media'::text,v_path,'pending_upload'::public.media_moderation_status;
end $$;
revoke all on function public.prepare_media_upload(public.media_visibility,text,bigint,integer,integer,text,text) from public,anon;
grant execute on function public.prepare_media_upload(public.media_visibility,text,bigint,integer,integer,text,text) to authenticated;

create or replace function public.finalize_media_upload(p_media_id uuid)
returns public.media_assets language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_media public.media_assets; v_case_id uuid;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  select * into v_media from public.media_assets where id=p_media_id and owner_id=v_user_id for update;
  if not found or v_media.moderation_status<>'pending_upload' then raise exception using errcode='42501',message='pending_upload_not_available'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id=v_media.storage_bucket and o.name=v_media.storage_path and o.owner_id=v_user_id::text) then
    raise exception using errcode='23503',message='storage_object_not_found';
  end if;
  update public.media_assets set moderation_status='pending_review',uploaded_at=now() where id=p_media_id returning * into v_media;
  insert into public.moderation_cases(media_id,source,status,priority,rule_codes)
  values(p_media_id,'upload','queued','normal','{}') returning id into v_case_id;
  return v_media;
end $$;
revoke all on function public.finalize_media_upload(uuid) from public,anon;
grant execute on function public.finalize_media_upload(uuid) to authenticated;

create or replace function public.list_my_media(p_limit integer default 50,p_cursor uuid default null)
returns table(id uuid,storage_bucket text,storage_path text,media_type public.media_type,mime_type text,file_size_bytes bigint,width integer,height integer,visibility public.media_visibility,moderation_status public.media_moderation_status,moderation_reason_code text,uploaded_at timestamptz,approved_at timestamptz,rejected_at timestamptz,deleted_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select m.id,m.storage_bucket,m.storage_path,m.media_type,m.mime_type,m.file_size_bytes,m.width,m.height,m.visibility,m.moderation_status,m.moderation_reason_code,m.uploaded_at,m.approved_at,m.rejected_at,m.deleted_at,m.created_at
  from public.media_assets m where m.owner_id=auth.uid() and (p_cursor is null or m.id>p_cursor)
  order by m.id limit least(greatest(coalesce(p_limit,50),1),100)
$$;
revoke all on function public.list_my_media(integer,uuid) from public,anon;
grant execute on function public.list_my_media(integer,uuid) to authenticated;

create or replace function public.create_album(p_name text,p_album_type public.album_type,p_fan_threshold_units bigint default null)
returns public.albums language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_threshold bigint; v_album public.albums;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not private.is_active_adult(v_user_id) then raise exception using errcode='42501',message='active_adult_account_required'; end if;
  if p_album_type='fan' then
    select coalesce(p_fan_threshold_units,(value_json#>>'{}')::bigint) into v_threshold from private.app_config where key='fan_minimum_units';
    v_threshold:=coalesce(v_threshold,1000);
    if v_threshold<=0 then raise exception using errcode='22023',message='invalid_fan_threshold'; end if;
  else v_threshold:=0; end if;
  insert into public.albums(owner_id,name,album_type,fan_threshold_units)
  values(v_user_id,btrim(p_name),p_album_type,v_threshold) returning * into v_album;
  return v_album;
end $$;
revoke all on function public.create_album(text,public.album_type,bigint) from public,anon;
grant execute on function public.create_album(text,public.album_type,bigint) to authenticated;

create or replace function public.set_album_active(p_album_id uuid,p_is_active boolean)
returns public.albums language plpgsql security definer set search_path='' as $$
declare v_album public.albums;
begin
  update public.albums set is_active=p_is_active where id=p_album_id and owner_id=auth.uid() and deleted_at is null returning * into v_album;
  if v_album.id is null then raise exception using errcode='42501',message='album_not_available'; end if;
  return v_album;
end $$;
revoke all on function public.set_album_active(uuid,boolean) from public,anon;
grant execute on function public.set_album_active(uuid,boolean) to authenticated;

create or replace function public.add_media_to_album(p_album_id uuid,p_media_id uuid,p_sort_order integer default 0)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.albums a where a.id=p_album_id and a.owner_id=auth.uid() and a.deleted_at is null) then raise exception using errcode='42501',message='album_not_available'; end if;
  insert into public.album_media(album_id,media_id,sort_order) values(p_album_id,p_media_id,greatest(coalesce(p_sort_order,0),0))
  on conflict(album_id,media_id) do update set sort_order=excluded.sort_order;
  return true;
end $$;
revoke all on function public.add_media_to_album(uuid,uuid,integer) from public,anon;
grant execute on function public.add_media_to_album(uuid,uuid,integer) to authenticated;

create or replace function public.remove_media_from_album(p_album_id uuid,p_media_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  delete from public.album_media am using public.albums a
  where am.album_id=a.id and a.id=p_album_id and a.owner_id=auth.uid() and am.media_id=p_media_id;
  return found;
end $$;
revoke all on function public.remove_media_from_album(uuid,uuid) from public,anon;
grant execute on function public.remove_media_from_album(uuid,uuid) to authenticated;

create or replace function public.can_view_media(p_media_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.can_view_media_internal(p_media_id,auth.uid())
$$;
revoke all on function public.can_view_media(uuid) from public,anon;
grant execute on function public.can_view_media(uuid) to authenticated;

create or replace function public.list_profile_album_media(p_owner_id uuid,p_album_type public.album_type default null)
returns table(album_id uuid,album_name text,album_type public.album_type,fan_threshold_units bigint,media_id uuid,media_type public.media_type,mime_type text,width integer,height integer,visibility public.media_visibility,sort_order integer,approved_at timestamptz)
language sql stable security definer set search_path='' as $$
  select a.id,a.name,a.album_type,a.fan_threshold_units,m.id,m.media_type,m.mime_type,m.width,m.height,m.visibility,am.sort_order,m.approved_at
  from public.albums a join public.album_media am on am.album_id=a.id join public.media_assets m on m.id=am.media_id
  where a.owner_id=p_owner_id and a.is_active and a.deleted_at is null
    and (p_album_type is null or a.album_type=p_album_type)
    and m.moderation_status='approved' and m.deleted_at is null
    and private.can_view_media_internal(m.id,auth.uid())
  order by a.created_at,am.sort_order,am.created_at
$$;
revoke all on function public.list_profile_album_media(uuid,public.album_type) from public,anon;
grant execute on function public.list_profile_album_media(uuid,public.album_type) to authenticated;

create or replace function public.set_my_avatar(p_media_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.media_assets m where m.id=p_media_id and m.owner_id=auth.uid() and m.visibility='avatar' and m.moderation_status='approved' and m.deleted_at is null) then
    raise exception using errcode='42501',message='approved_avatar_not_available';
  end if;
  update public.profiles set avatar_media_id=p_media_id where id=auth.uid();
  return found;
end $$;
revoke all on function public.set_my_avatar(uuid) from public,anon;
grant execute on function public.set_my_avatar(uuid) to authenticated;

create or replace function public.can_moderate_content()
returns boolean language sql stable security definer set search_path='' as $$
  select private.current_user_has_any_role(array['moderator','super_admin']::private.user_role[])
$$;
revoke all on function public.can_moderate_content() from public,anon;
grant execute on function public.can_moderate_content() to authenticated;

create or replace function public.moderate_media(
  p_media_id uuid,
  p_action public.moderation_decision,
  p_reason_code text,
  p_notes text default null,
  p_destination_bucket text default null,
  p_destination_path text default null,
  p_request_id uuid default null
)
returns public.media_assets language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_before public.media_assets; v_after public.media_assets; v_case_id uuid; v_new_status public.media_moderation_status;
begin
  if v_actor is null or not private.current_user_has_any_role(array['moderator','super_admin']::private.user_role[]) then raise exception using errcode='42501',message='moderator_role_required'; end if;
  if p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$' then raise exception using errcode='22023',message='invalid_moderation_reason'; end if;
  select * into v_before from public.media_assets where id=p_media_id for update;
  if not found then raise exception using errcode='23503',message='media_not_found'; end if;
  select id into v_case_id from public.moderation_cases where media_id=p_media_id and status in ('open','queued','in_review') order by created_at limit 1 for update;
  if v_case_id is null then insert into public.moderation_cases(media_id,source,status,priority) values(p_media_id,'admin_review','in_review','normal') returning id into v_case_id; end if;
  if p_action='approve' then
    if v_before.moderation_status not in ('pending_review','quarantined') then raise exception using errcode='22023',message='media_not_approvable'; end if;
    if p_destination_bucket<>'profile-media' or p_destination_path is null then raise exception using errcode='22023',message='approved_destination_required'; end if;
    if split_part(p_destination_path,'/',1)<>v_before.owner_id::text or split_part(p_destination_path,'/',2)<>v_before.id::text then raise exception using errcode='22023',message='invalid_approved_destination'; end if;
    if not exists(select 1 from storage.objects o where o.bucket_id=p_destination_bucket and o.name=p_destination_path) then raise exception using errcode='23503',message='approved_storage_object_not_found'; end if;
    v_new_status:='approved';
    update public.media_assets set storage_bucket=p_destination_bucket,storage_path=p_destination_path,moderation_status=v_new_status,moderation_reason_code=p_reason_code,approved_at=now(),approved_by=v_actor,rejected_at=null,deleted_at=null where id=p_media_id returning * into v_after;
    if v_after.visibility='avatar' then update public.profiles set avatar_media_id=v_after.id where id=v_after.owner_id; end if;
  elsif p_action='reject' then
    v_new_status:='rejected';
    update public.media_assets set moderation_status=v_new_status,moderation_reason_code=p_reason_code,approved_at=null,approved_by=null,rejected_at=now(),deleted_at=null where id=p_media_id returning * into v_after;
  elsif p_action='quarantine' then
    v_new_status:='quarantined';
    update public.media_assets set moderation_status=v_new_status,moderation_reason_code=p_reason_code,approved_at=null,approved_by=null where id=p_media_id returning * into v_after;
  elsif p_action='restore' then
    v_new_status:='pending_review';
    update public.media_assets set moderation_status=v_new_status,moderation_reason_code=p_reason_code,approved_at=null,approved_by=null,rejected_at=null,deleted_at=null where id=p_media_id returning * into v_after;
  elsif p_action='delete' then
    v_new_status:='deleted';
    update public.media_assets set moderation_status=v_new_status,moderation_reason_code=p_reason_code,deleted_at=now() where id=p_media_id returning * into v_after;
    update public.profiles set avatar_media_id=null where avatar_media_id=p_media_id;
  else raise exception using errcode='22023',message='unsupported_moderation_action'; end if;
  update public.moderation_cases set status='resolved',decision=p_action,decision_notes=p_notes,resolved_at=now() where id=v_case_id;
  insert into private.media_moderation_events(media_id,moderation_case_id,actor_user_id,action,previous_status,new_status,reason_code,notes,request_id)
  values(p_media_id,v_case_id,v_actor,p_action,v_before.moderation_status,v_new_status,p_reason_code,p_notes,coalesce(p_request_id,extensions.gen_random_uuid()));
  return v_after;
end $$;
revoke all on function public.moderate_media(uuid,public.moderation_decision,text,text,text,text,uuid) from public,anon;
grant execute on function public.moderate_media(uuid,public.moderation_decision,text,text,text,text,uuid) to authenticated;

alter table public.media_assets enable row level security;
alter table public.albums enable row level security;
alter table public.album_media enable row level security;
alter table public.moderation_cases enable row level security;
alter table private.media_moderation_events enable row level security;
revoke all on public.media_assets,public.albums,public.album_media,public.moderation_cases from public,anon,authenticated;
revoke all on private.media_moderation_events from public,anon,authenticated;
grant select on public.media_assets,public.albums,public.album_media to authenticated;
create policy media_assets_select_owner on public.media_assets for select to authenticated using (owner_id=(select auth.uid()));
create policy albums_select_owner on public.albums for select to authenticated using (owner_id=(select auth.uid()));
create policy album_media_select_owner on public.album_media for select to authenticated using (exists(select 1 from public.albums a where a.id=album_id and a.owner_id=(select auth.uid())));

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='media_assets') then alter publication supabase_realtime add table public.media_assets; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='albums') then alter publication supabase_realtime add table public.albums; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='album_media') then alter publication supabase_realtime add table public.album_media; end if;
  end if;
end $$;

comment on function public.prepare_media_upload(public.media_visibility,text,bigint,integer,integer,text,text) is 'Creates immutable owner-scoped pending media metadata and a server-generated Storage path.';
comment on function public.can_view_media(uuid) is 'Returns only an authorization boolean; Storage path remains hidden from viewers.';
comment on function public.moderate_media(uuid,public.moderation_decision,text,text,text,text,uuid) is 'Role-checked moderation state transition with append-only audit.';
