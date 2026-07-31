begin;

select plan(78);

create temporary table br05_state (
  key text primary key,
  value uuid not null
) on commit drop;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,
  reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','4c000000-0000-0000-0000-000000000001','authenticated','authenticated','br05-creator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4c000000-0000-0000-0000-000000000002','authenticated','authenticated','br05-friend@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4c000000-0000-0000-0000-000000000003','authenticated','authenticated','br05-fan@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4c000000-0000-0000-0000-000000000004','authenticated','authenticated','br05-stranger@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','4c000000-0000-0000-0000-000000000005','authenticated','authenticated','br05-moderator@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set
  date_of_birth=(current_date-interval '25 years')::date,
  age_verified_at=now(),
  age_verification_method='self_declared',
  terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),
  terms_accepted_at=now(),
  community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),
  community_rules_accepted_at=now(),
  account_status='active'
where user_id::text like '4c000000-0000-0000-0000-00000000000%';

update public.profiles set
  profile_status='active',
  discovery_enabled=true,
  nearby_enabled=false,
  province_id=1,
  last_active_at=now(),
  username=case id
    when '4c000000-0000-0000-0000-000000000001' then 'br05_creator'
    when '4c000000-0000-0000-0000-000000000002' then 'br05_friend'
    when '4c000000-0000-0000-0000-000000000003' then 'br05_fan'
    when '4c000000-0000-0000-0000-000000000004' then 'br05_stranger'
    else 'br05_moderator'
  end,
  display_name=case id
    when '4c000000-0000-0000-0000-000000000001' then 'BR05 Creator'
    when '4c000000-0000-0000-0000-000000000002' then 'BR05 Friend'
    when '4c000000-0000-0000-0000-000000000003' then 'BR05 Fan'
    when '4c000000-0000-0000-0000-000000000004' then 'BR05 Stranger'
    else 'BR05 Moderator'
  end
where id::text like '4c000000-0000-0000-0000-00000000000%';

update public.profiles set is_creator=true where id='4c000000-0000-0000-0000-000000000001';

insert into public.creator_profiles(
  user_id,creator_status,creator_bio,fan_threshold_units,approved_at,activity_visibility
) values (
  '4c000000-0000-0000-0000-000000000001','approved','BR05 creator privacy fixture',1000,now(),'public'
);

insert into private.user_roles(user_id,role,granted_by)
values('4c000000-0000-0000-0000-000000000005','moderator','4c000000-0000-0000-0000-000000000005')
on conflict do nothing;

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,media_type,mime_type,file_size_bytes,width,height,sha256,
  visibility,moderation_status,uploaded_at,approved_at,approved_by
) values
('4c100000-0000-4000-8000-000000000001','4c000000-0000-0000-0000-000000000001','profile-media','4c000000-0000-0000-0000-000000000001/4c100000-0000-4000-8000-000000000001/activity.jpg','image','image/jpeg',1024,1200,1200,repeat('a',64),'private','approved',now(),now(),'4c000000-0000-0000-0000-000000000005'),
('4c100000-0000-4000-8000-000000000002','4c000000-0000-0000-0000-000000000001','profile-media','4c000000-0000-0000-0000-000000000001/4c100000-0000-4000-8000-000000000002/public-album.jpg','image','image/jpeg',1024,1000,1000,repeat('b',64),'public','approved',now(),now(),'4c000000-0000-0000-0000-000000000005'),
('4c100000-0000-4000-8000-000000000003','4c000000-0000-0000-0000-000000000001','profile-media','4c000000-0000-0000-0000-000000000001/4c100000-0000-4000-8000-000000000003/fan-album.jpg','image','image/jpeg',1024,1000,1000,repeat('c',64),'fan','approved',now(),now(),'4c000000-0000-0000-0000-000000000005');

select is(
  (select count(*)::integer from public.profiles where id::text like '4c000000-0000-0000-0000-00000000000%'),
  5,
  'five isolated adult Creator Activity actors are available'
);

select ok(
  exists(select 1 from public.creator_profiles where user_id='4c000000-0000-0000-0000-000000000001' and creator_status='approved' and activity_visibility='public'),
  'the fixture creator is approved with public Activity visibility'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

insert into br05_state(key,value)
select 'text_post',(public.create_creator_activity_post('BR05 public text',null,null,'public',null)).id;

select ok(
  exists(select 1 from public.creator_posts where id=(select value from br05_state where key='text_post') and moderation_status='pending_review' and content_type='text'),
  'creator submits a pending text Activity post'
);

insert into br05_state(key,value)
select 'video_post',(public.create_creator_activity_post('BR05 public video','https://youtu.be/dQw4w9WgXcQ',null,'public',null)).id;

select ok(
  exists(select 1 from public.creator_posts where id=(select value from br05_state where key='video_post') and moderation_status='pending_review' and content_type='video' and external_provider='youtube' and external_video_id='dQw4w9WgXcQ'),
  'creator submits a normalized pending video Activity post'
);

insert into br05_state(key,value)
select 'image_post',(public.create_creator_activity_post('BR05 public image',null,'4c100000-0000-4000-8000-000000000001','public',null)).id;

select ok(
  exists(select 1 from public.creator_post_media where post_id=(select value from br05_state where key='image_post') and media_id='4c100000-0000-4000-8000-000000000001'),
  'creator submits a pending image Activity post linked to owned private media'
);

select is(
  (select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),
  3,
  'owner can inspect all three pending posts'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
end $$;

select is(
  (select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),
  0,
  'stranger cannot see pending Activity posts'
);

select throws_ok(
  $$select public.moderate_creator_activity_post((select value from br05_state where key='text_post'),'approve','approved',null,'4c200000-0000-4000-8000-000000000001')$$,
  '42501',
  'moderator_role_required',
  'ordinary users cannot moderate Creator Activity'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
end $$;

select is(
  (select count(*)::integer from public.list_creator_activity_moderation_queue(50,0) q where q.creator_id='4c000000-0000-0000-0000-000000000001'),
  3,
  'moderator sees all three submitted posts in the queue'
);

select is(
  (public.moderate_creator_activity_post((select value from br05_state where key='text_post'),'approve','approved',null,'4c200000-0000-4000-8000-000000000002')).moderation_status::text,
  'approved',
  'moderator approves the text post'
);

select is(
  (public.moderate_creator_activity_post((select value from br05_state where key='video_post'),'approve','approved',null,'4c200000-0000-4000-8000-000000000003')).moderation_status::text,
  'approved',
  'moderator approves the video post'
);

update public.creator_post_media set
  preview_path='4c000000-0000-0000-0000-000000000001/activity-preview.jpg',
  preview_width=600,
  preview_height=600,
  preview_status='ready'
where post_id=(select value from br05_state where key='image_post');

select is(
  (public.moderate_creator_activity_post((select value from br05_state where key='image_post'),'approve','approved',null,'4c200000-0000-4000-8000-000000000004')).moderation_status::text,
  'approved',
  'moderator approves the image after media and preview checks pass'
);

select is(
  (select count(*)::integer from public.creator_posts where creator_id='4c000000-0000-0000-0000-000000000001' and moderation_status='approved' and published_at is not null),
  3,
  'all three posts are published only after moderation'
);

do $$ begin
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where a.can_view and a.gate_reason='none' and a.activity_visibility='public'),
  'anonymous viewers receive public Activity access'
);

select is(
  (select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),
  3,
  'anonymous viewers can read all approved public Activity posts'
);

select is(
  (select count(*)::integer from public.list_creator_activity_album('br05_creator',24,0)),
  1,
  'anonymous viewers can read the public Activity-derived image album'
);

select ok(
  exists(select 1 from public.list_public_activity_highlights(12) h where h.creator_id='4c000000-0000-0000-0000-000000000001'),
  'public highlights include approved posts only while creator visibility is public'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where a.can_view and not a.is_friend and not a.is_fan),
  'authenticated stranger receives public Activity access'
);

select ok(
  exists(select 1 from public.get_creator_post_media_access((select value from br05_state where key='image_post')) m where m.media_id='4c100000-0000-4000-8000-000000000001'),
  'authorized public viewer can resolve original image access metadata'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select is(
  (select activity_visibility from public.set_my_creator_activity_visibility('friends')),
  'friends',
  'creator switches the whole Activity surface to friends privacy'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where not a.can_view and a.gate_reason='friend_required'),
  'stranger receives friend_required after privacy change'
);

select is((select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),0,'stranger feed is empty in friends mode');
select is((select count(*)::integer from public.list_creator_activity_album('br05_creator',24,0)),0,'stranger Activity album is empty in friends mode');

select ok(
  not exists(select 1 from public.list_public_activity_highlights(12) h where h.creator_id='4c000000-0000-0000-0000-000000000001'),
  'friends-only creator is removed from anonymous public highlights'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where not a.can_view and a.gate_reason='friend_required'),
  'future friend is denied before friendship acceptance'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

insert into br05_state(key,value)
select 'friendship',(public.send_friend_request('4c000000-0000-0000-0000-000000000002','BR05 privacy friendship')).id;

select ok((select value is not null from br05_state where key='friendship'),'creator creates a pending friendship for privacy testing');

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
end $$;

select is(
  (public.respond_to_friend_request((select value from br05_state where key='friendship'),true)).status::text,
  'accepted',
  'friend accepts the relationship'
);

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where a.can_view and a.is_friend and not a.is_fan),
  'accepted friend receives Activity access in friends mode'
);

select is((select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),3,'accepted friend reads all approved Activity posts');
select is((select count(*)::integer from public.list_creator_activity_album('br05_creator',24,0)),1,'accepted friend reads the Activity image album');

insert into public.fan_memberships(creator_id,fan_user_id,achieved_at,status)
values('4c000000-0000-0000-0000-000000000001','4c000000-0000-0000-0000-000000000003',now(),'active');

insert into public.fan_progress(creator_id,fan_user_id,lifetime_supported_units,eligible_units,threshold_units)
values('4c000000-0000-0000-0000-000000000001','4c000000-0000-0000-0000-000000000003',1000,1000,1000);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where a.can_view and a.is_fan and not a.is_friend),
  'active Fan also receives access while creator uses friends mode'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select is(
  (select activity_visibility from public.set_my_creator_activity_visibility('fans')),
  'fans',
  'creator switches the whole Activity surface to Fan-only privacy'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where not a.can_view and a.is_friend and not a.is_fan and a.gate_reason='fan_required'),
  'friend without Fan membership is denied in fans mode'
);

select is((select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),0,'friend feed is empty in fans mode');
select is((select count(*)::integer from public.list_creator_activity_album('br05_creator',24,0)),0,'friend Activity album is empty in fans mode');

select throws_ok(
  $$select public.report_creator_activity((select value from br05_state where key='text_post'),null,'post','privacy_probe','must not be allowed')$$,
  '42501',
  'activity_report_target_not_available',
  'viewer without Activity access cannot report a guessed private post UUID'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where a.can_view and a.is_fan and a.gate_reason='none'),
  'active Fan receives access in fans mode'
);

select is((select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),3,'active Fan reads all approved Activity posts');
select is((select count(*)::integer from public.list_creator_activity_album('br05_creator',24,0)),1,'active Fan reads the Activity image album');

insert into br05_state(key,value)
select 'post_report',public.report_creator_activity((select value from br05_state where key='text_post'),null,'post','harassment','visible post report');

select ok((select value is not null from br05_state where key='post_report'),'authorized Fan reports a visible Activity post');

select throws_ok(
  $$select public.report_creator_activity((select value from br05_state where key='text_post'),null,'post','harassment','duplicate')$$,
  '42901',
  'report_rate_limited',
  'duplicate visible Activity report is rate limited'
);

insert into br05_state(key,value)
select 'image_report',public.report_creator_activity((select value from br05_state where key='image_post'),'4c100000-0000-4000-8000-000000000001','image','other','visible image report');

select ok((select value is not null from br05_state where key='image_report'),'authorized Fan reports the visible Activity image');

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(public.block_user('4c000000-0000-0000-0000-000000000003','br05_activity_privacy'),'creator blocks the Fan');

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where not a.can_view and a.gate_reason='unavailable'),
  'blocked Fan receives unavailable Activity gate'
);

select is((select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),0,'blocked Fan feed is empty');

select throws_ok(
  $$select * from public.get_creator_post_media_access((select value from br05_state where key='image_post'))$$,
  '42501',
  'creator_activity_media_access_denied',
  'blocked Fan cannot resolve original Activity media'
);

select throws_ok(
  $$select public.report_creator_activity((select value from br05_state where key='video_post'),null,'external_link','other','blocked report')$$,
  '42501',
  'activity_report_target_not_available',
  'blocked Fan cannot report hidden Activity content'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(public.unblock_user('4c000000-0000-0000-0000-000000000003'),'creator unblocks the Fan');

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where a.can_view and a.is_fan),
  'Fan Activity access is restored after unblock while membership remains active'
);

update public.fan_memberships set status='revoked',revoked_at=now(),updated_at=now()
where creator_id='4c000000-0000-0000-0000-000000000001' and fan_user_id='4c000000-0000-0000-0000-000000000003';

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where not a.can_view and not a.is_fan and a.gate_reason='fan_required'),
  'revoked membership immediately closes Fan-only Activity access'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.get_creator_activity_access('br05_creator') a where a.can_view and a.is_owner),
  'creator owner always retains access to their own Activity'
);

select is((select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),3,'owner still sees all approved posts in fans mode');

update public.fan_memberships set status='active',revoked_at=null,updated_at=now()
where creator_id='4c000000-0000-0000-0000-000000000001' and fan_user_id='4c000000-0000-0000-0000-000000000003';

select is(
  (public.archive_creator_activity_post((select value from br05_state where key='text_post'))).moderation_status::text,
  'archived',
  'creator archives an approved text post'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select is((select count(*)::integer from public.list_creator_activity('br05_creator',20,null,null)),2,'archived post disappears from Fan feed');

select ok(
  not exists(select 1 from public.list_creator_activity('br05_creator',20,null,null) p where p.post_id=(select value from br05_state where key='text_post')),
  'archived post is not returned to non-owner viewers'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.list_creator_activity('br05_creator',20,null,null) p where p.post_id=(select value from br05_state where key='text_post') and p.moderation_status='archived' and p.is_owner),
  'owner retains audit visibility of the archived post'
);

insert into br05_state(key,value)
select 'rejected_post',(public.create_creator_activity_post('BR05 rejected post',null,null,'public',null)).id;

select ok((select value is not null from br05_state where key='rejected_post'),'creator submits a second text post for rejection testing');

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
end $$;

select is(
  (public.moderate_creator_activity_post((select value from br05_state where key='rejected_post'),'reject','policy_violation','BR05 E2E','4c200000-0000-4000-8000-000000000005')).moderation_status::text,
  'rejected',
  'moderator rejects the second text post'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select ok(
  not exists(select 1 from public.list_creator_activity('br05_creator',20,null,null) p where p.post_id=(select value from br05_state where key='rejected_post')),
  'rejected post never appears in Fan feed'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(
  exists(select 1 from public.list_creator_activity('br05_creator',20,null,null) p where p.post_id=(select value from br05_state where key='rejected_post') and p.moderation_status='rejected'),
  'owner can inspect the rejected post and moderation state'
);

select ok(public.delete_creator_activity_post((select value from br05_state where key='rejected_post')),'creator deletes the rejected post');

select ok(
  not exists(select 1 from public.list_creator_activity('br05_creator',20,null,null) p where p.post_id=(select value from br05_state where key='rejected_post')),
  'deleted post disappears even from owner Activity list'
);

select is(
  (select count(*)::integer from public.list_creator_activity_album('br05_creator',24,0)),
  1,
  'Activity album contains only the approved non-deleted image post'
);

insert into br05_state(key,value)
select 'public_album',(public.create_album('BR05 Public Album','public',null)).id;

select ok((select value is not null from br05_state where key='public_album'),'creator creates a public profile album');

insert into br05_state(key,value)
select 'fan_album',(public.create_album('BR05 Fan Album','fan',1000)).id;

select ok((select value is not null from br05_state where key='fan_album'),'creator creates a Fan profile album');

select ok(public.add_media_to_album((select value from br05_state where key='public_album'),'4c100000-0000-4000-8000-000000000002',0),'creator adds matching public media to public album');
select ok(public.add_media_to_album((select value from br05_state where key='fan_album'),'4c100000-0000-4000-8000-000000000003',0),'creator adds matching Fan media to Fan album');

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
end $$;

select is(
  (select count(*)::integer from public.list_profile_album_media('4c000000-0000-0000-0000-000000000001','public')),
  1,
  'active stranger can view approved media in the public profile album'
);

select is(
  (select count(*)::integer from public.list_profile_album_media('4c000000-0000-0000-0000-000000000001','fan')),
  0,
  'stranger cannot view Fan profile album media'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select is(
  (select count(*)::integer from public.list_profile_album_media('4c000000-0000-0000-0000-000000000001','fan')),
  1,
  'active Fan membership unlocks approved Fan profile album media'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(public.block_user('4c000000-0000-0000-0000-000000000003','br05_album_privacy'),'creator blocks the Fan for album privacy testing');

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select is(
  (select count(*)::integer from public.list_profile_album_media('4c000000-0000-0000-0000-000000000001','fan')),
  0,
  'blocking immediately hides Fan profile album media'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select ok(public.unblock_user('4c000000-0000-0000-0000-000000000003'),'creator unblocks the Fan after album privacy test');

select is(
  (public.set_album_active((select value from br05_state where key='fan_album'),false)).is_active,
  false,
  'creator deactivates the Fan album'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select is(
  (select count(*)::integer from public.list_profile_album_media('4c000000-0000-0000-0000-000000000001','fan')),
  0,
  'inactive Fan album is hidden even from an active Fan'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end $$;

select is(
  (public.set_album_active((select value from br05_state where key='fan_album'),true)).is_active,
  true,
  'creator reactivates the Fan album'
);

select ok(
  public.remove_media_from_album((select value from br05_state where key='fan_album'),'4c100000-0000-4000-8000-000000000003'),
  'creator removes media from the Fan album'
);

do $$ begin
  perform set_config('request.jwt.claims','{"sub":"4c000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
end $$;

select is(
  (select count(*)::integer from public.list_profile_album_media('4c000000-0000-0000-0000-000000000001','fan')),
  0,
  'removed media no longer appears in the Fan album'
);

select * from finish();
rollback;
