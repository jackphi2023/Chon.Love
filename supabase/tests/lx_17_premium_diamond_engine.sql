begin;

select plan(35);

select ok(to_regclass('private.luxy_membership_orders') is not null,'LX-17 membership order ledger exists');
select ok(to_regclass('private.luxy_membership_privacy') is not null,'LX-17 membership privacy settings exist');
select ok(has_function_privilege('authenticated','public.get_luxy_membership_plan_options()','execute'),'Authenticated members can read authoritative plan prices');
select ok(has_function_privilege('authenticated','public.create_luxy_membership_order(public.luxy_membership_tier,integer,uuid,text)','execute'),'Authenticated members can create membership orders');
select ok(not has_function_privilege('authenticated','public.admin_approve_luxy_membership_order(uuid,uuid,text,bigint,uuid)','execute'),'Authenticated clients cannot directly approve membership orders');
select ok(has_function_privilege('service_role','public.admin_approve_luxy_membership_order(uuid,uuid,text,bigint,uuid)','execute'),'Service role can call audited membership approval RPC');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'Authenticated clients retain no private schema usage');

select is((select amount_due_vnd from public.get_luxy_membership_plan_options() where tier='premium' and period_count=1),1000000::bigint,'Premium 1 period is 1,000,000 VND');
select is((select amount_due_vnd from public.get_luxy_membership_plan_options() where tier='premium' and period_count=3),2400000::bigint,'Premium 3 periods apply 20 percent discount');
select is((select amount_due_vnd from public.get_luxy_membership_plan_options() where tier='diamond' and period_count=1),5000000::bigint,'Diamond 1 period is 5,000,000 VND');
select is((select amount_due_vnd from public.get_luxy_membership_plan_options() where tier='diamond' and period_count=3),12000000::bigint,'Diamond 3 periods apply 20 percent discount');
select is((select heart_credit_display from public.get_luxy_membership_plan_options() where tier='diamond' and period_count=1),80::bigint,'Diamond 1 period converts 80 percent of payment to 80 display hearts');
select is((select heart_credit_display from public.get_luxy_membership_plan_options() where tier='diamond' and period_count=3),192::bigint,'Discounted Diamond 3-period payment converts to 192 display hearts');
select is((select heart_credit_units from public.get_luxy_membership_plan_options() where tier='premium' and period_count=3),0::bigint,'Premium receives no membership heart credit');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','27000000-0000-0000-0000-000000000001','authenticated','authenticated','lx17-free@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','27000000-0000-0000-0000-000000000002','authenticated','authenticated','lx17-premium@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','27000000-0000-0000-0000-000000000003','authenticated','authenticated','lx17-diamond@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','27000000-0000-0000-0000-000000000004','authenticated','authenticated','lx17-admin@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

update private.user_identity set
  date_of_birth=(current_date-interval '32 years')::date,
  age_verified_at=now(),age_verification_method='self_declared',
  terms_version=(select value_json#>>'{}' from private.app_config where key='terms_version_current'),terms_accepted_at=now(),
  community_rules_version=(select value_json#>>'{}' from private.app_config where key='community_rules_version_current'),community_rules_accepted_at=now(),
  account_status='active'
where user_id::text like '27000000-0000-0000-0000-00000000000%';

update public.profiles set
  profile_status='active',discovery_enabled=true,province_id=(select id from public.administrative_areas where country_code='VN' and code='79'),
  username=case id
    when '27000000-0000-0000-0000-000000000001' then 'lx17_free'
    when '27000000-0000-0000-0000-000000000002' then 'lx17_premium'
    when '27000000-0000-0000-0000-000000000003' then 'lx17_diamond'
    else 'lx17_admin' end,
  display_name=case id
    when '27000000-0000-0000-0000-000000000001' then 'LX17 Free'
    when '27000000-0000-0000-0000-000000000002' then 'LX17 Premium'
    when '27000000-0000-0000-0000-000000000003' then 'LX17 Diamond'
    else 'LX17 Admin' end,
  gender='male'::public.gender_identity,interested_in='female'::public.dating_interest,last_active_at=now()
where id::text like '27000000-0000-0000-0000-00000000000%';

insert into private.user_roles(user_id,role,granted_by)
values('27000000-0000-0000-0000-000000000004','finance_admin','27000000-0000-0000-0000-000000000004');

insert into private.luxy_memberships(user_id,tier,status,messaging_enabled,starts_at,expires_at,source) values
('27000000-0000-0000-0000-000000000002','premium','active',true,now()-interval '1 day',now()+interval '30 days','lx17_test'),
('27000000-0000-0000-0000-000000000003','diamond','active',true,now()-interval '1 day',now()-interval '1 second','lx17_expired_test');

select is(private.get_active_luxy_membership_tier('27000000-0000-0000-0000-000000000001'),'free'::public.luxy_membership_tier,'Member without active row evaluates as Free');
select is(private.get_active_luxy_membership_tier('27000000-0000-0000-0000-000000000002'),'premium'::public.luxy_membership_tier,'Active Premium evaluates as Premium');
select is(private.get_active_luxy_membership_tier('27000000-0000-0000-0000-000000000003'),'free'::public.luxy_membership_tier,'Expired Diamond automatically evaluates as Free without cron mutation');
select is(private.luxy_visibility_priority('27000000-0000-0000-0000-000000000001'),0,'Free visibility priority is lowest');
select is(private.luxy_visibility_priority('27000000-0000-0000-0000-000000000002'),1,'Premium visibility priority is above Free');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"27000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok(
  $$select * from public.update_my_luxy_membership_privacy(true,false)$$,
  '42501','premium_membership_required_for_hide_online','Free cannot hide online status'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"27000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$select * from public.update_my_luxy_membership_privacy(true,false)$$,'Premium can hide online status');
select throws_ok(
  $$select * from public.update_my_luxy_membership_privacy(true,true)$$,
  '42501','diamond_membership_required_for_hide_listing','Premium cannot hide from listing'
);
reset role;

update private.luxy_memberships set tier='diamond',status='active',messaging_enabled=true,starts_at=now()-interval '1 minute',expires_at=now()+interval '30 days'
where user_id='27000000-0000-0000-0000-000000000003';
select is(private.luxy_visibility_priority('27000000-0000-0000-0000-000000000003'),2,'Diamond visibility priority is highest');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"27000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select lives_ok($$select * from public.update_my_luxy_membership_privacy(true,true)$$,'Diamond can hide online and hide from listing');
select is((select hide_from_listing from public.get_my_luxy_membership_privacy()),true,'Diamond privacy snapshot reports hide-from-listing enabled');
reset role;

delete from private.luxy_memberships where user_id='27000000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"27000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select set_config('lx17.order_id',(
  select order_id::text from public.create_luxy_membership_order('diamond',3,'27000000-0000-4000-8000-000000000101','membership')
),true);
select is(public.mark_my_luxy_membership_order_submitted(current_setting('lx17.order_id')::uuid),'awaiting_confirmation','Member explicitly submits paid order for Admin confirmation');
reset role;

select throws_ok(
  $$select * from public.admin_approve_luxy_membership_order(
    '27000000-0000-0000-0000-000000000004',current_setting('lx17.order_id')::uuid,'VCB-LX17-WRONG',11999999,'27000000-0000-4000-8000-000000000102')$$,
  '22023','membership_amount_mismatch','Admin cannot activate a plan when actual amount does not exactly match the order snapshot'
);
select is((select status from private.luxy_membership_orders where id=current_setting('lx17.order_id')::uuid),'awaiting_confirmation','Amount mismatch leaves membership order pending');

select lives_ok(
  $$select * from public.admin_approve_luxy_membership_order(
    '27000000-0000-0000-0000-000000000004',current_setting('lx17.order_id')::uuid,'VCB-LX17-OK',12000000,'27000000-0000-4000-8000-000000000103')$$,
  'Finance Admin exact-payment confirmation activates Diamond and credits hearts atomically'
);
select is(private.get_active_luxy_membership_tier('27000000-0000-0000-0000-000000000003'),'diamond'::public.luxy_membership_tier,'Approved order activates Diamond');
select ok((select expires_at>now()+interval '89 days' from private.luxy_memberships where user_id='27000000-0000-0000-0000-000000000003'),'Three-period Diamond receives an expiry roughly three months ahead');
select is((select available_units from private.heart_accounts where user_id='27000000-0000-0000-0000-000000000003'),19200::bigint,'Approved discounted Diamond 3-period order credits exactly 192 hearts');
select is((select count(*) from private.heart_ledger where user_id='27000000-0000-0000-0000-000000000003' and reference_type='luxy_membership' and reference_id=current_setting('lx17.order_id')::uuid),1::bigint,'Diamond heart credit has one immutable ledger entry');
select lives_ok(
  $$select * from public.admin_approve_luxy_membership_order(
    '27000000-0000-0000-0000-000000000004',current_setting('lx17.order_id')::uuid,'VCB-LX17-OK',12000000,'27000000-0000-4000-8000-000000000104')$$,
  'Retrying the same approved payment is idempotent'
);
select is((select available_units from private.heart_accounts where user_id='27000000-0000-0000-0000-000000000003'),19200::bigint,'Idempotent Admin retry does not double-credit Diamond hearts');

select * from finish();
rollback;