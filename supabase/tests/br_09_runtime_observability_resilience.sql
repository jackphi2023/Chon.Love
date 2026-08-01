begin;

select plan(32);

select ok(to_regclass('private.runtime_observability_events') is not null,'runtime observability event table exists');
select is((select value_json#>>'{}' from private.app_config where key='runtime_observability_ingest_enabled'),'false','runtime observability ingestion is disabled by default');
select is((select value_json#>>'{}' from private.app_config where key='runtime_observability_retention_days'),'30','runtime observability retention defaults to 30 days');
select is((select value_json#>>'{}' from private.app_config where key='runtime_observability_rate_limit_per_hour'),'120','runtime observability rate limit defaults to 120 per hour');
select ok((select relrowsecurity from pg_class where oid='private.runtime_observability_events'::regclass),'runtime observability table has RLS enabled');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'authenticated users retain no private schema usage');
select ok(not exists(select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='private' and table_name='runtime_observability_events'),'clients have no direct observability table grants');
select ok(has_function_privilege('authenticated','public.record_runtime_observability_event(uuid,text,text,text,text,text,text,integer,jsonb)','EXECUTE'),'authenticated clients can call the guarded observation RPC');
select ok(not has_function_privilege('anon','public.record_runtime_observability_event(uuid,text,text,text,text,text,text,integer,jsonb)','EXECUTE'),'anonymous clients cannot submit observations');
select ok(not has_function_privilege('authenticated','public.admin_runtime_observability_snapshot(uuid,integer)','EXECUTE'),'authenticated clients cannot read the admin snapshot');
select ok(has_function_privilege('service_role','public.admin_runtime_observability_snapshot(uuid,integer)','EXECUTE'),'service role can read the admin snapshot');
select ok(has_function_privilege('service_role','public.purge_expired_runtime_observability_events(integer)','EXECUTE'),'service role can run retention cleanup');

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,recovery_token,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token
) values
('00000000-0000-0000-0000-000000000000','9c000000-0000-0000-0000-000000000001','authenticated','authenticated','br09-user@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','9c000000-0000-0000-0000-000000000002','authenticated','authenticated','br09-admin@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','',''),
('00000000-0000-0000-0000-000000000000','9c000000-0000-0000-0000-000000000003','authenticated','authenticated','br09-outsider@example.test','','{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','');

insert into private.user_roles(user_id,role,granted_by)
values('9c000000-0000-0000-0000-000000000002','super_admin','9c000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

select throws_ok(
  $$select * from public.record_runtime_observability_event('9c100000-0000-4000-8000-000000000001','api_read_error','error','mobile_web','beta','discovery','http_503',1200,'{"feature":"discovery","retryable":true}'::jsonb)$$,
  '55000','runtime_observability_ingest_enabled_disabled','observation ingestion fails closed while disabled'
);

reset role;
update private.app_config set value_json='true'::jsonb where key='runtime_observability_ingest_enabled';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

select ok(not (select already_recorded from public.record_runtime_observability_event(
  '9c100000-0000-4000-8000-000000000001','api_read_error','error','mobile_web','beta','discovery','http_503',1200,
  '{"feature":"discovery","attempt":2,"retryable":true}'::jsonb
)),'first observation is inserted');
select ok((select already_recorded from public.record_runtime_observability_event(
  '9c100000-0000-4000-8000-000000000001','api_read_error','error','mobile_web','beta','discovery','http_503',1200,
  '{"feature":"discovery","attempt":2,"retryable":true}'::jsonb
)),'repeating the same event ID is idempotent');
reset role;
select is((select count(*)::integer from private.runtime_observability_events where event_id='9c100000-0000-4000-8000-000000000001'),1,'idempotent retry stores one row');
select is((select metadata_json->>'feature' from private.runtime_observability_events where event_id='9c100000-0000-4000-8000-000000000001'),'discovery','allowlisted metadata is retained');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok(
  $$select * from public.record_runtime_observability_event('9c100000-0000-4000-8000-000000000002','api_read_error','error','mobile_web','beta','discovery',null,null,'{"unknown":"value"}'::jsonb)$$,
  '22023','runtime_metadata_key_not_allowed','unknown metadata keys are rejected'
);
select throws_ok(
  $$select * from public.record_runtime_observability_event('9c100000-0000-4000-8000-000000000003','api_read_error','error','mobile_web','beta','discovery',null,null,'{"access_token":"secret"}'::jsonb)$$,
  '22023','runtime_metadata_key_not_allowed','sensitive telemetry keys are rejected before storage'
);
select throws_ok(
  $$select * from public.record_runtime_observability_event('9c100000-0000-4000-8000-000000000004','api_read_error','error','mobile_web','beta','Discovery Screen',null,null,'{}'::jsonb)$$,
  '22023','invalid_runtime_route_group','route groups must use bounded non-sensitive identifiers'
);
select throws_ok(
  $$select * from public.record_runtime_observability_event('9c100000-0000-4000-8000-000000000005','not_allowed','error','mobile_web','beta','discovery',null,null,'{}'::jsonb)$$,
  '22023','invalid_runtime_event_name','event names are allowlisted'
);
select throws_ok(
  $$select * from public.record_runtime_observability_event('9c100000-0000-4000-8000-000000000006','api_read_error','error','mobile_web','beta','discovery',null,300001,'{}'::jsonb)$$,
  '22023','invalid_runtime_duration','duration is bounded'
);

reset role;
update private.app_config set value_json='2'::jsonb where key='runtime_observability_rate_limit_per_hour';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select ok(not (select already_recorded from public.record_runtime_observability_event(
  '9c100000-0000-4000-8000-000000000007','network_recovered','info','mobile_web','beta','root',null,500,
  '{"network_state":"online","recovered":true}'::jsonb
)),'second allowed observation is inserted');
select throws_ok(
  $$select * from public.record_runtime_observability_event('9c100000-0000-4000-8000-000000000008','api_timeout','warning','mobile_web','beta','root','timeout',5000,'{"retryable":true}'::jsonb)$$,
  '54000','runtime_observability_rate_limit_exceeded','per-user rate limit fails closed'
);

reset role;
select throws_ok(
  $$select * from public.admin_runtime_observability_snapshot('9c000000-0000-0000-0000-000000000003',60)$$,
  '42501','required_admin_role_missing','only super admins can read the runtime snapshot'
);
select ok(exists(select 1 from public.admin_runtime_observability_snapshot('9c000000-0000-0000-0000-000000000002',60) where event_name='api_read_error' and event_count=1),'super admin snapshot aggregates runtime errors');
select is((select retryable_count::integer from public.admin_runtime_observability_snapshot('9c000000-0000-0000-0000-000000000002',60) where event_name='api_read_error'),1,'snapshot counts retryable observations');
select throws_ok(
  $$update private.runtime_observability_events set severity='warning' where event_id='9c100000-0000-4000-8000-000000000001'$$,
  '42501','runtime_observability_events_are_immutable','runtime observations cannot be updated'
);
select throws_ok(
  $$delete from private.runtime_observability_events where event_id='9c100000-0000-4000-8000-000000000001'$$,
  '42501','runtime_observability_events_are_immutable','runtime observations cannot be deleted directly'
);
update private.runtime_observability_events set created_at=now()-interval '31 days' where false;
insert into private.runtime_observability_events(event_id,user_id,event_name,severity,platform,release_channel,route_group,metadata_json,created_at)
values('9c100000-0000-4000-8000-000000000099','9c000000-0000-0000-0000-000000000001','route_recovered','info','mobile_web','beta','root','{}',now()-interval '31 days');
select is(public.purge_expired_runtime_observability_events(100),1,'retention cleanup removes expired observations through the guarded function');
select is((select count(*)::integer from private.runtime_observability_events where event_id='9c100000-0000-4000-8000-000000000099'),0,'expired observation is deleted');
select is((select count(*)::integer from private.runtime_observability_events),2,'current observations remain after retention cleanup');

select * from finish();
rollback;
