begin;
select plan(36);

select is((
  select count(*)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
),0::bigint,'every public table has RLS enabled');

select is((
  select count(*)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='private' and c.relkind='r' and not c.relrowsecurity
),0::bigint,'every private table has RLS defense in depth');

select is((
  select count(*)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and c.relkind='r' and c.relrowsecurity
    and not exists(select 1 from pg_policies p where p.schemaname=n.nspname and p.tablename=c.relname)
),0::bigint,'every RLS table has an explicit policy');

select is(has_schema_privilege('anon','private','usage'),false,'anon cannot use private schema');
select is(has_schema_privilege('authenticated','private','usage'),false,'authenticated cannot use private schema');

select is((
  select count(*) from information_schema.role_table_grants
  where grantee='anon' and table_schema='private'
),0::bigint,'anon has no private table grants');

select is((
  select count(*) from information_schema.role_table_grants
  where grantee='authenticated' and table_schema='private'
),0::bigint,'authenticated has no private table grants');

select is((
  select count(*) from pg_policies
  where schemaname='public' and tablename='moderation_cases'
    and policyname='moderation_cases_deny_client_access'
),1::bigint,'moderation queue has an explicit deny-client policy');

select is((
  select count(*) from information_schema.role_table_grants
  where grantee='anon' and table_schema='public' and table_name='moderation_cases'
),0::bigint,'anon has no moderation queue grants');

select is((
  select count(*) from information_schema.role_table_grants
  where grantee='authenticated' and table_schema='public' and table_name='moderation_cases'
),0::bigint,'authenticated has no moderation queue grants');

select has_index('private','account_holds','account_holds_created_by_idx','account hold creator FK is indexed');
select has_index('private','account_holds','account_holds_released_by_idx','account hold releaser FK is indexed');
select has_index('private','bank_accounts','bank_accounts_verified_by_idx','bank verifier FK is indexed');
select has_index('private','kyc_profiles','kyc_profiles_reviewed_by_idx','KYC reviewer FK is indexed');
select has_index('private','withdrawals','withdrawals_reviewed_by_idx','withdrawal reviewer FK is indexed');

select is((
  select count(*)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'server_submit_kyc_profile','server_upsert_bank_account','admin_review_kyc',
      'admin_review_bank_account','admin_decide_withdrawal','admin_create_account_hold',
      'admin_release_account_hold','admin_process_account_deletion',
      'server_get_kyc_review_payload','server_get_bank_review_payload',
      'server_authorize_kyc_document_access'
    )
    and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
),0::bigint,'service-only payout RPCs do not leak to clients');

select is((
  select count(*)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE')
),1::bigint,'only one anonymous SECURITY DEFINER RPC is exposed');

select ok(has_function_privilege('anon','public.get_public_app_config()','EXECUTE'),'anonymous RPC is only public app configuration');

select is((
  select count(*)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and has_function_privilege('authenticated',p.oid,'EXECUTE')
),46::bigint,'authenticated SECURITY DEFINER API surface is frozen');

select is((
  select count(*)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private') and p.prosecdef
    and not exists(
      select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) setting
      where setting like 'search_path=%'
    )
),0::bigint,'every SECURITY DEFINER function pins search_path');

select is((
  select count(*) from pg_policies
  where coalesce(qual,'')||coalesce(with_check,'') ilike '%auth.role()%'
),0::bigint,'RLS policies do not use deprecated auth.role()');

select is((
  select count(*) from pg_policies
  where coalesce(qual,'')||coalesce(with_check,'') ilike '%user_metadata%'
     or coalesce(qual,'')||coalesce(with_check,'') ilike '%raw_user_meta_data%'
),0::bigint,'RLS policies never authorize from user-editable metadata');

select is((
  select count(*) from pg_policies
  where schemaname='storage' and tablename='objects' and cmd='UPDATE'
),0::bigint,'Storage overwrite remains disabled');

select is((
  select count(*) from pg_policies
  where schemaname='storage' and tablename='objects' and cmd='SELECT'
    and coalesce(qual,'') like '%kyc-private%'
),0::bigint,'KYC objects have no direct client read policy');

select is((select public from storage.buckets where id='kyc-private'),false,'KYC bucket is private');
select is((select public from storage.buckets where id='media-private'),false,'Fan/private media bucket is private');

select is((
  select count(*) from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='private'
),0::bigint,'Realtime publishes no private table');

select is((
  select count(*) from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename in (
      'album_media','albums','conversation_members','economy_sync','fan_memberships',
      'fan_progress','friendships','gift_transactions','media_assets','messages','payout_sync'
    )
),11::bigint,'Realtime publishes the complete redacted cross-platform contract');

select ok(has_table_privilege('authenticated','public.payout_sync','SELECT'),'authenticated can receive its payout invalidation row');

select is((
  select count(*) from information_schema.role_table_grants
  where grantee='authenticated' and table_schema='public' and table_name='payout_sync'
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
),0::bigint,'authenticated cannot mutate payout sync metadata');

select is((
  select count(*) from information_schema.role_table_grants
  where grantee='authenticated' and table_schema='public'
    and table_name in ('gift_transactions','fan_progress','fan_memberships','economy_sync')
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
),0::bigint,'authenticated cannot directly mutate public economy state');

select is((
  select count(*)
  from pg_trigger
  where tgrelid='private.admin_audit_logs'::regclass
    and tgname='admin_audit_logs_immutable' and not tgisinternal
),1::bigint,'immutable audit trigger exists');

select is((
  select tgenabled
  from pg_trigger
  where tgrelid='private.admin_audit_logs'::regclass
    and tgname='admin_audit_logs_immutable' and not tgisinternal
),'O','immutable audit trigger is enabled');

select is((
  select count(*)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'server_submit_kyc_profile','server_upsert_bank_account','admin_review_kyc',
      'admin_review_bank_account','admin_decide_withdrawal','admin_create_account_hold',
      'admin_release_account_hold','admin_process_account_deletion',
      'server_get_kyc_review_payload','server_get_bank_review_payload',
      'server_authorize_kyc_document_access'
    )
    and has_function_privilege('service_role',p.oid,'EXECUTE')
),11::bigint,'service role can execute all payout administration RPCs');

set local role authenticated;
select throws_ok($$select * from public.moderation_cases$$,'42501',null,'authenticated cannot read moderation queue');
reset role;

set local role anon;
select throws_ok($$select * from private.user_identity$$,'42501',null,'anon cannot read private identity data');
reset role;

select * from finish();
rollback;
