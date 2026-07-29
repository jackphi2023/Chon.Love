begin;
select plan(33);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values
('00000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000001','authenticated','authenticated','social-a@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000002','authenticated','authenticated','social-b@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000003','authenticated','authenticated','social-c@example.test','','{"provider":"google","providers":["google"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000004','authenticated','authenticated','social-d@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set
 date_of_birth=(current_date-interval '25 years')::date,
 age_verified_at=now(),age_verification_method='self_declared',
 terms_version='2026-07',terms_accepted_at=now(),
 community_rules_version='2026-07',community_rules_accepted_at=now(),
 account_status='active'
where user_id::text like '20000000-0000-0000-0000-00000000000%';

update public.profiles set profile_status='active',discovery_enabled=true,nearby_enabled=true,
 username=case id
  when '20000000-0000-0000-0000-000000000001' then 'social_a'
  when '20000000-0000-0000-0000-000000000002' then 'social_b'
  when '20000000-0000-0000-0000-000000000003' then 'social_c'
  else 'social_d' end,
 display_name='Session 7 test'
where id::text like '20000000-0000-0000-0000-00000000000%';

select ok((select relrowsecurity from pg_class where oid='private.user_locations'::regclass),'RLS enabled on exact user locations');
select has_index('private','user_locations','user_locations_location_gist','exact location has GiST index');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select * from private.user_locations$$,'42501',null,'authenticated client cannot select exact locations');
select throws_ok($$select public.set_my_location(91,106.69,50,now(),'device_foreground')$$,'22023','invalid_coordinates','invalid latitude is rejected');
select lives_ok($$select public.set_my_location(10.77,106.69,50,now(),'device_foreground')$$,'A can set only its own location');
reset role;
select is((select count(*) from private.user_locations where user_id='20000000-0000-0000-0000-000000000001'),1::bigint,'set_my_location stores one row for A');
select ok(position('latitude' in lower(pg_get_function_result('public.find_nearby_profiles(integer,integer,uuid)'::regprocedure)))=0 and position('longitude' in lower(pg_get_function_result('public.find_nearby_profiles(integer,integer,uuid)'::regprocedure)))=0 and position('distance_meters' in lower(pg_get_function_result('public.find_nearby_profiles(integer,integer,uuid)'::regprocedure)))=0,'Nearby result exposes no coordinates or exact distance');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.set_my_location(10.77,106.71,60,now(),'device_foreground')$$,'B location accepted');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.set_my_location(10.77,106.78,80,now(),'device_approximate')$$,'C approximate location accepted');
reset role;

insert into private.user_locations(user_id,location,accuracy_meters,captured_at,consented_at,is_enabled,source,expires_at)
values('20000000-0000-0000-0000-000000000004',extensions.st_setsrid(extensions.st_makepoint(106.70,10.77),4326)::extensions.geography,50,now()-interval '10 days',now()-interval '10 days',true,'device_foreground',now()-interval '3 days');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.find_nearby_profiles(8000,20,null)),1::bigint,'8 km Nearby includes B but excludes C');
select is((select count(*) from public.find_nearby_profiles(15000,20,null)),2::bigint,'15 km Nearby includes B and C');
select is((select count(*) from public.find_nearby_profiles(15000,20,null) where id='20000000-0000-0000-0000-000000000004'),0::bigint,'stale location is excluded');
select lives_ok($$select public.block_user('20000000-0000-0000-0000-000000000002','safety')$$,'A can block B');
select is((select count(*) from public.find_nearby_profiles(8000,20,null)),0::bigint,'blocked B is excluded from Nearby');
select throws_ok($$select public.send_friend_request('20000000-0000-0000-0000-000000000001','hello')$$,'22023','invalid_friend_target','self friendship is rejected');
select lives_ok($$select public.unblock_user('20000000-0000-0000-0000-000000000002')$$,'A can unblock B');
select lives_ok($$select public.send_friend_request('20000000-0000-0000-0000-000000000002','Hello from A')$$,'A can send B a friend request');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.send_friend_request('20000000-0000-0000-0000-000000000001','reverse')$$,'23505','active_friendship_exists','reverse active duplicate is rejected');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.respond_to_friend_request((select id from public.friendships where requester_id='20000000-0000-0000-0000-000000000001' and addressee_id='20000000-0000-0000-0000-000000000002'),true)$$,'42501','pending_request_not_available','requester cannot accept its own request');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.respond_to_friend_request((select id from public.friendships where requester_id='20000000-0000-0000-0000-000000000001' and addressee_id='20000000-0000-0000-0000-000000000002'),true)$$,'addressee can accept request');
reset role;
select is((select count(*) from public.conversations c join public.friendships f on f.id=c.friendship_id where f.pair_low_id='20000000-0000-0000-0000-000000000001' and f.pair_high_id='20000000-0000-0000-0000-000000000002'),1::bigint,'accepted friendship creates one direct conversation');
select is((select count(*) from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id join public.friendships f on f.id=c.friendship_id where f.pair_low_id='20000000-0000-0000-0000-000000000001' and f.pair_high_id='20000000-0000-0000-0000-000000000002'),2::bigint,'direct conversation contains both friends');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.send_friend_request('20000000-0000-0000-0000-000000000003','pending chat test')$$,'A creates a pending request to C');
reset role;
insert into public.conversations(friendship_id) select id from public.friendships where requester_id='20000000-0000-0000-0000-000000000001' and addressee_id='20000000-0000-0000-0000-000000000003';
insert into public.conversation_members(conversation_id,user_id)
select c.id,u.id from public.conversations c join public.friendships f on f.id=c.friendship_id cross join lateral(values(f.requester_id),(f.addressee_id)) u(id)
where f.requester_id='20000000-0000-0000-0000-000000000001' and f.addressee_id='20000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.send_message((select c.id from public.conversations c join public.friendships f on f.id=c.friendship_id where f.addressee_id='20000000-0000-0000-0000-000000000003'),'not yet friends','30000000-0000-0000-0000-000000000001')$$,'42501','accepted_friendship_required','chat is rejected before friendship acceptance');
select lives_ok($$select public.send_message((select c.id from public.conversations c join public.friendships f on f.id=c.friendship_id where f.addressee_id='20000000-0000-0000-0000-000000000002'),'hello B','30000000-0000-0000-0000-000000000002')$$,'accepted friend can send a message');
select lives_ok($$select public.send_message((select c.id from public.conversations c join public.friendships f on f.id=c.friendship_id where f.addressee_id='20000000-0000-0000-0000-000000000002'),'hello B duplicate','30000000-0000-0000-0000-000000000002')$$,'duplicate client message id is idempotent');
reset role;
select is((select count(*) from public.messages where sender_id='20000000-0000-0000-0000-000000000001' and client_message_id='30000000-0000-0000-0000-000000000002'),1::bigint,'client message id prevents duplicate rows');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.messages),0::bigint,'user outside conversation cannot read messages');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.block_user('20000000-0000-0000-0000-000000000001','harassment')$$,'B blocks A and closes active friendship');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.send_message((select c.id from public.conversations c join public.friendships f on f.id=c.friendship_id where f.pair_low_id='20000000-0000-0000-0000-000000000001' and f.pair_high_id='20000000-0000-0000-0000-000000000002'),'blocked','30000000-0000-0000-0000-000000000003')$$,'42501',null,'blocked relationship cannot send messages');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.create_report('20000000-0000-0000-0000-000000000001',null,null,'spam','test report','{}'::jsonb)$$,'adult user can submit a report');
select throws_ok($$select * from public.reports$$,'42501',null,'client cannot read internal report rows directly');
reset role;
select is((select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('friendships','conversation_members','messages')),3::bigint,'Realtime includes only the three Session 7 user-facing tables');

select * from finish();
rollback;
