begin;

select plan(19);

select ok(
  exists(
    select 1
    from pg_catalog.pg_class idx
    join pg_catalog.pg_namespace ns on ns.oid=idx.relnamespace
    join pg_catalog.pg_index meta on meta.indexrelid=idx.oid
    where ns.nspname='public'
      and idx.relname='moderation_cases_one_active_case_per_media_idx'
      and meta.indisunique
      and pg_get_expr(meta.indpred,meta.indrelid) like '%media_id IS NOT NULL%'
  ),
  'pending media active-case invariant has a partial unique index'
);

select ok(
  has_function_privilege(
    'service_role',
    'private.ensure_open_media_moderation_case(uuid,public.moderation_source)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.ensure_open_media_moderation_case(uuid,public.moderation_source)',
    'EXECUTE'
  ),
  'media-case repair helper is internal/service-role only'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,
  email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
(
  '00000000-0000-0000-0000-000000000000','32000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','opt02-owner@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','32000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','opt02-viewer@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
),
(
  '00000000-0000-0000-0000-000000000000','32000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','opt02-moderator@example.test','',
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''
);

update private.user_identity
set date_of_birth=date '1992-01-01',
    age_verified_at=now(),
    age_verification_method='self_declared',
    terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),
    terms_accepted_at=now(),
    community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),
    community_rules_accepted_at=now(),
    account_status='active'
where user_id in (
  '32000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000002',
  '32000000-0000-0000-0000-000000000003'
);

update public.profiles
set profile_status='active'::public.profile_status,
    discovery_enabled=true,
    nearby_enabled=false,
    province_id=(select min(id) from public.administrative_areas where country_code='VN' and is_active and parent_id is null),
    username=case id
      when '32000000-0000-0000-0000-000000000001' then 'opt02owner'
      when '32000000-0000-0000-0000-000000000002' then 'opt02viewer'
      else 'opt02moderator'
    end::citext,
    display_name=case id
      when '32000000-0000-0000-0000-000000000001' then 'OPT02 Owner'
      when '32000000-0000-0000-0000-000000000002' then 'OPT02 Viewer'
      else 'OPT02 Moderator'
    end
where id in (
  '32000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000002',
  '32000000-0000-0000-0000-000000000003'
);

insert into private.user_roles(user_id,role)
values('32000000-0000-0000-0000-000000000003','moderator')
on conflict do nothing;

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,media_type,mime_type,file_size_bytes,
  width,height,visibility,moderation_status,uploaded_at,approved_at,approved_by
) values (
  '32000000-0000-4000-8000-000000000101',
  '32000000-0000-0000-0000-000000000001',
  'profile-media',
  '32000000-0000-0000-0000-000000000001/32000000-0000-4000-8000-000000000101/approved-old.jpg',
  'image','image/jpeg',1024,800,1000,'avatar','approved',now()-interval '2 days',now()-interval '2 days',
  '32000000-0000-0000-0000-000000000003'
);

update public.profiles
set avatar_media_id='32000000-0000-4000-8000-000000000101'
where id='32000000-0000-0000-0000-000000000001';

insert into public.media_assets(
  id,owner_id,storage_bucket,storage_path,media_type,mime_type,file_size_bytes,
  width,height,visibility,moderation_status,uploaded_at
) values (
  '32000000-0000-4000-8000-000000000102',
  '32000000-0000-0000-0000-000000000001',
  'pending-media',
  '32000000-0000-0000-0000-000000000001/32000000-0000-4000-8000-000000000102/pending-new.jpg',
  'image','image/jpeg',1024,800,1000,'avatar','pending_review',now()
);

set constraints all immediate;

select is(
  (select count(*) from public.moderation_cases
   where media_id='32000000-0000-4000-8000-000000000102'
     and status in ('open','queued','in_review')),
  1::bigint,
  'new pending media automatically owns one active moderation case'
);

update public.media_assets
set moderation_status='pending_review'::public.media_moderation_status
where id='32000000-0000-4000-8000-000000000102';

select is(
  (select count(*) from public.moderation_cases
   where media_id='32000000-0000-4000-8000-000000000102'
     and status in ('open','queued','in_review')),
  1::bigint,
  'repeated pending transitions remain idempotent'
);

update public.profiles
set avatar_media_id='32000000-0000-4000-8000-000000000102'
where id='32000000-0000-0000-0000-000000000001';

select is(
  (select avatar_media_id from public.profiles where id='32000000-0000-0000-0000-000000000001'),
  '32000000-0000-4000-8000-000000000101'::uuid,
  'pending replacement cannot displace the previously approved public avatar'
);

select ok(
  private.can_view_media_internal(
    '32000000-0000-4000-8000-000000000102',
    '32000000-0000-0000-0000-000000000001'
  ),
  'owner can see their own pending replacement'
);

select ok(
  not private.can_view_media_internal(
    '32000000-0000-4000-8000-000000000102',
    '32000000-0000-0000-0000-000000000002'
  ),
  'other members cannot see a pending replacement'
);

select ok(
  private.can_view_media_internal(
    '32000000-0000-4000-8000-000000000101',
    '32000000-0000-0000-0000-000000000002'
  ),
  'other members continue to see the approved avatar'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"32000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.moderate_media(
    '32000000-0000-4000-8000-000000000102',
    'reject',
    'opt02_reject'
  )$$,
  'moderator can reject the pending replacement'
);

reset role;

select is(
  (select moderation_status::text from public.media_assets where id='32000000-0000-4000-8000-000000000102'),
  'rejected',
  'rejected replacement leaves moderation state explicit'
);

select is(
  (select avatar_media_id from public.profiles where id='32000000-0000-0000-0000-000000000001'),
  '32000000-0000-4000-8000-000000000101'::uuid,
  'rejection preserves the previously approved avatar'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"32000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.moderate_media(
    '32000000-0000-4000-8000-000000000102',
    'restore',
    'opt02_restore'
  )$$,
  'moderator can restore rejected media to review'
);

reset role;

select is(
  (select moderation_status::text from public.media_assets where id='32000000-0000-4000-8000-000000000102'),
  'pending_review',
  'restored media returns to pending review'
);

select is(
  (select count(*) from public.moderation_cases
   where media_id='32000000-0000-4000-8000-000000000102'
     and status in ('open','queued','in_review')),
  1::bigint,
  'restore creates exactly one fresh active review case after resolving the old case'
);

select is(
  (select avatar_media_id from public.profiles where id='32000000-0000-0000-0000-000000000001'),
  '32000000-0000-4000-8000-000000000101'::uuid,
  'restore still cannot displace the approved public avatar before approval'
);

update public.moderation_cases
set status='resolved'::public.moderation_case_status,
    resolved_at=now(),
    updated_at=now()
where media_id='32000000-0000-4000-8000-000000000102'
  and status in ('open','queued','in_review');

select is(
  (select count(*) from public.moderation_cases
   where media_id='32000000-0000-4000-8000-000000000102'
     and status in ('open','queued','in_review')),
  1::bigint,
  'resolving the only active case while media is pending self-heals the queue'
);

delete from public.moderation_cases
where media_id='32000000-0000-4000-8000-000000000102'
  and status in ('open','queued','in_review');

select is(
  (select count(*) from public.moderation_cases
   where media_id='32000000-0000-4000-8000-000000000102'
     and status in ('open','queued','in_review')),
  1::bigint,
  'deleting the only active case while media is pending self-heals the queue'
);

select is(
  (select count(*)
   from public.media_assets media
   left join public.moderation_cases mc
     on mc.media_id=media.id
    and mc.status in ('open','queued','in_review')
   where media.moderation_status='pending_review'
     and media.deleted_at is null
     and mc.id is null),
  0::bigint,
  'no pending media is orphaned from the moderation queue'
);

select is(
  (select count(*)
   from (
     select media_id
     from public.moderation_cases
     where media_id is not null
       and status in ('open','queued','in_review')
     group by media_id
     having count(*)>1
   ) duplicates),
  0::bigint,
  'no media owns duplicate active moderation cases'
);

select * from finish();
rollback;
