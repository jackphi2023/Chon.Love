begin;
select plan(40);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values
('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000001','authenticated','authenticated','media-owner@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000002','authenticated','authenticated','media-viewer@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000003','authenticated','authenticated','media-fan@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000004','authenticated','authenticated','media-moderator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set date_of_birth=(current_date-interval '25 years')::date,age_verified_at=now(),age_verification_method='self_declared',terms_version='2026-07',terms_accepted_at=now(),community_rules_version='2026-07',community_rules_accepted_at=now(),account_status='active'
where user_id::text like '40000000-0000-0000-0000-00000000000%';
update public.profiles set profile_status='active',username='media_'||right(id::text,1),display_name='Media test',discovery_enabled=true where id::text like '40000000-0000-0000-0000-00000000000%';
insert into private.user_roles(user_id,role,granted_by) values('40000000-0000-0000-0000-000000000004','moderator','40000000-0000-0000-0000-000000000004');

select is((select count(*) from storage.buckets where id in ('pending-media','profile-media','kyc-private') and public=false),3::bigint,'all three buckets are private');
select is((select file_size_limit from storage.buckets where id='pending-media'),10485760::bigint,'pending media is capped at 10 MB');
select ok((select allowed_mime_types @> array['image/jpeg','image/png','image/webp'] from storage.buckets where id='profile-media'),'profile bucket allows only approved image formats');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and (coalesce(qual,'')='true' or coalesce(with_check,'')='true')),'Storage has no broad true policy');
select ok((select relrowsecurity from pg_class where oid='public.media_assets'::regclass),'RLS enabled on media assets');
select ok((select relrowsecurity from pg_class where oid='private.media_moderation_events'::regclass),'RLS enabled on moderation audit');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
create temporary table prepared_owner as select * from public.prepare_media_upload('avatar','image/jpeg',1024,800,800,repeat('a',64),'jpg');
select is((select moderation_status::text from prepared_owner),'pending_upload','prepared media starts pending upload');
select ok((select storage_path like '40000000-0000-0000-0000-000000000001/%/original.jpg' from prepared_owner),'server path is owner/media/file');
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) select storage_bucket,storage_path,'40000000-0000-0000-0000-000000000001','{"mimetype":"image/jpeg","size":1024}'::jsonb from prepared_owner$$,'owner can upload only prepared immutable path');
select is((select count(*) from storage.objects where bucket_id='pending-media'),1::bigint,'owner can read own pending object');
select lives_ok($$select public.finalize_media_upload((select media_id from prepared_owner))$$,'owner finalizes uploaded object');
reset role;
select is((select moderation_status::text from public.media_assets where id=(select media_id from prepared_owner)),'pending_review','finalize sends media to review');
select is((select count(*) from public.moderation_cases where media_id=(select media_id from prepared_owner)),1::bigint,'finalize creates moderation case');
select is((select avatar_media_id from public.profiles where id='40000000-0000-0000-0000-000000000001'),null::uuid,'pending avatar does not replace public avatar');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) select storage_bucket,storage_path,'40000000-0000-0000-0000-000000000002','{}'::jsonb from prepared_owner$$,'42501',null,'B cannot upload to A path');
select is((select count(*) from storage.objects where bucket_id='pending-media'),0::bigint,'B cannot list A pending object');
select throws_ok($$update public.media_assets set moderation_status='approved' where id=(select media_id from prepared_owner)$$,'42501',null,'client cannot approve media directly');
select is(public.can_view_media((select media_id from prepared_owner)),false,'other user cannot view pending media');
select is((select count(*) from storage.objects where bucket_id='kyc-private'),0::bigint,'KYC bucket is not accessible to public client');
reset role;

insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'profile-media','40000000-0000-0000-0000-000000000001/'||media_id::text||'/approved.jpg',null,'{"mimetype":"image/jpeg","size":1024}'::jsonb from prepared_owner;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select lives_ok($$select public.moderate_media((select media_id from prepared_owner),'approve','safe_image','reviewed','profile-media','40000000-0000-0000-0000-000000000001/'||(select media_id from prepared_owner)::text||'/approved.jpg','50000000-0000-0000-0000-000000000001')$$,'moderator approves copied media');
reset role;
select is((select moderation_status::text from public.media_assets where id=(select media_id from prepared_owner)),'approved','media becomes approved');
select is((select avatar_media_id from public.profiles where id='40000000-0000-0000-0000-000000000001'),(select media_id from prepared_owner),'approved avatar replaces profile avatar');
select is((select count(*) from private.media_moderation_events where media_id=(select media_id from prepared_owner)),1::bigint,'approval writes immutable audit event');
select throws_ok($$update private.media_moderation_events set notes='tamper' where media_id=(select media_id from prepared_owner)$$,'42501','media_moderation_events_are_immutable','moderation audit cannot be updated');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.set_my_avatar((select media_id from prepared_owner))$$,'owner can set approved avatar');
create temporary table public_album as select * from public.create_album('Public album','public',null);
create temporary table fan_album as select * from public.create_album('Fan album','fan',1000);
reset role;

insert into public.media_assets(owner_id,storage_bucket,storage_path,mime_type,file_size_bytes,width,height,visibility,moderation_status,uploaded_at,approved_at,approved_by,rejected_at)
values
('40000000-0000-0000-0000-000000000001','profile-media','40000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000001/approved.jpg','image/jpeg',1000,800,800,'public','approved',now(),now(),'40000000-0000-0000-0000-000000000004',null),
('40000000-0000-0000-0000-000000000001','profile-media','40000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000002/approved.jpg','image/jpeg',1000,800,800,'fan','approved',now(),now(),'40000000-0000-0000-0000-000000000004',null),
('40000000-0000-0000-0000-000000000001','pending-media','40000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000003/original.jpg','image/jpeg',1000,800,800,'public','rejected',now(),null,null,now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.add_media_to_album((select id from public_album),(select id from public.media_assets where storage_path like '%60000000-0000-0000-0000-000000000001%'),0)$$,'owner adds public media to public album');
select lives_ok($$select public.add_media_to_album((select id from fan_album),(select id from public.media_assets where storage_path like '%60000000-0000-0000-0000-000000000002%'),0)$$,'owner adds fan media to fan album');
select throws_ok($$select public.add_media_to_album((select id from public_album),(select id from public.media_assets where storage_path like '%60000000-0000-0000-0000-000000000002%'),1)$$,'22023','album_media_visibility_mismatch','fan media cannot be attached to public album');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.list_profile_album_media('40000000-0000-0000-0000-000000000001','public')),1::bigint,'viewer sees approved public album media');
select is((select count(*) from public.list_profile_album_media('40000000-0000-0000-0000-000000000001','fan')),0::bigint,'non-fan cannot see Fan album');
select is(public.can_view_media((select id from public.media_assets where moderation_status='rejected')),false,'rejected media is never viewable');
reset role;

create table public.fan_memberships(creator_id uuid not null,fan_user_id uuid not null,status text not null,revoked_at timestamptz,primary key(creator_id,fan_user_id));
insert into public.fan_memberships values('40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','active',null);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.list_profile_album_media('40000000-0000-0000-0000-000000000001','fan')),1::bigint,'future active Fan membership can view approved Fan media');
select lives_ok($$select public.block_user('40000000-0000-0000-0000-000000000001','safety')$$,'fan blocks Creator');
select is((select count(*) from public.list_profile_album_media('40000000-0000-0000-0000-000000000001','fan')),0::bigint,'blocked fan cannot view Fan album');
reset role;

insert into public.albums(owner_id,name,album_type) values('40000000-0000-0000-0000-000000000002','Other owner','public');
select throws_ok($$insert into public.album_media(album_id,media_id) values((select id from public.albums where owner_id='40000000-0000-0000-0000-000000000002'),(select id from public.media_assets where storage_path like '%60000000-0000-0000-0000-000000000001%'))$$,'42501','album_media_owner_mismatch','album cannot attach another owner media');
select is((select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('media_assets','albums','album_media')),3::bigint,'Realtime includes only owner-facing Session 8 metadata tables');
select is((select count(*) from information_schema.role_table_grants where grantee='authenticated' and table_schema='storage' and table_name='objects' and privilege_type='UPDATE'),0::bigint,'Storage upsert/update is not granted');
select is((select count(*) from storage.buckets where id='kyc-private' and public=false),1::bigint,'KYC bucket remains fully private');
select ok(not has_schema_privilege('authenticated','private','usage'),'authenticated still has no private schema usage');
select is((select count(*) from public.media_assets where storage_path like '%60000000-0000-0000-0000-000000000003%' and moderation_status='rejected'),1::bigint,'rejected metadata remains for audit trail');

select * from finish();
rollback;
