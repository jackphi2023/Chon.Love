begin;

-- BR-08: KYC and Withdrawal operational control plane.
-- All operational and payout paths remain fail-closed until an explicit config change.

insert into private.app_config(key,value_json,value_type,description,is_public)
values
  ('kyc_operational_review_enabled','false'::jsonb,'boolean','Allow finance administrators to open and decide KYC review cases.',false),
  ('bank_account_operational_review_enabled','false'::jsonb,'boolean','Allow finance administrators to review payout bank accounts.',false),
  ('withdrawal_requests_enabled','false'::jsonb,'boolean','Allow approved Creators to submit withdrawal requests.',false),
  ('withdrawal_operational_review_enabled','false'::jsonb,'boolean','Allow finance administrators to review withdrawal requests.',false),
  ('withdrawal_processing_enabled','false'::jsonb,'boolean','Allow a second finance operator to start manual withdrawal processing.',false),
  ('withdrawal_payout_enabled','false'::jsonb,'boolean','Allow a second finance operator to record a verified manual payout.',false)
on conflict (key) do update
set value_json=excluded.value_json,
    value_type=excluded.value_type,
    description=excluded.description,
    is_public=false,
    updated_at=now();

alter table private.kyc_profiles
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists review_started_at timestamptz,
  add column if not exists review_due_at timestamptz,
  add column if not exists last_operation_request_id uuid;

alter table private.bank_accounts
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists review_started_at timestamptz,
  add column if not exists review_due_at timestamptz,
  add column if not exists last_operation_request_id uuid;

alter table private.withdrawals
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists review_started_at timestamptz,
  add column if not exists review_due_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_started_by uuid references auth.users(id) on delete set null,
  add column if not exists payment_recorded_by uuid references auth.users(id) on delete set null,
  add column if not exists payment_evidence_sha256 text,
  add column if not exists last_operation_request_id uuid;

alter table private.withdrawals
  drop constraint if exists withdrawals_payment_evidence_sha256_format;
alter table private.withdrawals
  add constraint withdrawals_payment_evidence_sha256_format
  check (payment_evidence_sha256 is null or payment_evidence_sha256 ~ '^[0-9a-f]{64}$');

create index if not exists kyc_profiles_operational_queue_idx
  on private.kyc_profiles(status,review_started_at,submitted_at,id);
create index if not exists bank_accounts_operational_queue_idx
  on private.bank_accounts(status,review_started_at,created_at,id)
  where deleted_at is null;
create index if not exists withdrawals_operational_queue_idx
  on private.withdrawals(status,review_started_at,requested_at,id);

create table if not exists private.payout_operation_events (
  id uuid primary key default extensions.gen_random_uuid(),
  entity_type text not null check (entity_type in ('kyc_profile','bank_account','withdrawal')),
  entity_id uuid not null,
  event_type text not null check (event_type in (
    'review_started','approved','rejected','disabled','processing_started','paid','sensitive_viewed','document_accessed'
  )),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role private.user_role not null,
  request_id uuid not null unique,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payout_operation_events_metadata_object check (jsonb_typeof(metadata_json)='object')
);

create index if not exists payout_operation_events_entity_created_idx
  on private.payout_operation_events(entity_type,entity_id,created_at desc,id);

alter table private.payout_operation_events enable row level security;
drop policy if exists payout_operation_events_deny_direct_client_access on private.payout_operation_events;
create policy payout_operation_events_deny_direct_client_access
  on private.payout_operation_events for all to public
  using (false) with check (false);

create or replace function private.prevent_payout_operation_event_mutation()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception using errcode='42501',message='payout_operation_events_are_immutable';
end
$function$;

drop trigger if exists payout_operation_events_immutable on private.payout_operation_events;
create trigger payout_operation_events_immutable
before update or delete on private.payout_operation_events
for each row execute function private.prevent_payout_operation_event_mutation();

create or replace function private.require_boolean_config(p_key text)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if coalesce(private.config_boolean(p_key),false) is not true then
    raise exception using errcode='55000',message=p_key||'_disabled';
  end if;
end
$function$;

create or replace function private.append_payout_operation_event(
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_actor_user_id uuid,
  p_actor_role private.user_role,
  p_request_id uuid,
  p_metadata_json jsonb default '{}'::jsonb
)
returns private.payout_operation_events
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_event private.payout_operation_events;
begin
  insert into private.payout_operation_events(
    entity_type,entity_id,event_type,actor_user_id,actor_role,request_id,metadata_json
  ) values(
    p_entity_type,p_entity_id,p_event_type,p_actor_user_id,p_actor_role,p_request_id,coalesce(p_metadata_json,'{}'::jsonb)
  )
  returning * into v_event;
  return v_event;
exception when unique_violation then
  select * into v_event from private.payout_operation_events where request_id=p_request_id;
  if v_event.entity_type is distinct from p_entity_type
     or v_event.entity_id is distinct from p_entity_id
     or v_event.event_type is distinct from p_event_type
     or v_event.actor_user_id is distinct from p_actor_user_id then
    raise exception using errcode='23505',message='request_id_conflict';
  end if;
  return v_event;
end
$function$;

create or replace function public.admin_list_kyc_operational_queue(
  p_actor_user_id uuid,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  kyc_profile_id uuid,
  user_id uuid,
  display_name text,
  status text,
  document_type text,
  document_number_last4 text,
  country_code text,
  submitted_at timestamptz,
  assigned_to uuid,
  review_started_at timestamptz,
  review_due_at timestamptz,
  document_count bigint,
  age_minutes bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status private.kyc_status;
begin
  perform private.require_boolean_config('kyc_operational_review_enabled');
  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_limit not between 1 and 200 or p_offset<0 then
    raise exception using errcode='22023',message='invalid_pagination';
  end if;
  if p_status is not null then
    begin
      v_status:=p_status::private.kyc_status;
    exception when invalid_text_representation then
      raise exception using errcode='22023',message='invalid_kyc_status';
    end;
  end if;
  return query
  select kp.id,kp.user_id,p.display_name,kp.status::text,kp.document_type::text,kp.document_number_last4,
    kp.country_code::text,kp.submitted_at,kp.assigned_to,kp.review_started_at,kp.review_due_at,
    (select count(*) from private.kyc_documents kd where kd.kyc_profile_id=kp.id and kd.status<>'deleted'),
    greatest(0,floor(extract(epoch from (now()-coalesce(kp.submitted_at,kp.created_at)))/60)::bigint),
    count(*) over()
  from private.kyc_profiles kp
  join public.profiles p on p.id=kp.user_id
  where (v_status is null or kp.status=v_status)
  order by case when kp.status='pending' then 0 else 1 end,
    coalesce(kp.review_due_at,kp.submitted_at,kp.created_at),kp.id
  limit p_limit offset p_offset;
end
$function$;

create or replace function public.admin_list_bank_operational_queue(
  p_actor_user_id uuid,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  bank_account_id uuid,
  user_id uuid,
  display_name text,
  bank_code text,
  account_number_last4 text,
  status text,
  is_default boolean,
  created_at timestamptz,
  assigned_to uuid,
  review_started_at timestamptz,
  review_due_at timestamptz,
  age_minutes bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status private.bank_account_status;
begin
  perform private.require_boolean_config('bank_account_operational_review_enabled');
  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_limit not between 1 and 200 or p_offset<0 then
    raise exception using errcode='22023',message='invalid_pagination';
  end if;
  if p_status is not null then
    begin
      v_status:=p_status::private.bank_account_status;
    exception when invalid_text_representation then
      raise exception using errcode='22023',message='invalid_bank_status';
    end;
  end if;
  return query
  select ba.id,ba.user_id,p.display_name,ba.bank_code,ba.account_number_last4,ba.status::text,ba.is_default,
    ba.created_at,ba.assigned_to,ba.review_started_at,ba.review_due_at,
    greatest(0,floor(extract(epoch from (now()-ba.created_at))/60)::bigint),count(*) over()
  from private.bank_accounts ba
  join public.profiles p on p.id=ba.user_id
  where ba.deleted_at is null and (v_status is null or ba.status=v_status)
  order by case when ba.status='pending' then 0 else 1 end,
    coalesce(ba.review_due_at,ba.created_at),ba.id
  limit p_limit offset p_offset;
end
$function$;

create or replace function public.admin_list_withdrawal_operational_queue(
  p_actor_user_id uuid,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  withdrawal_id uuid,
  creator_id uuid,
  display_name text,
  status text,
  requested_reward_units bigint,
  amount_vnd bigint,
  bank_code text,
  bank_last4 text,
  requested_at timestamptz,
  assigned_to uuid,
  review_started_at timestamptz,
  review_due_at timestamptz,
  approved_by uuid,
  processing_started_by uuid,
  payment_recorded_by uuid,
  payment_reference text,
  payment_evidence_present boolean,
  age_minutes bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status private.withdrawal_status;
begin
  perform private.require_boolean_config('withdrawal_operational_review_enabled');
  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_limit not between 1 and 200 or p_offset<0 then
    raise exception using errcode='22023',message='invalid_pagination';
  end if;
  if p_status is not null then
    begin
      v_status:=p_status::private.withdrawal_status;
    exception when invalid_text_representation then
      raise exception using errcode='22023',message='invalid_withdrawal_status';
    end;
  end if;
  return query
  select w.id,w.creator_id,p.display_name,w.status::text,w.requested_reward_units,w.amount_vnd,
    w.bank_code_snapshot,w.bank_account_last4_snapshot,w.requested_at,w.assigned_to,w.review_started_at,w.review_due_at,
    w.approved_by,w.processing_started_by,w.payment_recorded_by,w.payment_reference,
    w.payment_evidence_sha256 is not null,
    greatest(0,floor(extract(epoch from (now()-w.requested_at))/60)::bigint),count(*) over()
  from private.withdrawals w
  join public.profiles p on p.id=w.creator_id
  where v_status is null or w.status=v_status
  order by case w.status when 'pending' then 0 when 'under_review' then 1 when 'approved' then 2 when 'processing' then 3 else 4 end,
    coalesce(w.review_due_at,w.requested_at),w.id
  limit p_limit offset p_offset;
end
$function$;

create or replace function public.admin_start_kyc_review(
  p_actor_user_id uuid,
  p_kyc_profile_id uuid,
  p_request_id uuid
)
returns table(kyc_profile_id uuid,status text,assigned_to uuid,review_due_at timestamptz,already_processed boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_profile private.kyc_profiles%rowtype;
  v_event private.payout_operation_events%rowtype;
begin
  perform private.require_boolean_config('kyc_operational_review_enabled');
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_event from private.payout_operation_events where request_id=p_request_id;
  if found then
    select * into v_profile from private.kyc_profiles where id=p_kyc_profile_id;
    return query select v_profile.id,v_profile.status::text,v_profile.assigned_to,v_profile.review_due_at,true;
    return;
  end if;
  select * into v_profile from private.kyc_profiles where id=p_kyc_profile_id for update;
  if not found or v_profile.status<>'pending' then raise exception using errcode='42501',message='pending_kyc_required'; end if;
  if v_profile.assigned_to is not null and v_profile.assigned_to is distinct from p_actor_user_id then
    raise exception using errcode='42501',message='kyc_review_already_assigned';
  end if;
  update private.kyc_profiles
  set assigned_to=p_actor_user_id,review_started_at=coalesce(review_started_at,now()),
      review_due_at=coalesce(review_due_at,now()+interval '24 hours'),last_operation_request_id=p_request_id
  where id=p_kyc_profile_id returning * into v_profile;
  perform private.append_payout_operation_event('kyc_profile',v_profile.id,'review_started',p_actor_user_id,v_role,p_request_id,
    jsonb_build_object('status',v_profile.status::text,'review_due_at',v_profile.review_due_at));
  perform private.append_admin_audit(p_actor_user_id,v_role,'kyc_review_started','kyc_profile',v_profile.id,
    jsonb_build_object('assigned_to',null),jsonb_build_object('assigned_to',p_actor_user_id,'review_due_at',v_profile.review_due_at),
    null,p_request_id,null,null);
  return query select v_profile.id,v_profile.status::text,v_profile.assigned_to,v_profile.review_due_at,false;
end
$function$;

create or replace function public.admin_start_bank_review(
  p_actor_user_id uuid,
  p_bank_account_id uuid,
  p_request_id uuid
)
returns table(bank_account_id uuid,status text,assigned_to uuid,review_due_at timestamptz,already_processed boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_bank private.bank_accounts%rowtype;
  v_event private.payout_operation_events%rowtype;
begin
  perform private.require_boolean_config('bank_account_operational_review_enabled');
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_event from private.payout_operation_events where request_id=p_request_id;
  if found then
    select * into v_bank from private.bank_accounts where id=p_bank_account_id;
    return query select v_bank.id,v_bank.status::text,v_bank.assigned_to,v_bank.review_due_at,true;
    return;
  end if;
  select * into v_bank from private.bank_accounts where id=p_bank_account_id and deleted_at is null for update;
  if not found or v_bank.status<>'pending' then raise exception using errcode='42501',message='pending_bank_account_required'; end if;
  if v_bank.assigned_to is not null and v_bank.assigned_to is distinct from p_actor_user_id then
    raise exception using errcode='42501',message='bank_review_already_assigned';
  end if;
  update private.bank_accounts
  set assigned_to=p_actor_user_id,review_started_at=coalesce(review_started_at,now()),
      review_due_at=coalesce(review_due_at,now()+interval '24 hours'),last_operation_request_id=p_request_id
  where id=p_bank_account_id returning * into v_bank;
  perform private.append_payout_operation_event('bank_account',v_bank.id,'review_started',p_actor_user_id,v_role,p_request_id,
    jsonb_build_object('status',v_bank.status::text,'review_due_at',v_bank.review_due_at));
  perform private.append_admin_audit(p_actor_user_id,v_role,'bank_review_started','bank_account',v_bank.id,
    jsonb_build_object('assigned_to',null),jsonb_build_object('assigned_to',p_actor_user_id,'review_due_at',v_bank.review_due_at),
    null,p_request_id,null,null);
  return query select v_bank.id,v_bank.status::text,v_bank.assigned_to,v_bank.review_due_at,false;
end
$function$;

create or replace function public.admin_start_withdrawal_review(
  p_actor_user_id uuid,
  p_withdrawal_id uuid,
  p_request_id uuid
)
returns table(withdrawal_id uuid,status text,assigned_to uuid,review_due_at timestamptz,already_processed boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_withdrawal private.withdrawals%rowtype;
  v_event private.payout_operation_events%rowtype;
begin
  perform private.require_boolean_config('withdrawal_operational_review_enabled');
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_event from private.payout_operation_events where request_id=p_request_id;
  if found then
    select * into v_withdrawal from private.withdrawals where id=p_withdrawal_id;
    return query select v_withdrawal.id,v_withdrawal.status::text,v_withdrawal.assigned_to,v_withdrawal.review_due_at,true;
    return;
  end if;
  select * into v_withdrawal from private.withdrawals where id=p_withdrawal_id for update;
  if not found or v_withdrawal.status not in ('pending','under_review') then
    raise exception using errcode='42501',message='withdrawal_not_reviewable';
  end if;
  if v_withdrawal.assigned_to is not null and v_withdrawal.assigned_to is distinct from p_actor_user_id then
    raise exception using errcode='42501',message='withdrawal_review_already_assigned';
  end if;
  update private.withdrawals
  set status='under_review',assigned_to=p_actor_user_id,review_started_at=coalesce(review_started_at,now()),
      review_due_at=coalesce(review_due_at,now()+interval '4 hours'),reviewed_at=coalesce(reviewed_at,now()),
      last_operation_request_id=p_request_id
  where id=p_withdrawal_id returning * into v_withdrawal;
  perform private.append_payout_operation_event('withdrawal',v_withdrawal.id,'review_started',p_actor_user_id,v_role,p_request_id,
    jsonb_build_object('status',v_withdrawal.status::text,'review_due_at',v_withdrawal.review_due_at));
  perform private.append_admin_audit(p_actor_user_id,v_role,'withdrawal_review_started','withdrawal',v_withdrawal.id,
    jsonb_build_object('status','pending'),jsonb_build_object('status','under_review','assigned_to',p_actor_user_id,'review_due_at',v_withdrawal.review_due_at),
    null,p_request_id,null,null);
  perform private.bump_payout_sync(v_withdrawal.creator_id,false,false,true,false);
  return query select v_withdrawal.id,v_withdrawal.status::text,v_withdrawal.assigned_to,v_withdrawal.review_due_at,false;
end
$function$;

create or replace function public.admin_review_kyc(
  p_actor_user_id uuid,
  p_kyc_profile_id uuid,
  p_decision text,
  p_reason_code text,
  p_expires_at timestamptz,
  p_request_id uuid
)
returns table(kyc_profile_id uuid,status text,payout_eligible boolean,already_processed boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_kyc private.kyc_profiles%rowtype;
  v_existing private.admin_audit_logs%rowtype;
  v_eligible boolean;
  v_before jsonb;
begin
  perform private.require_boolean_config('kyc_operational_review_enabled');
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select a.* into v_existing from private.admin_audit_logs a where a.request_id=p_request_id;
  if found then
    if v_existing.target_type<>'kyc_profile' or v_existing.target_id<>p_kyc_profile_id
       or v_existing.action not in ('kyc_approved','kyc_rejected') then
      raise exception using errcode='23505',message='request_id_conflict';
    end if;
    select * into v_kyc from private.kyc_profiles where id=p_kyc_profile_id;
    select cp.payout_eligible into v_eligible from public.creator_profiles cp where cp.user_id=v_kyc.user_id;
    return query select v_kyc.id,v_kyc.status::text,coalesce(v_eligible,false),true;
    return;
  end if;
  if p_decision not in ('approve','reject') then raise exception using errcode='22023',message='invalid_kyc_decision'; end if;
  select * into v_kyc from private.kyc_profiles where id=p_kyc_profile_id for update;
  if not found or v_kyc.status<>'pending' then raise exception using errcode='42501',message='pending_kyc_required'; end if;
  if v_kyc.assigned_to is distinct from p_actor_user_id then raise exception using errcode='42501',message='kyc_review_assignment_required'; end if;
  if p_decision='approve' and p_expires_at is not null and p_expires_at<=now() then
    raise exception using errcode='22023',message='kyc_expiry_must_be_future';
  end if;
  if p_decision='reject' and (p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$') then
    raise exception using errcode='22023',message='kyc_rejection_reason_required';
  end if;
  v_before:=jsonb_build_object('status',v_kyc.status::text,'assigned_to',v_kyc.assigned_to);
  update private.kyc_profiles
  set status=case when p_decision='approve' then 'approved'::private.kyc_status else 'rejected'::private.kyc_status end,
      reviewed_at=now(),reviewed_by=p_actor_user_id,
      rejection_reason_code=case when p_decision='reject' then p_reason_code else null end,
      expires_at=case when p_decision='approve' then p_expires_at else null end,
      last_operation_request_id=p_request_id
  where id=v_kyc.id returning * into v_kyc;
  update private.kyc_documents
  set status=case when p_decision='approve' then 'reviewed'::private.kyc_document_status else 'rejected'::private.kyc_document_status end
  where kyc_profile_id=v_kyc.id;
  v_eligible:=private.refresh_creator_payout_eligibility(v_kyc.user_id);
  perform private.append_payout_operation_event('kyc_profile',v_kyc.id,
    case when p_decision='approve' then 'approved' else 'rejected' end,p_actor_user_id,v_role,p_request_id,
    jsonb_build_object('status',v_kyc.status::text,'expires_at',v_kyc.expires_at,'reason_code',p_reason_code));
  perform private.append_admin_audit(p_actor_user_id,v_role,
    'kyc_'||case when p_decision='approve' then 'approved' else 'rejected' end,'kyc_profile',v_kyc.id,v_before,
    jsonb_build_object('status',v_kyc.status::text,'expires_at',v_kyc.expires_at),p_reason_code,p_request_id,null,null);
  perform private.bump_payout_sync(v_kyc.user_id,true,false,false,false);
  return query select v_kyc.id,v_kyc.status::text,v_eligible,false;
end
$function$;

create or replace function public.admin_review_bank_account(
  p_actor_user_id uuid,
  p_bank_account_id uuid,
  p_decision text,
  p_reason_code text,
  p_request_id uuid
)
returns table(bank_account_id uuid,status text,payout_eligible boolean,already_processed boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_bank private.bank_accounts%rowtype;
  v_existing private.admin_audit_logs%rowtype;
  v_eligible boolean;
  v_before jsonb;
begin
  perform private.require_boolean_config('bank_account_operational_review_enabled');
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_existing from private.admin_audit_logs where request_id=p_request_id;
  if found then
    if v_existing.target_type<>'bank_account' or v_existing.target_id<>p_bank_account_id
       or v_existing.action not in ('bank_verified','bank_rejected','bank_disabled') then
      raise exception using errcode='23505',message='request_id_conflict';
    end if;
    select * into v_bank from private.bank_accounts where id=p_bank_account_id;
    select cp.payout_eligible into v_eligible from public.creator_profiles cp where cp.user_id=v_bank.user_id;
    return query select v_bank.id,v_bank.status::text,coalesce(v_eligible,false),true;
    return;
  end if;
  if p_decision not in ('verify','reject','disable') then raise exception using errcode='22023',message='invalid_bank_decision'; end if;
  select * into v_bank from private.bank_accounts where id=p_bank_account_id and deleted_at is null for update;
  if not found or (p_decision in ('verify','reject') and v_bank.status<>'pending') then
    raise exception using errcode='42501',message='bank_account_not_reviewable';
  end if;
  if p_decision in ('verify','reject') and v_bank.assigned_to is distinct from p_actor_user_id then
    raise exception using errcode='42501',message='bank_review_assignment_required';
  end if;
  if p_decision='reject' and (p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$') then
    raise exception using errcode='22023',message='bank_rejection_reason_required';
  end if;
  v_before:=jsonb_build_object('status',v_bank.status::text,'assigned_to',v_bank.assigned_to,'bank_code',v_bank.bank_code,'last4',v_bank.account_number_last4);
  update private.bank_accounts
  set status=case p_decision when 'verify' then 'verified'::private.bank_account_status when 'reject' then 'rejected'::private.bank_account_status else 'disabled'::private.bank_account_status end,
      verified_at=case when p_decision='verify' then now() else null end,
      verified_by=case when p_decision='verify' then p_actor_user_id else null end,
      rejection_reason_code=case when p_decision='reject' then p_reason_code else null end,
      deleted_at=case when p_decision='disable' then now() else deleted_at end,
      is_default=case when p_decision='disable' then false else is_default end,
      last_operation_request_id=p_request_id
  where id=v_bank.id returning * into v_bank;
  v_eligible:=private.refresh_creator_payout_eligibility(v_bank.user_id);
  perform private.append_payout_operation_event('bank_account',v_bank.id,
    case p_decision when 'verify' then 'approved' when 'reject' then 'rejected' else 'disabled' end,
    p_actor_user_id,v_role,p_request_id,jsonb_build_object('status',v_bank.status::text,'reason_code',p_reason_code));
  perform private.append_admin_audit(p_actor_user_id,v_role,
    'bank_'||case p_decision when 'verify' then 'verified' when 'reject' then 'rejected' else 'disabled' end,
    'bank_account',v_bank.id,v_before,
    jsonb_build_object('status',v_bank.status::text,'bank_code',v_bank.bank_code,'last4',v_bank.account_number_last4),
    p_reason_code,p_request_id,null,null);
  perform private.bump_payout_sync(v_bank.user_id,false,true,false,false);
  return query select v_bank.id,v_bank.status::text,v_eligible,false;
end
$function$;

create or replace function public.admin_operate_withdrawal(
  p_actor_user_id uuid,
  p_withdrawal_id uuid,
  p_action text,
  p_reason_code text,
  p_payment_reference text,
  p_payment_evidence_sha256 text,
  p_request_id uuid
)
returns table(
  withdrawal_id uuid,
  status text,
  held_balance_units bigint,
  paid_balance_units bigint,
  approved_by uuid,
  processing_started_by uuid,
  payment_recorded_by uuid,
  already_processed boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_withdrawal private.withdrawals%rowtype;
  v_existing private.admin_audit_logs%rowtype;
  v_account private.creator_earning_accounts%rowtype;
  v_alloc private.withdrawal_reward_allocations%rowtype;
  v_before jsonb;
  v_event_type text;
begin
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  if p_action not in ('approve','reject','start_processing','mark_paid') then
    raise exception using errcode='22023',message='invalid_withdrawal_action';
  end if;
  if p_action in ('approve','reject') then perform private.require_boolean_config('withdrawal_operational_review_enabled'); end if;
  if p_action='start_processing' then perform private.require_boolean_config('withdrawal_processing_enabled'); end if;
  if p_action='mark_paid' then perform private.require_boolean_config('withdrawal_payout_enabled'); end if;
  select * into v_existing from private.admin_audit_logs where request_id=p_request_id;
  if found then
    if v_existing.target_type<>'withdrawal' or v_existing.target_id<>p_withdrawal_id
       or v_existing.action<>('withdrawal_'||p_action) then
      raise exception using errcode='23505',message='request_id_conflict';
    end if;
    select * into v_withdrawal from private.withdrawals where id=p_withdrawal_id;
    select * into v_account from private.creator_earning_accounts where creator_id=v_withdrawal.creator_id;
    return query select v_withdrawal.id,v_withdrawal.status::text,coalesce(v_account.held_units,0),coalesce(v_account.paid_units,0),
      v_withdrawal.approved_by,v_withdrawal.processing_started_by,v_withdrawal.payment_recorded_by,true;
    return;
  end if;
  select * into v_withdrawal from private.withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception using errcode='23503',message='withdrawal_not_found'; end if;
  select * into v_account from private.creator_earning_accounts where creator_id=v_withdrawal.creator_id for update;
  if not found then raise exception using errcode='23503',message='creator_earning_account_not_found'; end if;
  v_before:=jsonb_build_object('status',v_withdrawal.status::text,'assigned_to',v_withdrawal.assigned_to,
    'approved_by',v_withdrawal.approved_by,'processing_started_by',v_withdrawal.processing_started_by);

  if p_action='approve' then
    if v_withdrawal.status<>'under_review' or v_withdrawal.assigned_to is distinct from p_actor_user_id then
      raise exception using errcode='42501',message='assigned_under_review_withdrawal_required';
    end if;
    update private.withdrawals
    set status='approved',reviewed_at=coalesce(reviewed_at,now()),reviewed_by=p_actor_user_id,
        approved_at=now(),approved_by=p_actor_user_id,rejection_reason_code=null,last_operation_request_id=p_request_id
    where id=v_withdrawal.id returning * into v_withdrawal;
    v_event_type:='approved';
  elsif p_action='reject' then
    if v_withdrawal.status not in ('pending','under_review','approved') then
      raise exception using errcode='42501',message='withdrawal_not_rejectable';
    end if;
    if v_withdrawal.status='under_review' and v_withdrawal.assigned_to is distinct from p_actor_user_id then
      raise exception using errcode='42501',message='withdrawal_review_assignment_required';
    end if;
    if p_reason_code is null or p_reason_code!~'^[a-z][a-z0-9_]{1,63}$' then
      raise exception using errcode='22023',message='withdrawal_rejection_reason_required';
    end if;
    for v_alloc in select * from private.withdrawal_reward_allocations where withdrawal_id=v_withdrawal.id for update loop
      update private.creator_reward_positions
      set held_units=held_units-v_alloc.allocated_units,available_units=available_units+v_alloc.allocated_units,
          status=private.reward_position_status_for(original_units,pending_units,available_units+v_alloc.allocated_units,held_units-v_alloc.allocated_units,paid_units,reversed_units)
      where gift_transaction_id=v_alloc.gift_transaction_id;
      update private.withdrawal_reward_allocations
      set released_units=allocated_units
      where withdrawal_id=v_withdrawal.id and gift_transaction_id=v_alloc.gift_transaction_id;
    end loop;
    update private.creator_earning_accounts
    set held_units=held_units-v_withdrawal.requested_reward_units,
        available_units=available_units+v_withdrawal.requested_reward_units,version=version+1
    where creator_id=v_withdrawal.creator_id returning * into v_account;
    update private.withdrawals
    set status='rejected',reviewed_at=coalesce(reviewed_at,now()),reviewed_by=p_actor_user_id,
        rejection_reason_code=p_reason_code,approved_at=null,approved_by=null,last_operation_request_id=p_request_id
    where id=v_withdrawal.id returning * into v_withdrawal;
    insert into private.creator_reward_ledger(
      creator_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json
    ) values(
      v_withdrawal.creator_id,'withdrawal_released',v_withdrawal.requested_reward_units,now(),'withdrawal',v_withdrawal.id,
      p_request_id,jsonb_build_object('status','rejected','reason_code',p_reason_code)
    );
    v_event_type:='rejected';
  elsif p_action='start_processing' then
    if v_withdrawal.status<>'approved' then raise exception using errcode='42501',message='approved_withdrawal_required'; end if;
    if v_withdrawal.approved_by=p_actor_user_id then raise exception using errcode='42501',message='withdrawal_dual_control_required'; end if;
    update private.withdrawals
    set status='processing',processing_started_at=now(),processing_started_by=p_actor_user_id,last_operation_request_id=p_request_id
    where id=v_withdrawal.id returning * into v_withdrawal;
    v_event_type:='processing_started';
  else
    if v_withdrawal.status<>'processing' then raise exception using errcode='42501',message='processing_withdrawal_required'; end if;
    if v_withdrawal.approved_by=p_actor_user_id then raise exception using errcode='42501',message='withdrawal_dual_control_required'; end if;
    if nullif(btrim(p_payment_reference),'') is null or char_length(btrim(p_payment_reference))>120 then
      raise exception using errcode='22023',message='payment_reference_required';
    end if;
    if lower(coalesce(p_payment_evidence_sha256,''))!~'^[0-9a-f]{64}$' then
      raise exception using errcode='22023',message='payment_evidence_sha256_required';
    end if;
    for v_alloc in select * from private.withdrawal_reward_allocations where withdrawal_id=v_withdrawal.id for update loop
      update private.creator_reward_positions
      set held_units=held_units-v_alloc.allocated_units,paid_units=paid_units+v_alloc.allocated_units,
          status=private.reward_position_status_for(original_units,pending_units,available_units,held_units-v_alloc.allocated_units,paid_units+v_alloc.allocated_units,reversed_units)
      where gift_transaction_id=v_alloc.gift_transaction_id;
      update private.withdrawal_reward_allocations
      set paid_units=allocated_units
      where withdrawal_id=v_withdrawal.id and gift_transaction_id=v_alloc.gift_transaction_id;
    end loop;
    update private.creator_earning_accounts
    set held_units=held_units-v_withdrawal.requested_reward_units,
        paid_units=paid_units+v_withdrawal.requested_reward_units,version=version+1
    where creator_id=v_withdrawal.creator_id returning * into v_account;
    update private.withdrawals
    set status='paid',paid_at=now(),payment_reference=btrim(p_payment_reference),
        payment_evidence_sha256=lower(p_payment_evidence_sha256),payment_recorded_by=p_actor_user_id,
        last_operation_request_id=p_request_id
    where id=v_withdrawal.id returning * into v_withdrawal;
    insert into private.creator_reward_ledger(
      creator_id,entry_type,amount_units,available_at,reference_type,reference_id,idempotency_key,metadata_json
    ) values(
      v_withdrawal.creator_id,'withdrawal_paid',v_withdrawal.requested_reward_units,now(),'withdrawal',v_withdrawal.id,
      p_request_id,jsonb_build_object('status','paid','payment_reference_present',true,'payment_evidence_present',true)
    );
    v_event_type:='paid';
  end if;

  if p_action in ('reject','mark_paid') then
    update public.economy_sync set creator_account_version=v_account.version,updated_at=now() where user_id=v_withdrawal.creator_id;
  end if;
  perform private.append_payout_operation_event('withdrawal',v_withdrawal.id,v_event_type,p_actor_user_id,v_role,p_request_id,
    jsonb_build_object('status',v_withdrawal.status::text,'reason_code',p_reason_code,
      'payment_reference_present',v_withdrawal.payment_reference is not null,
      'payment_evidence_present',v_withdrawal.payment_evidence_sha256 is not null));
  perform private.append_admin_audit(p_actor_user_id,v_role,'withdrawal_'||p_action,'withdrawal',v_withdrawal.id,v_before,
    jsonb_build_object('status',v_withdrawal.status::text,'approved_by',v_withdrawal.approved_by,
      'processing_started_by',v_withdrawal.processing_started_by,'payment_recorded_by',v_withdrawal.payment_recorded_by,
      'payment_reference_present',v_withdrawal.payment_reference is not null,'payment_evidence_present',v_withdrawal.payment_evidence_sha256 is not null),
    p_reason_code,p_request_id,null,null);
  perform private.bump_payout_sync(v_withdrawal.creator_id,false,false,true,false);
  return query select v_withdrawal.id,v_withdrawal.status::text,v_account.held_units,v_account.paid_units,
    v_withdrawal.approved_by,v_withdrawal.processing_started_by,v_withdrawal.payment_recorded_by,false;
end
$function$;

-- Sensitive review payloads are only available while the corresponding operational gate is enabled
-- and the case is assigned to the requesting operator.
create or replace function public.server_get_kyc_review_payload(
  p_actor_user_id uuid,
  p_kyc_profile_id uuid,
  p_request_id uuid
)
returns table(
  kyc_profile_id uuid,user_id uuid,legal_name_ciphertext text,document_type text,
  document_number_ciphertext text,document_number_last4 text,country_code text,status text,
  submitted_at timestamptz,document_ids uuid[]
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_kyc private.kyc_profiles%rowtype;
  v_documents uuid[];
begin
  perform private.require_boolean_config('kyc_operational_review_enabled');
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_kyc from private.kyc_profiles where id=p_kyc_profile_id;
  if not found then raise exception using errcode='23503',message='kyc_profile_not_found'; end if;
  if v_kyc.assigned_to is distinct from p_actor_user_id then raise exception using errcode='42501',message='kyc_review_assignment_required'; end if;
  select coalesce(array_agg(id order by created_at,id),'{}'::uuid[]) into v_documents
  from private.kyc_documents where kyc_profile_id=v_kyc.id and status<>'deleted';
  perform private.append_payout_operation_event('kyc_profile',v_kyc.id,'sensitive_viewed',p_actor_user_id,v_role,p_request_id,
    jsonb_build_object('status',v_kyc.status::text,'document_count',cardinality(v_documents)));
  perform private.append_admin_audit(p_actor_user_id,v_role,'kyc_sensitive_viewed','kyc_profile',v_kyc.id,'{}'::jsonb,
    jsonb_build_object('status',v_kyc.status::text,'document_count',cardinality(v_documents)),'kyc_review_access',p_request_id,null,null);
  return query select v_kyc.id,v_kyc.user_id,v_kyc.legal_name_ciphertext,v_kyc.document_type::text,
    v_kyc.document_number_ciphertext,v_kyc.document_number_last4,v_kyc.country_code::text,v_kyc.status::text,
    v_kyc.submitted_at,v_documents;
end
$function$;

create or replace function public.server_get_bank_review_payload(
  p_actor_user_id uuid,
  p_bank_account_id uuid,
  p_request_id uuid
)
returns table(
  bank_account_id uuid,user_id uuid,bank_code text,account_number_ciphertext text,
  account_number_last4 text,account_holder_ciphertext text,status text,is_default boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_bank private.bank_accounts%rowtype;
begin
  perform private.require_boolean_config('bank_account_operational_review_enabled');
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_bank from private.bank_accounts where id=p_bank_account_id and deleted_at is null;
  if not found then raise exception using errcode='23503',message='bank_account_not_found'; end if;
  if v_bank.assigned_to is distinct from p_actor_user_id then raise exception using errcode='42501',message='bank_review_assignment_required'; end if;
  perform private.append_payout_operation_event('bank_account',v_bank.id,'sensitive_viewed',p_actor_user_id,v_role,p_request_id,
    jsonb_build_object('status',v_bank.status::text,'bank_code',v_bank.bank_code,'last4',v_bank.account_number_last4));
  perform private.append_admin_audit(p_actor_user_id,v_role,'bank_sensitive_viewed','bank_account',v_bank.id,'{}'::jsonb,
    jsonb_build_object('status',v_bank.status::text,'bank_code',v_bank.bank_code,'last4',v_bank.account_number_last4),
    'bank_review_access',p_request_id,null,null);
  return query select v_bank.id,v_bank.user_id,v_bank.bank_code,v_bank.account_number_ciphertext,
    v_bank.account_number_last4,v_bank.account_holder_ciphertext,v_bank.status::text,v_bank.is_default;
end
$function$;

create or replace function public.server_authorize_kyc_document_access(
  p_actor_user_id uuid,
  p_kyc_document_id uuid,
  p_request_id uuid
)
returns table(kyc_document_id uuid,storage_bucket text,storage_path text,mime_type text,document_side text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role private.user_role;
  v_document private.kyc_documents%rowtype;
  v_media public.media_assets%rowtype;
  v_profile private.kyc_profiles%rowtype;
begin
  perform private.require_boolean_config('kyc_operational_review_enabled');
  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;
  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);
  select * into v_document from private.kyc_documents where id=p_kyc_document_id and status<>'deleted';
  if not found then raise exception using errcode='23503',message='kyc_document_not_found'; end if;
  select * into v_profile from private.kyc_profiles where id=v_document.kyc_profile_id;
  if v_profile.assigned_to is distinct from p_actor_user_id then raise exception using errcode='42501',message='kyc_review_assignment_required'; end if;
  select * into v_media from public.media_assets
  where id=v_document.media_id and storage_bucket='kyc-private' and visibility='kyc' and deleted_at is null;
  if not found then raise exception using errcode='23503',message='kyc_document_media_not_found'; end if;
  perform private.append_payout_operation_event('kyc_profile',v_profile.id,'document_accessed',p_actor_user_id,v_role,p_request_id,
    jsonb_build_object('kyc_document_id',v_document.id,'document_side',v_document.document_side::text,'mime_type',v_media.mime_type,'signed_url_ttl_seconds',60));
  perform private.append_admin_audit(p_actor_user_id,v_role,'kyc_document_accessed','kyc_document',v_document.id,'{}'::jsonb,
    jsonb_build_object('document_side',v_document.document_side::text,'mime_type',v_media.mime_type,'signed_url_ttl_seconds',60),
    'kyc_document_review',p_request_id,null,null);
  return query select v_document.id,v_media.storage_bucket,v_media.storage_path,v_media.mime_type,v_document.document_side::text;
end
$function$;

-- Fail-closed client and legacy admin paths.
revoke execute on function public.prepare_kyc_document_upload(text,bigint,text,integer,integer,text,text) from public,anon,authenticated;
revoke execute on function public.finalize_kyc_document_upload(uuid,text) from public,anon,authenticated;
revoke execute on function public.request_withdrawal(uuid,bigint,uuid) from public,anon,authenticated;
revoke execute on function public.admin_decide_withdrawal(uuid,uuid,text,text,text,uuid) from public,anon,authenticated,service_role;

revoke all on function public.admin_list_kyc_operational_queue(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_list_bank_operational_queue(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_list_withdrawal_operational_queue(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_start_kyc_review(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.admin_start_bank_review(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.admin_start_withdrawal_review(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.admin_operate_withdrawal(uuid,uuid,text,text,text,text,uuid) from public,anon,authenticated;

grant execute on function public.admin_list_kyc_operational_queue(uuid,text,integer,integer) to service_role;
grant execute on function public.admin_list_bank_operational_queue(uuid,text,integer,integer) to service_role;
grant execute on function public.admin_list_withdrawal_operational_queue(uuid,text,integer,integer) to service_role;
grant execute on function public.admin_start_kyc_review(uuid,uuid,uuid) to service_role;
grant execute on function public.admin_start_bank_review(uuid,uuid,uuid) to service_role;
grant execute on function public.admin_start_withdrawal_review(uuid,uuid,uuid) to service_role;
grant execute on function public.admin_operate_withdrawal(uuid,uuid,text,text,text,text,uuid) to service_role;

grant execute on function public.admin_review_kyc(uuid,uuid,text,text,timestamptz,uuid) to service_role;
grant execute on function public.admin_review_bank_account(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.server_get_kyc_review_payload(uuid,uuid,uuid) to service_role;
grant execute on function public.server_get_bank_review_payload(uuid,uuid,uuid) to service_role;
grant execute on function public.server_authorize_kyc_document_access(uuid,uuid,uuid) to service_role;

commit;
