begin;
select plan(5);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token)
values('00000000-0000-0000-0000-000000000000','41000000-0000-0000-0000-000000000001','authenticated','authenticated','media-hardening@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');
update private.user_identity set date_of_birth=(current_date-interval '25 years')::date,age_verified_at=now(),age_verification_method='self_declared',terms_version='2026-07',terms_accepted_at=now(),community_rules_version='2026-07',community_rules_accepted_at=now(),account_status='active' where user_id='41000000-0000-0000-0000-000000000001';
update public.profiles set profile_status='active',username='media_hardened',display_name='Media hardened' where id='41000000-0000-0000-0000-000000000001';

insert into public.media_assets(id,owner_id,storage_bucket,storage_path,mime_type,file_size_bytes,width,height,visibility,moderation_status)
values('61000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','kyc-private','41000000-0000-0000-0000-000000000001/61000000-0000-0000-0000-000000000001/document.pdf','application/pdf',1000,null,null,'kyc','pending_upload');
insert into public.media_assets(id,owner_id,storage_bucket,storage_path,mime_type,file_size_bytes,width,height,visibility,moderation_status,uploaded_at,rejected_at)
values('61000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000001','pending-media','41000000-0000-0000-0000-000000000001/61000000-0000-0000-0000-000000000002/original.jpg','image/jpeg',1000,800,800,'private','rejected',now(),now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(public.can_view_media('61000000-0000-0000-0000-000000000001'),false,'owner cannot use general media access for KYC');
select lives_ok($$select public.delete_my_media('61000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000001')$$,'owner soft-deletes media');
select is((select moderation_status::text from public.media_assets where id='61000000-0000-0000-0000-000000000002'),'deleted','deleted media is no longer active');
select is((select count(*) from private.media_moderation_events where media_id='61000000-0000-0000-0000-000000000002' and reason_code='user_deleted'),1::bigint,'owner deletion has immutable audit event');
select lives_ok($$select public.delete_my_media('61000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000001')$$,'same deletion request is idempotent');

select * from finish();
rollback;
