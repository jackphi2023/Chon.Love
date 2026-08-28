begin;
select plan(17);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000096',
  'authenticated','authenticated','chon-media-owner@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000097',
  'authenticated','authenticated','chon-media-viewer@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update private.user_identity
set date_of_birth = date '1995-01-01',
    age_verified_at = now(),
    age_verification_method = 'self_declared',
    terms_version = (select value_json #>> '{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at = now(),
    community_rules_version = (select value_json #>> '{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at = now(),
    account_status = 'active'
where user_id in ('10000000-0000-0000-0000-000000000096','10000000-0000-0000-0000-000000000097');

update public.profiles
set username = case when id='10000000-0000-0000-0000-000000000096' then 'chonmediaowner'::citext else 'chonmediaviewer'::citext end,
    display_name = case when id='10000000-0000-0000-0000-000000000096' then 'Media Owner' else 'Media Viewer' end,
    public_profile_code = case when id='10000000-0000-0000-0000-000000000096' then 'a1b2c3' else 'd4e5f6' end,
    province_id = (select min(id) from public.administrative_areas where country_code='VN' and is_active),
    profile_status = 'active',
    discovery_enabled = true
where id in ('10000000-0000-0000-0000-000000000096','10000000-0000-0000-0000-000000000097');

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,mime_type,file_size_bytes,width,height,
  visibility,moderation_status,uploaded_at,approved_at,approved_by
) values
(
  '10000000-0000-4000-8000-000000000096',
  '10000000-0000-0000-0000-000000000096',
  'profile-media','10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000096/approved.jpg',
  'image/jpeg',1024,800,800,'avatar','approved',now(),now(),'10000000-0000-0000-0000-000000000096'
),
(
  '10000000-0000-4000-8000-000000000097',
  '10000000-0000-0000-0000-000000000096',
  'pending-media','10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000097/original.jpg',
  'image/jpeg',1024,800,800,'avatar','pending_review',now(),null,null
),
(
  '10000000-0000-4000-8000-000000000098',
  '10000000-0000-0000-0000-000000000096',
  'pending-media','10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000098/original.jpg',
  'image/jpeg',1024,800,800,'public','pending_review',now(),null,null
);

insert into storage.objects(bucket_id,name,owner_id,metadata) values
(
  'profile-media',
  '10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000096/approved.jpg',
  '10000000-0000-0000-0000-000000000096',
  '{"mimetype":"image/jpeg","size":1024}'::jsonb
),
(
  'pending-media',
  '10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000097/original.jpg',
  '10000000-0000-0000-0000-000000000096',
  '{"mimetype":"image/jpeg","size":1024}'::jsonb
),
(
  'pending-media',
  '10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000098/original.jpg',
  '10000000-0000-0000-0000-000000000096',
  '{"mimetype":"image/jpeg","size":1024}'::jsonb
);

update public.profiles
set avatar_media_id='10000000-0000-4000-8000-000000000096'
where id='10000000-0000-0000-0000-000000000096';

select is(
  (select avatar_media_id from public.profiles where id='10000000-0000-0000-0000-000000000096'),
  '10000000-0000-4000-8000-000000000096'::uuid,
  'approved avatar may become the public profile avatar'
);

update public.profiles
set avatar_media_id='10000000-0000-4000-8000-000000000097'
where id='10000000-0000-0000-0000-000000000096';

select is(
  (select avatar_media_id from public.profiles where id='10000000-0000-0000-0000-000000000096'),
  '10000000-0000-4000-8000-000000000096'::uuid,
  'pending avatar cannot replace the approved public avatar'
);

select is(
  private.can_view_media_internal('10000000-0000-4000-8000-000000000096','10000000-0000-0000-0000-000000000097'),
  true,
  'other active member may view the selected approved avatar'
);
select is(
  private.can_view_media_internal('10000000-0000-4000-8000-000000000097','10000000-0000-0000-0000-000000000097'),
  false,
  'other member cannot view a pending avatar'
);
select is(
  private.can_view_media_internal('10000000-0000-4000-8000-000000000097','10000000-0000-0000-0000-000000000096'),
  true,
  'owner can still review their own pending avatar'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000096","role":"authenticated"}',true);
select is(
  (select count(*) from public.list_my_media() where id='10000000-0000-4000-8000-000000000097'),
  1::bigint,
  'owner media API returns their pending avatar so Profile Edit can render it immediately'
);
reset role;

-- Direct public sharing is independent from the member-controlled Connect toggle.
update public.profiles
set discovery_enabled=false
where id='10000000-0000-0000-0000-000000000096';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000097","role":"authenticated"}',true);
select is(
  (select count(*) from public.resolve_chon_member_route('chonmediaowner')),
  1::bigint,
  'authenticated route resolver still returns an eligible public profile when Connect discovery is off'
);
reset role;

set local role anon;
select is(
  (select count(*) from public.get_public_chon_profile_v2('a1b2c3')),
  1::bigint,
  'direct public profile remains available when the member disables Connect discovery'
);
reset role;

insert into private.chon_public_profile_moderation(user_id,admin_hidden,updated_at)
values('10000000-0000-0000-0000-000000000096',true,now())
on conflict(user_id) do update set admin_hidden=true,updated_at=now();

select is(
  private.luxy_listing_hidden('10000000-0000-0000-0000-000000000096'),
  true,
  'admin-hidden moderation state also excludes the member from Connect listing'
);

set local role anon;
select is(
  (select count(*) from public.get_public_chon_profile_v2('a1b2c3')),
  0::bigint,
  'admin safety hide suppresses the direct public profile'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000097","role":"authenticated"}',true);
select is(
  (select count(*) from public.resolve_chon_member_route('chonmediaowner')),
  0::bigint,
  'admin safety hide suppresses authenticated direct route resolution'
);
reset role;

update private.chon_public_profile_moderation
set admin_hidden=false,updated_at=now()
where user_id='10000000-0000-0000-0000-000000000096';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000097","role":"authenticated"}',true);
select is(
  (select count(*) from storage.objects where bucket_id='profile-media' and name='10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000096/approved.jpg'),
  1::bigint,
  'ordinary member Storage RLS exposes another active member approved avatar'
);
select is(
  (select count(*) from storage.objects where bucket_id='pending-media' and name='10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000097/original.jpg'),
  0::bigint,
  'ordinary member Storage RLS still hides another member pending avatar'
);
reset role;

insert into public.albums(id,owner_id,name,album_type,fan_threshold_units,is_active)
values('10000000-0000-4000-8000-000000000099','10000000-0000-0000-0000-000000000096','Ảnh công khai','public',0,true);
insert into public.album_media(album_id,media_id,sort_order)
values('10000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000098',0);

select is(
  private.can_view_media_internal('10000000-0000-4000-8000-000000000098','10000000-0000-0000-0000-000000000097'),
  false,
  'pending public album photo is hidden from other members'
);

update public.media_assets
set moderation_status='approved', approved_at=now(), approved_by='10000000-0000-0000-0000-000000000096', storage_bucket='profile-media',
    storage_path='10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000098/approved.jpg'
where id='10000000-0000-4000-8000-000000000098';
update storage.objects
set bucket_id='profile-media',
    name='10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000098/approved.jpg'
where bucket_id='pending-media'
  and name='10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000098/original.jpg';

select is(
  private.can_view_media_internal('10000000-0000-4000-8000-000000000098','10000000-0000-0000-0000-000000000097'),
  true,
  'approved public album photo becomes visible to other members'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000097","role":"authenticated"}',true);
select is(
  (select count(*) from storage.objects where bucket_id='profile-media' and name='10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000098/approved.jpg'),
  1::bigint,
  'ordinary member Storage RLS exposes another member approved public album photo'
);
reset role;

update public.media_assets
set moderation_status='approved', approved_at=now(), approved_by='10000000-0000-0000-0000-000000000096', storage_bucket='profile-media',
    storage_path='10000000-0000-0000-0000-000000000096/10000000-0000-4000-8000-000000000097/approved.jpg'
where id='10000000-0000-4000-8000-000000000097';
update public.profiles
set avatar_media_id='10000000-0000-4000-8000-000000000097'
where id='10000000-0000-0000-0000-000000000096';
select is(
  (select avatar_media_id from public.profiles where id='10000000-0000-0000-0000-000000000096'),
  '10000000-0000-4000-8000-000000000097'::uuid,
  'new avatar may replace the old avatar only after approval'
);

select * from finish();
rollback;
