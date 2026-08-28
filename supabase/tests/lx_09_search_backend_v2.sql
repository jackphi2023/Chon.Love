begin;

select plan(32);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','19000000-0000-0000-0000-000000000001','authenticated','authenticated','lx09-viewer@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','19000000-0000-0000-0000-000000000002','authenticated','authenticated','lx09-near@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','19000000-0000-0000-0000-000000000003','authenticated','authenticated','lx09-far@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','19000000-0000-0000-0000-000000000004','authenticated','authenticated','lx09-nolocation@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','19000000-0000-0000-0000-000000000005','authenticated','authenticated','lx09-blocked@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity
set date_of_birth=case user_id
      when '19000000-0000-0000-0000-000000000001' then (current_date-interval '35 years')::date
      when '19000000-0000-0000-0000-000000000002' then (current_date-interval '29 years')::date
      when '19000000-0000-0000-0000-000000000003' then (current_date-interval '31 years')::date
      when '19000000-0000-0000-0000-000000000004' then (current_date-interval '27 years')::date
      else (current_date-interval '30 years')::date
    end,
    age_verified_at=now(),
    age_verification_method='self_declared',
    terms_version='terms-2026-07-30-v1',terms_accepted_at=now(),
    community_rules_version='community-2026-07-30-v1',community_rules_accepted_at=now(),
    account_status='active'
where user_id::text like '19000000-0000-0000-0000-00000000000%';

update public.profiles p
set profile_status='active',
    discovery_enabled=true,
    nearby_enabled=true,
    username=case p.id
      when '19000000-0000-0000-0000-000000000001' then 'lx09_viewer'
      when '19000000-0000-0000-0000-000000000002' then 'lx09_near'
      when '19000000-0000-0000-0000-000000000003' then 'lx09_far'
      when '19000000-0000-0000-0000-000000000004' then 'lx09_no_location'
      else 'lx09_blocked' end,
    display_name=case p.id
      when '19000000-0000-0000-0000-000000000002' then 'Lan Fine Dining'
      when '19000000-0000-0000-0000-000000000003' then 'Mai Travel'
      when '19000000-0000-0000-0000-000000000004' then 'An Private Location'
      else 'LX09 member' end,
    gender=case when p.id='19000000-0000-0000-0000-000000000001' then 'male'::public.gender_identity else 'female'::public.gender_identity end,
    interested_in=case when p.id='19000000-0000-0000-0000-000000000001' then 'female'::public.dating_interest else 'male'::public.dating_interest end,
    province_id=case
      when p.id='19000000-0000-0000-0000-000000000003' then (select id from public.administrative_areas where country_code='VN' and code='01')
      else (select id from public.administrative_areas where country_code='VN' and code='79') end,
    headline=case
      when p.id='19000000-0000-0000-0000-000000000002' then 'Yêu ẩm thực cao cấp'
      when p.id='19000000-0000-0000-0000-000000000003' then 'Sẵn sàng du lịch'
      else null end,
    bio=case when p.id='19000000-0000-0000-0000-000000000002' then 'Tìm kết nối nghiêm túc tại Sài Gòn' else null end,
    height_cm=case when p.id='19000000-0000-0000-0000-000000000002' then 165 else 170 end,
    weight_kg=case when p.id='19000000-0000-0000-0000-000000000002' then 52 else 58 end,
    relationship_status=case when p.id='19000000-0000-0000-0000-000000000002' then 'single'::public.relationship_status else 'divorced'::public.relationship_status end,
    children_status=case when p.id='19000000-0000-0000-0000-000000000002' then 'no_children'::public.children_status else 'has_children'::public.children_status end,
    smoking_status=case when p.id='19000000-0000-0000-0000-000000000002' then 'never'::public.smoking_status else 'socially'::public.smoking_status end,
    drinking_status=case when p.id='19000000-0000-0000-0000-000000000002' then 'socially'::public.drinking_status else 'never'::public.drinking_status end,
    education_level=case when p.id='19000000-0000-0000-0000-000000000002' then 'masters'::public.education_level else 'bachelors'::public.education_level end,
    occupation=case when p.id='19000000-0000-0000-0000-000000000002' then 'Kiến trúc sư' else 'Quản lý' end,
    looking_for=case when p.id='19000000-0000-0000-0000-000000000002' then 'Lâu dài và cùng trải nghiệm ẩm thực.' else 'Bạn đồng hành du lịch.' end,
    lifestyle_tags=case when p.id='19000000-0000-0000-0000-000000000002'
      then array['fine_dining','long_term']::public.profile_lifestyle_tag[]
      else array['ready_to_travel']::public.profile_lifestyle_tag[] end,
    languages=case when p.id='19000000-0000-0000-0000-000000000002' then array['Tiếng Việt','English'] else array['Tiếng Việt'] end,
    interests=case when p.id='19000000-0000-0000-0000-000000000002' then array['Ẩm thực','Du lịch'] else array['Du lịch'] end,
    last_active_at=case
      when p.id='19000000-0000-0000-0000-000000000002' then now()-interval '2 minutes'
      when p.id='19000000-0000-0000-0000-000000000003' then now()-interval '30 minutes'
      else now()-interval '2 hours' end,
    created_at=case
      when p.id='19000000-0000-0000-0000-000000000003' then now()-interval '1 minute'
      when p.id='19000000-0000-0000-0000-000000000002' then now()-interval '2 days'
      else now()-interval '5 days' end
where p.id::text like '19000000-0000-0000-0000-00000000000%';

-- OPT-01: LX-09 fixtures model established discoverable members. Explicitly approve
-- their listing state so this suite continues testing search/filter/privacy behavior;
-- pending/review semantics are covered by opt_01_approval_contract.sql.
insert into private.member_profile_verifications(
  user_id,listing_status,listing_submitted_at,listing_reviewed_at,listing_reason_code
)
select id,'approved',now(),now(),'test_existing_member'
from auth.users
where id::text like '19000000-0000-0000-0000-00000000000%'
on conflict(user_id) do update
set listing_status='approved',
    listing_submitted_at=coalesce(private.member_profile_verifications.listing_submitted_at,excluded.listing_submitted_at),
    listing_reviewed_at=coalesce(private.member_profile_verifications.listing_reviewed_at,excluded.listing_reviewed_at),
    listing_reason_code=coalesce(private.member_profile_verifications.listing_reason_code,excluded.listing_reason_code),
    updated_at=now();

select ok(
  has_function_privilege(
    'authenticated',
    'public.search_luxy_profiles_v2(text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated members can execute Search V2'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.search_luxy_profiles_v2(text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text,integer,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot execute Search V2'
);
select ok(
  position('date_of_birth' in lower(pg_get_function_result('public.search_luxy_profiles_v2(text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text,integer,integer)'::regprocedure)))=0
  and position('latitude' in lower(pg_get_function_result('public.search_luxy_profiles_v2(text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text,integer,integer)'::regprocedure)))=0
  and position('longitude' in lower(pg_get_function_result('public.search_luxy_profiles_v2(text,bigint,numeric,smallint,smallint,public.gender_identity[],smallint,smallint,smallint,smallint,public.relationship_status[],public.children_status[],public.smoking_status[],public.drinking_status[],public.education_level[],public.profile_lifestyle_tag[],text[],text[],boolean,boolean,text,text,text,text,integer,integer)'::regprocedure)))=0,
  'Search V2 result signature exposes no DOB or exact coordinates'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"19000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.set_my_location(10.7769,106.7009,50,now(),'device_foreground')$$,'viewer location can be set');
select set_config('request.jwt.claims','{"sub":"19000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.set_my_location(10.7820,106.7050,50,now(),'device_foreground')$$,'near candidate location can be set');
select set_config('request.jwt.claims','{"sub":"19000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.set_my_location(21.0278,105.8342,80,now(),'device_foreground')$$,'far candidate location can be set');
select set_config('request.jwt.claims','{"sub":"19000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
select lives_ok($$select public.set_my_location(10.7900,106.7100,60,now(),'device_foreground')$$,'blocked candidate location can be set');
select set_config('request.jwt.claims','{"sub":"19000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

select is((select count(*) from public.search_luxy_profiles_v2()),4::bigint,'default Search V2 returns matching discoverable candidates before blocking');
select is((select id from public.search_luxy_profiles_v2() limit 1),'19000000-0000-0000-0000-000000000002'::uuid,'distance sort ranks near candidate first across Vietnam');
select is((select id from public.search_luxy_profiles_v2() offset 3 limit 1),'19000000-0000-0000-0000-000000000004'::uuid,'candidate without shared location ranks after located candidates');
select ok((select distance_km between 0.1 and 2.0 from public.search_luxy_profiles_v2() where id='19000000-0000-0000-0000-000000000002'),'distance is returned only as rounded kilometres');
select ok((select distance_km > 100 from public.search_luxy_profiles_v2() where id='19000000-0000-0000-0000-000000000003'),'distance works across provinces instead of same-province-only discovery');
select is((select count(*) from public.search_luxy_profiles_v2(p_max_distance_km=>5)),2::bigint,'max distance excludes far and missing-location candidates');
select is((select count(*) from public.search_luxy_profiles_v2(p_province_id=>(select id from public.administrative_areas where country_code='VN' and code='01'))),1::bigint,'province filter uses canonical 34-province IDs');
select is((select count(*) from public.search_luxy_profiles_v2(p_min_age=>29::smallint,p_max_age=>29::smallint)),1::bigint,'age filtering uses private DOB but returns only derived age');
select is((select count(*) from public.search_luxy_profiles_v2(p_min_height_cm=>160::smallint,p_max_height_cm=>166::smallint,p_min_weight_kg=>50::smallint,p_max_weight_kg=>54::smallint)),1::bigint,'height and weight filters compose correctly');
select is((select count(*) from public.search_luxy_profiles_v2(p_relationship_statuses=>array['single']::public.relationship_status[],p_children_statuses=>array['no_children']::public.children_status[])),1::bigint,'relationship and children filters compose correctly');
select is((select count(*) from public.search_luxy_profiles_v2(p_smoking_statuses=>array['never']::public.smoking_status[],p_drinking_statuses=>array['socially']::public.drinking_status[],p_education_levels=>array['masters']::public.education_level[])),1::bigint,'lifestyle and education filters compose correctly');
select is((select count(*) from public.search_luxy_profiles_v2(p_lifestyle_tags=>array['fine_dining','long_term']::public.profile_lifestyle_tag[])),1::bigint,'all requested Luxy lifestyle tags are required');
select is((select count(*) from public.search_luxy_profiles_v2(p_languages=>array['english']::text[],p_interests=>array['ẩm thực']::text[])),1::bigint,'language and interest matching is case-insensitive');
select is((select count(*) from public.search_luxy_profiles_v2(p_occupation_text=>'trúc'::text)),1::bigint,'occupation text filter searches public occupation only');
select is((select count(*) from public.search_luxy_profiles_v2(p_profile_text=>'nghiêm túc'::text)),1::bigint,'profile text filter searches public member copy');
select is((select count(*) from public.search_luxy_profiles_v2(p_online_now=>true)),1::bigint,'online-now filter derives a bounded recent-activity state');
select is((select count(*) from public.search_luxy_profiles_v2(p_has_photo=>false)),4::bigint,'has-photo filter can explicitly select profiles without visible photos');
select is((select id from public.search_luxy_profiles_v2(p_sort=>'recent') limit 1),'19000000-0000-0000-0000-000000000002'::uuid,'recent sort uses last_active_at');
select is((select id from public.search_luxy_profiles_v2(p_sort=>'newest') limit 1),'19000000-0000-0000-0000-000000000003'::uuid,'newest sort uses member creation time');
select is((select count(*) from public.search_luxy_profiles_v2(p_limit=>2,p_offset=>1)),2::bigint,'pagination is bounded and deterministic');

select lives_ok($$select public.block_user('19000000-0000-0000-0000-000000000005','search privacy')$$,'viewer can block a candidate');
select is((select count(*) from public.search_luxy_profiles_v2() where id='19000000-0000-0000-0000-000000000005'),0::bigint,'blocked profiles are excluded from Search V2');
select throws_ok($$select * from public.search_luxy_profiles_v2(p_sort=>'popular')$$,'22023','invalid_search_sort','unsupported sort values are rejected');
select throws_ok($$select * from public.search_luxy_profiles_v2(p_min_age=>40::smallint,p_max_age=>20::smallint)$$,'22023','invalid_search_age_range','invalid age ranges are rejected');
select throws_ok($$select * from public.search_luxy_profiles_v2(p_max_distance_km=>4000)$$,'22023','invalid_search_distance','unbounded distance inputs are rejected');

select * from finish();
rollback;