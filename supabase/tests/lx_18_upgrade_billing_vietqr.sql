begin;

select plan(16);

select ok(to_regclass('private.luxy_membership_checkout_snapshots') is not null,'LX-18 membership checkout snapshot table exists');
select ok(has_function_privilege('authenticated','public.get_my_luxy_membership_checkout(uuid)','execute'),'Authenticated member can read caller-owned membership checkout');
select ok(has_function_privilege('authenticated','public.list_my_luxy_membership_orders(integer,integer)','execute'),'Authenticated member can list own billing history');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'Authenticated client still has no private schema usage');
select ok(not has_table_privilege('authenticated','private.luxy_membership_checkout_snapshots','select'),'Authenticated client cannot read checkout snapshots directly');

-- BR-07 intentionally leaves real-money reconciliation disabled by default.
-- LX-18 enables it only inside this rollback-isolated contract so the positive
-- web-checkout path can be exercised without weakening the production gate.
update private.app_config
set value_json='true'::jsonb,
    updated_at=now()
where key='vietqr_web_payments_enabled';

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','28000000-0000-0000-0000-000000000001','authenticated','authenticated','lx18-buyer@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','28000000-0000-0000-0000-000000000002','authenticated','authenticated','lx18-other@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set
  date_of_birth=(current_date-interval '32 years')::date,
  age_verified_at=now(),age_verification_method='self_declared',
  terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),terms_accepted_at=now(),
  community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),community_rules_accepted_at=now(),
  account_status='active'
where user_id in ('28000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000002');

update public.profiles set
  profile_status='active',discovery_enabled=true,
  province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
  username=case when id='28000000-0000-0000-0000-000000000001' then 'lx18_buyer' else 'lx18_other' end,
  display_name=case when id='28000000-0000-0000-0000-000000000001' then 'LX18 Buyer' else 'LX18 Other' end,
  gender='male'::public.gender_identity,interested_in='female'::public.dating_interest,last_active_at=now()
where id in ('28000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"28000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select set_config('lx18.order_id',(
  select order_id::text
  from public.create_luxy_membership_order('diamond',3,'28000000-0000-4000-8000-000000000101','upgrade_billing_web')
),true);

select is(
  (select amount_due_vnd from public.get_my_luxy_membership_checkout(current_setting('lx18.order_id')::uuid)),
  12000000::bigint,
  'Checkout preserves LX-17 Diamond 3-period amount'
);
select is(
  (select heart_credit_display from public.get_my_luxy_membership_checkout(current_setting('lx18.order_id')::uuid)),
  192::bigint,
  'Checkout exposes 192 display hearts for discounted Diamond 3-period order'
);
select matches(
  (select transfer_content from public.get_my_luxy_membership_checkout(current_setting('lx18.order_id')::uuid)),
  '^LUXYLXM[0-9A-F]{12}$',
  'Membership checkout uses unique Luxy transfer content'
);
select matches(
  (select qr_image_url from public.get_my_luxy_membership_checkout(current_setting('lx18.order_id')::uuid)),
  '^https://img[.]vietqr[.]io/image/',
  'Membership checkout QR is served from trusted VietQR image host'
);
select is(
  (select bank_code from public.get_my_luxy_membership_checkout(current_setting('lx18.order_id')::uuid)),
  'VCB'::text,
  'Checkout snapshots configured receiving bank'
);
select is(
  (select count(*) from public.list_my_luxy_membership_orders(10,0) where order_id=current_setting('lx18.order_id')::uuid),
  1::bigint,
  'Billing history returns the caller-owned order'
);
select is(
  public.mark_my_luxy_membership_order_submitted(current_setting('lx18.order_id')::uuid),
  'awaiting_confirmation'::text,
  'Member transfer confirmation moves order only to Admin review queue'
);
select is(
  (select status from public.get_my_luxy_membership_checkout(current_setting('lx18.order_id')::uuid)),
  'awaiting_confirmation'::text,
  'Checkout polling reflects awaiting Admin confirmation'
);
reset role;

select is(
  (select count(*) from private.luxy_membership_checkout_snapshots where order_id=current_setting('lx18.order_id')::uuid),
  1::bigint,
  'Repeated checkout reads create exactly one immutable receiving-account snapshot'
);
select is(
  (select count(*) from private.luxy_memberships where user_id='28000000-0000-0000-0000-000000000001'),
  0::bigint,
  'Self-submitted transfer never activates membership'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"28000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok(
  format('select * from public.get_my_luxy_membership_checkout(%L::uuid)',current_setting('lx18.order_id')),
  'P0002','membership_order_not_found',
  'Another member cannot read the buyer membership checkout'
);
reset role;

select * from finish();
rollback;