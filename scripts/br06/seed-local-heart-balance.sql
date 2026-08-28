-- BR-06 local-only economy fixture.
-- Keep purchase and withdrawal acceptance data on canonical economy paths so the browser
-- exercises real heart lots, gift reward positions, withdrawal holds, and cancel releases.
do $$
declare
  v_viewer_id uuid;
  v_creator_id uuid;
  v_moderator_id uuid;
begin
  select u.id into v_viewer_id from auth.users u where u.email = 'br06.viewer@example.test';
  select u.id into v_creator_id from auth.users u where u.email = 'br06.creator@example.test';
  select u.id into v_moderator_id from auth.users u where u.email = 'br06.moderator@example.test';

  if v_viewer_id is null or v_creator_id is null or v_moderator_id is null then
    raise exception 'BR-06 withdrawal fixture actors missing before economy seed';
  end if;

  -- Preserve the existing viewer top-up fixture used by Balance/VietQR browser tests.
  perform public.record_verified_play_purchase(
    v_viewer_id,
    'myfan_hearts_100',
    repeat('6', 64),
    'BR06-LOCAL-HEART-100',
    encode(extensions.digest(v_viewer_id::text, 'sha256'), 'hex'),
    'VN',
    true,
    '00000000-0000-4000-8000-000000000606'::uuid,
    null
  );

  -- Fund the Diamond sender through the same verified-purchase ledger, then transfer a
  -- 20-heart gift to the Viewer so the recipient reward is exactly 14 hearts at 70%.
  perform public.record_verified_play_purchase(
    v_creator_id,
    'myfan_hearts_100',
    repeat('7', 64),
    'BR06-LOCAL-WITHDRAW-SENDER-100',
    encode(extensions.digest(v_creator_id::text, 'sha256'), 'hex'),
    'VN',
    true,
    '00000000-0000-4000-8000-000000000607'::uuid,
    null
  );

  insert into private.kyc_profiles(
    user_id,legal_name_ciphertext,document_type,document_number_ciphertext,document_number_last4,country_code,
    status,submission_request_id,submitted_at,reviewed_at,reviewed_by,expires_at
  ) values(
    v_viewer_id,
    'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBB','national_id',
    'v1.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDD','1234','VN',
    'approved','00000000-0000-4000-8000-000000000608'::uuid,now(),now(),v_moderator_id,now()+interval '5 years'
  )
  on conflict(user_id) do update set
    status='approved',reviewed_at=now(),reviewed_by=v_moderator_id,expires_at=now()+interval '5 years',
    rejection_reason_code=null,updated_at=now();

  insert into private.bank_accounts(
    id,user_id,bank_code,account_number_ciphertext,account_number_last4,account_holder_ciphertext,
    status,is_default,submission_request_id,verified_at,verified_by
  ) values(
    '00000000-0000-4000-8000-000000000609'::uuid,v_viewer_id,'VCB',
    'v1.EEEEEEEEEEEEEEEE.FFFFFFFFFFFFFFFF','1234','v1.GGGGGGGGGGGGGGGG.HHHHHHHHHHHHHHHH',
    'verified',true,'00000000-0000-4000-8000-000000000610'::uuid,now(),v_moderator_id
  )
  on conflict(id) do update set
    status='verified',is_default=true,verified_at=now(),verified_by=v_moderator_id,deleted_at=null,updated_at=now();

  update private.app_config
  set value_json='true'::jsonb,updated_at=now()
  where key='luxy_member_gifts_enabled';
end
$$;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',(select id::text from auth.users where email='br06.creator@example.test'),
    'role','authenticated'
  )::text,
  true
);
select *
from public.send_luxy_gift(
  (select id from auth.users where email='br06.viewer@example.test'),
  (select id from public.gift_catalog where display_hearts=20 and is_active order by sort_order,id limit 1),
  1,
  '00000000-0000-4000-8000-000000000611'::uuid,
  null,
  null
);
commit;

update private.creator_reward_positions
set available_at=now()-interval '1 second'
where creator_id=(select id from auth.users where email='br06.viewer@example.test');

select private.release_due_luxy_rewards_for(
  (select id from auth.users where email='br06.viewer@example.test'),
  500
);

do $$
declare
  v_viewer_id uuid;
  v_available bigint;
begin
  select u.id into v_viewer_id from auth.users u where u.email='br06.viewer@example.test';
  select cea.available_units into v_available
  from private.creator_earning_accounts cea
  where cea.creator_id=v_viewer_id;

  if v_available <> 1400 then
    raise exception 'BR-06 OPT-12 fixture expected 1400 available reward units, got %', coalesce(v_available,-1);
  end if;
  if not exists(select 1 from private.kyc_profiles kp where kp.user_id=v_viewer_id and kp.status='approved') then
    raise exception 'BR-06 OPT-12 approved KYC fixture missing';
  end if;
  if not exists(select 1 from private.bank_accounts ba where ba.user_id=v_viewer_id and ba.status='verified' and ba.deleted_at is null) then
    raise exception 'BR-06 OPT-12 verified bank fixture missing';
  end if;
  if coalesce(private.config_boolean('withdrawal_requests_enabled'),false) is not true then
    raise exception 'BR-06 OPT-12 withdrawal release switch missing';
  end if;
end
$$;
