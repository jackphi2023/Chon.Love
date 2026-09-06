-- SESSION B final database contract assertions.
-- These assertions are intentionally data-independent so they also protect clean resets.
do $$
declare
  v_def text;
  v_active_hearts integer[];
begin
  -- Finance execution must remain server-fail-closed until the later finance E2E release gate.
  if exists (
    select 1 from private.app_config
    where key in (
      'withdrawal_requests_enabled',
      'kyc_operational_review_enabled',
      'bank_account_operational_review_enabled',
      'withdrawal_operational_review_enabled',
      'withdrawal_processing_enabled',
      'withdrawal_payout_enabled',
      'vietqr_reconciliation_enabled'
    ) and value_json='true'::jsonb
  ) then
    raise exception 'SESSION B finance execution must remain disabled';
  end if;

  -- The user withdrawal RPC may exist for UI integration, but its server switch above is authoritative.
  if not has_function_privilege('authenticated','public.request_withdrawal(uuid,bigint,uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('authenticated','public.admin_operate_withdrawal(uuid,uuid,text,text,text,text,uuid)'::regprocedure,'EXECUTE') then
    raise exception 'SESSION B withdrawal ACL invariant failed';
  end if;

  -- Canonical Connect must not use the legacy discovery path.
  if has_function_privilege('authenticated','public.list_discovery_profiles(text,bigint,integer,integer)'::regprocedure,'EXECUTE') then
    raise exception 'SESSION B legacy discovery RPC must remain retired';
  end if;

  -- One source of truth for Connect eligibility: admin hide + approved current avatar + listing/paid rules.
  v_def:=pg_get_functiondef('private.luxy_listing_hidden(uuid)'::regprocedure);
  if v_def !~ 'admin_hidden'
     or v_def !~ 'moderation_status.*approved'
     or v_def !~ 'listing_status'
     or v_def !~ 'has_active_luxy_paid_membership'
     or v_def !~ 'hide_from_listing' then
    raise exception 'SESSION B Connect eligibility helper invariant failed';
  end if;

  -- Direct public Profile availability remains separate from Connect discovery preference.
  v_def:=pg_get_functiondef('public.get_public_chon_profile_v2(text)'::regprocedure);
  if v_def !~ 'is_chon_public_profile_allowed' then
    raise exception 'SESSION B direct public profile guard invariant failed';
  end if;

  -- Free members retain Favorite/Interest; paid gates remain separate.
  v_def:=pg_get_functiondef('public.get_my_luxy_membership_snapshot()'::regprocedure);
  if v_def !~ 'can_favorite'
     or v_def !~ 'can_message_with_luxy_membership\(v_user_id\),[[:space:]]*true,' then
    raise exception 'SESSION B Free Favorite entitlement invariant failed';
  end if;

  -- Pending media must have one active review case, enforced by trigger + partial unique index.
  if to_regprocedure('private.ensure_open_media_moderation_case(uuid,public.moderation_source)') is null
     or not exists (
       select 1 from pg_indexes
       where schemaname='public' and indexname='moderation_cases_one_active_case_per_media_idx'
     ) then
    raise exception 'SESSION B media moderation invariant infrastructure missing';
  end if;

  -- Signup/Profile read contracts used by the repaired UI/backend integration.
  if to_regprocedure('public.save_my_signup_personal_info_v2(date,text,text,text,public.gender_identity,public.dating_interest,smallint,smallint,public.education_level,public.relationship_status,public.children_status,public.drinking_status,public.smoking_status)') is null
     or to_regprocedure('public.save_my_signup_location_v2(bigint,double precision,double precision,integer,timestamptz,text)') is null
     or to_regprocedure('public.save_my_signup_looking_for_v2(text,public.profile_lifestyle_tag[])') is null
     or to_regprocedure('public.save_my_signup_headline_bio_v2(text,text)') is null
     or to_regprocedure('public.get_my_date_of_birth_v2()') is null
     or to_regprocedure('public.update_my_date_of_birth_v2(date)') is null then
    raise exception 'SESSION B Signup/Profile RPC invariant failed';
  end if;

  v_def:=pg_get_functiondef('public.get_luxy_member_profile(text)'::regprocedure);
  if v_def !~ 'last_sign_in_at' then
    raise exception 'SESSION B last-login read model invariant failed';
  end if;

  -- Connect badge and message-retention companion contracts must exist.
  if to_regprocedure('public.get_luxy_search_membership_badges(uuid[])') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='conversations' and column_name='message_retention_purged_at'
     ) then
    raise exception 'SESSION B Connect/message presentation contract missing';
  end if;

  -- Exactly six active server-owned Heart packs.
  select array_agg(display_hearts order by sort_order,display_hearts)
  into v_active_hearts
  from public.heart_products where is_active;
  if v_active_hearts is distinct from array[10,50,100,200,500,1000]
     or exists(select 1 from public.heart_products where is_active and heart_units<>display_hearts*100) then
    raise exception 'SESSION B Heart catalog invariant failed: %',v_active_hearts;
  end if;

  -- Homepage Admin RPCs require a signed-in actor; anonymous execution is redundant and forbidden.
  if has_function_privilege('anon','public.admin_get_homepage_settings(uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon','public.admin_update_homepage_settings(uuid,text,text,text,text,text,text)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon','public.admin_publish_homepage_settings(uuid,text,text,jsonb,text,text,text,text)'::regprocedure,'EXECUTE') then
    raise exception 'SESSION B homepage Admin anonymous ACL invariant failed';
  end if;
end $$;
