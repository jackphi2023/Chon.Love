-- BR-01 forward-only reconciliation for four functions whose checked-in
-- historical definitions did not match their current contracts or failed
-- plpgsql_check due to ambiguous output-variable names.

create or replace function public.admin_review_bank_account(
  p_actor_user_id uuid,
  p_bank_account_id uuid,
  p_decision text,
  p_reason_code text,
  p_request_id uuid
)
returns table(
  bank_account_id uuid,
  status text,
  payout_eligible boolean,
  already_processed boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role private.user_role;
  v_bank private.bank_accounts%rowtype;
  v_existing private.admin_audit_logs%rowtype;
  v_eligible boolean;
  v_before jsonb;
begin
  if p_request_id is null then
    raise exception using errcode='22023',message='request_id_required';
  end if;

  v_role := private.actor_role_for(
    p_actor_user_id,
    array['finance_admin','super_admin']::private.user_role[]
  );

  select a.*
  into v_existing
  from private.admin_audit_logs as a
  where a.request_id = p_request_id;

  if found then
    select ba.*
    into v_bank
    from private.bank_accounts as ba
    where ba.id = p_bank_account_id;

    select cp.payout_eligible
    into v_eligible
    from public.creator_profiles as cp
    where cp.user_id = v_bank.user_id;

    return query
    select v_bank.id, v_bank.status::text, coalesce(v_eligible,false), true;
    return;
  end if;

  if p_decision not in ('verify','reject','disable') then
    raise exception using errcode='22023',message='invalid_bank_decision';
  end if;

  select ba.*
  into v_bank
  from private.bank_accounts as ba
  where ba.id = p_bank_account_id
    and ba.deleted_at is null
  for update;

  if not found or (p_decision in ('verify','reject') and v_bank.status <> 'pending') then
    raise exception using errcode='42501',message='bank_account_not_reviewable';
  end if;

  if p_decision='reject'
     and (p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,63}$') then
    raise exception using errcode='22023',message='bank_rejection_reason_required';
  end if;

  v_before := jsonb_build_object(
    'status',v_bank.status::text,
    'bank_code',v_bank.bank_code,
    'last4',v_bank.account_number_last4,
    'is_default',v_bank.is_default
  );

  update private.bank_accounts as ba
  set
    status = case p_decision
      when 'verify' then 'verified'::private.bank_account_status
      when 'reject' then 'rejected'::private.bank_account_status
      else 'disabled'::private.bank_account_status
    end,
    verified_at = case when p_decision='verify' then now() else null end,
    verified_by = case when p_decision='verify' then p_actor_user_id else null end,
    rejection_reason_code = case when p_decision='reject' then p_reason_code else null end,
    deleted_at = case when p_decision='disable' then now() else ba.deleted_at end,
    is_default = case when p_decision='disable' then false else ba.is_default end
  where ba.id = v_bank.id
  returning ba.* into v_bank;

  v_eligible := private.refresh_creator_payout_eligibility(v_bank.user_id);

  perform private.append_admin_audit(
    p_actor_user_id,
    v_role,
    'bank_' || case p_decision
      when 'verify' then 'verified'
      when 'reject' then 'rejected'
      else 'disabled'
    end,
    'bank_account',
    v_bank.id,
    v_before,
    jsonb_build_object(
      'status',v_bank.status::text,
      'bank_code',v_bank.bank_code,
      'last4',v_bank.account_number_last4,
      'is_default',v_bank.is_default
    ),
    p_reason_code,
    p_request_id,
    null,
    null
  );

  perform private.bump_payout_sync(v_bank.user_id,false,true,false,false);
  return query select v_bank.id,v_bank.status::text,v_eligible,false;
end;
$function$;

create or replace function public.complete_my_onboarding(
  p_date_of_birth date,
  p_terms_version text,
  p_community_rules_version text,
  p_age_verification_method text default 'self_declared'::text
)
returns table(
  user_id uuid,
  age_verified boolean,
  account_status text,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
  v_existing_dob date;
  v_account_status private.account_status;
  v_method private.age_verification_method;
  v_terms_version text;
  v_community_rules_version text;
begin
  if v_user_id is null then
    raise exception using errcode='28000',message='authentication required';
  end if;

  select ac.value_json #>> '{}'
  into v_terms_version
  from private.app_config as ac
  where ac.key='terms_version_current';

  select ac.value_json #>> '{}'
  into v_community_rules_version
  from private.app_config as ac
  where ac.key='community_rules_version_current';

  if v_terms_version is null or v_community_rules_version is null then
    raise exception using errcode='55000',message='policy versions are not configured';
  end if;

  select ui.date_of_birth,ui.account_status
  into v_existing_dob,v_account_status
  from private.user_identity as ui
  where ui.user_id=v_user_id;

  if v_account_status is distinct from 'active'::private.account_status then
    raise exception using errcode='42501',message='account is not active';
  end if;

  if p_date_of_birth is null or p_date_of_birth > current_date then
    raise exception using errcode='22008',message='invalid date_of_birth';
  end if;

  if p_date_of_birth > (current_date - interval '18 years')::date then
    raise exception using errcode='22023',message='user must be at least 18 years old';
  end if;

  if p_age_verification_method not in ('self_declared','document','manual_review','third_party') then
    raise exception using errcode='22023',message='invalid age verification method';
  end if;
  v_method := p_age_verification_method::private.age_verification_method;

  if v_existing_dob is not null and v_existing_dob <> p_date_of_birth then
    raise exception using errcode='22023',message='verified date_of_birth cannot be changed by client';
  end if;

  if btrim(coalesce(p_terms_version,'')) <> v_terms_version then
    raise exception using errcode='22023',message='current terms version must be accepted';
  end if;

  if btrim(coalesce(p_community_rules_version,'')) <> v_community_rules_version then
    raise exception using errcode='22023',message='current community rules version must be accepted';
  end if;

  update private.user_identity as ui
  set
    date_of_birth=p_date_of_birth,
    age_verified_at=v_now,
    age_verification_method=v_method,
    terms_version=v_terms_version,
    terms_accepted_at=v_now,
    community_rules_version=v_community_rules_version,
    community_rules_accepted_at=v_now,
    updated_at=v_now
  where ui.user_id=v_user_id;

  if not found then
    raise exception using errcode='55000',message='user identity record is missing';
  end if;

  return query select v_user_id,true,v_account_status::text,v_now;
end;
$function$;

create or replace function public.list_creator_activity_moderation_queue(
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  post_id uuid,
  creator_id uuid,
  username text,
  display_name text,
  body text,
  content_type text,
  external_url text,
  external_provider text,
  image_access_mode text,
  required_gift_name_vi text,
  required_gift_hearts integer,
  moderation_status text,
  submitted_at timestamptz,
  media_id uuid,
  preview_bucket text,
  preview_path text,
  original_bucket text,
  original_path text,
  media_moderation_status text,
  unlock_count bigint,
  report_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not private.current_user_has_any_role(array['moderator','super_admin']::private.user_role[]) then
    raise exception using errcode='42501',message='moderator_role_required';
  end if;

  return query
  select
    p.id,
    p.creator_id,
    pr.username::text,
    coalesce(pr.display_name,pr.username::text)::text,
    p.body,
    p.content_type::text,
    p.external_url,
    p.external_provider,
    p.image_access_mode::text,
    g.name_vi,
    g.display_hearts,
    p.moderation_status::text,
    p.submitted_at,
    pm.media_id,
    pm.preview_bucket,
    pm.preview_path,
    m.storage_bucket,
    m.storage_path,
    m.moderation_status::text,
    (select count(*) from private.creator_post_unlocks as u where u.post_id=p.id and u.status='active'),
    (select count(*) from public.reports as r where r.target_creator_post_id=p.id or r.target_media_id=pm.media_id)
  from public.creator_posts as p
  join public.profiles as pr on pr.id=p.creator_id
  left join public.creator_post_media as pm on pm.post_id=p.id
  left join public.media_assets as m on m.id=pm.media_id
  left join public.gift_catalog as g on g.id=p.required_gift_id
  where p.deleted_at is null
    and p.moderation_status in ('pending_review','rejected')
  order by
    case when p.moderation_status='pending_review' then 0 else 1 end,
    p.submitted_at,
    p.id
  limit least(greatest(coalesce(p_limit,30),1),100)
  offset greatest(coalesce(p_offset,0),0);
end;
$function$;

create or replace function public.send_gift_and_unlock_creator_post(
  p_post_id uuid,
  p_idempotency_key uuid
)
returns table(
  gift_transaction_id uuid,
  post_id uuid,
  entitlement_status text,
  sender_balance_units bigint,
  already_unlocked boolean,
  already_processed boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_viewer uuid := auth.uid();
  v_post public.creator_posts;
  v_gift public.gift_catalog;
  v_unlock private.creator_post_unlocks;
  v_existing_tx public.gift_transactions;
  v_result record;
  v_balance bigint := 0;
begin
  if v_viewer is null then
    raise exception using errcode='42501',message='authentication_required';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode='22023',message='idempotency_key_required';
  end if;
  if not private.is_active_adult(v_viewer) then
    raise exception using errcode='42501',message='active_adult_viewer_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_viewer::text || ':' || p_post_id::text,0));

  select p.*
  into v_post
  from public.creator_posts as p
  where p.id=p_post_id
    and p.moderation_status='approved'
    and p.published_at is not null
    and p.deleted_at is null
    and p.archived_at is null
  for update;

  if not found
     or v_post.content_type <> 'image'
     or v_post.image_access_mode <> 'gift_locked'
     or v_post.required_gift_id is null then
    raise exception using errcode='22023',message='creator_activity_post_not_unlockable';
  end if;
  if v_viewer=v_post.creator_id then
    raise exception using errcode='22023',message='creator_activity_owner_does_not_need_unlock';
  end if;
  if private.users_are_blocked(v_viewer,v_post.creator_id) then
    raise exception using errcode='42501',message='creator_activity_unlock_blocked';
  end if;
  if not exists(
    select 1
    from public.creator_profiles as cp
    where cp.user_id=v_post.creator_id
      and cp.creator_status='approved'
      and cp.approved_at is not null
  ) or not private.is_active_adult(v_post.creator_id) then
    raise exception using errcode='42501',message='approved_creator_required';
  end if;
  if not exists(
    select 1
    from public.creator_post_media as pm
    join public.media_assets as m on m.id=pm.media_id
    where pm.post_id=v_post.id
      and pm.preview_status='ready'
      and m.moderation_status='approved'
      and m.deleted_at is null
  ) then
    raise exception using errcode='42501',message='creator_activity_media_not_approved';
  end if;

  select u.*
  into v_unlock
  from private.creator_post_unlocks as u
  where u.post_id=v_post.id and u.viewer_id=v_viewer
  for update;

  if found and v_unlock.status='active' then
    select coalesce(ha.available_units,0)
    into v_balance
    from private.heart_accounts as ha
    where ha.user_id=v_viewer;

    return query
    select v_unlock.gift_transaction_id,v_post.id,'active'::text,coalesce(v_balance,0),true,false;
    return;
  end if;

  select g.*
  into v_gift
  from public.gift_catalog as g
  where g.id=v_post.required_gift_id
    and g.is_active
    and g.deleted_at is null;

  if not found then
    raise exception using errcode='22023',message='creator_activity_required_gift_inactive';
  end if;
  if v_gift.heart_price_units <> v_post.required_gift_units_snapshot then
    raise exception using errcode='22023',message='creator_activity_gift_price_changed';
  end if;

  select gt.*
  into v_existing_tx
  from public.gift_transactions as gt
  where gt.sender_id=v_viewer
    and gt.idempotency_key=p_idempotency_key;

  if found then
    if v_existing_tx.unlock_target_type <> 'creator_post'
       or v_existing_tx.unlock_target_id <> v_post.id
       or v_existing_tx.status <> 'completed'
       or v_existing_tx.reversed_heart_units <> 0 then
      raise exception using errcode='23505',message='creator_activity_idempotency_conflict';
    end if;

    insert into private.creator_post_unlocks(
      post_id,viewer_id,creator_id,gift_transaction_id,required_gift_id,
      gift_units_snapshot,status,unlocked_at,revoked_at,revoke_reason
    ) values(
      v_post.id,v_viewer,v_post.creator_id,v_existing_tx.id,v_post.required_gift_id,
      v_post.required_gift_units_snapshot,'active',now(),null,null
    )
    on conflict on constraint creator_post_unlocks_one_per_viewer
    do update set
      gift_transaction_id=excluded.gift_transaction_id,
      required_gift_id=excluded.required_gift_id,
      gift_units_snapshot=excluded.gift_units_snapshot,
      status='active',
      unlocked_at=now(),
      revoked_at=null,
      revoke_reason=null
    returning * into v_unlock;

    select coalesce(ha.available_units,0)
    into v_balance
    from private.heart_accounts as ha
    where ha.user_id=v_viewer;

    return query
    select v_existing_tx.id,v_post.id,'active'::text,coalesce(v_balance,0),false,true;
    return;
  end if;

  select *
  into v_result
  from public.send_gift(
    v_post.creator_id,
    v_post.required_gift_id,
    1,
    p_idempotency_key,
    null,
    null
  );

  update public.gift_transactions as gt
  set unlock_target_type='creator_post',unlock_target_id=v_post.id
  where gt.id=v_result.gift_transaction_id
  returning gt.* into v_existing_tx;

  insert into private.creator_post_unlocks(
    post_id,viewer_id,creator_id,gift_transaction_id,required_gift_id,
    gift_units_snapshot,status,unlocked_at,revoked_at,revoke_reason
  ) values(
    v_post.id,v_viewer,v_post.creator_id,v_existing_tx.id,v_post.required_gift_id,
    v_post.required_gift_units_snapshot,'active',now(),null,null
  )
  on conflict on constraint creator_post_unlocks_one_per_viewer
  do update set
    gift_transaction_id=excluded.gift_transaction_id,
    required_gift_id=excluded.required_gift_id,
    gift_units_snapshot=excluded.gift_units_snapshot,
    status='active',
    unlocked_at=now(),
    revoked_at=null,
    revoke_reason=null
  returning * into v_unlock;

  insert into private.creator_post_unlock_events(
    unlock_id,post_id,viewer_id,gift_transaction_id,event_type,metadata_json
  ) values(
    v_unlock.id,
    v_post.id,
    v_viewer,
    v_existing_tx.id,
    case when v_unlock.created_at=v_unlock.updated_at then 'unlocked' else 'reactivated' end,
    jsonb_build_object('gift_id',v_post.required_gift_id,'gift_units',v_post.required_gift_units_snapshot)
  );

  return query
  select v_existing_tx.id,v_post.id,'active'::text,v_result.sender_balance_units,false,v_result.already_processed;
end;
$function$;
