-- MyFan Phase B / Session 10
-- Private KYC, bank accounts, manual withdrawals, account deletion and immutable audit.

alter type public.media_type add value if not exists 'document';

create type private.kyc_status as enum ('not_submitted','pending','approved','rejected','expired','suspended');
create type private.kyc_document_type as enum ('national_id','passport','drivers_license','residence_permit','other');
create type private.kyc_document_side as enum ('front','back','portrait','supplemental');
create type private.kyc_document_status as enum ('uploaded','submitted','reviewed','rejected','retained','deleted');
create type private.bank_account_status as enum ('pending','verified','rejected','disabled');
create type private.withdrawal_status as enum ('pending','under_review','approved','rejected','processing','paid','cancelled','reversed');
create type private.account_hold_type as enum ('fraud','compliance','chargeback','manual_review','legal');
create type private.account_hold_scope as enum ('gift','purchase','creator_reward','withdrawal','account');
create type private.account_deletion_status as enum ('requested','scheduled','cancelled','processing','completed','blocked_by_legal_hold');

create table private.kyc_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null unique references public.creator_profiles(user_id) on delete restrict,
  legal_name_ciphertext text,
  document_type private.kyc_document_type,
  document_number_ciphertext text,
  document_number_last4 text,
  country_code char(2),
  status private.kyc_status not null default 'not_submitted',
  submission_request_id uuid unique,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  rejection_reason_code text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kyc_ciphertext_format check (
    (legal_name_ciphertext is null or legal_name_ciphertext ~ '^v1\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$')
    and (document_number_ciphertext is null or document_number_ciphertext ~ '^v1\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$')
  ),
  constraint kyc_last4_format check (document_number_last4 is null or document_number_last4 ~ '^[A-Z0-9]{4}$'),
  constraint kyc_country_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint kyc_submission_fields check (
    status='not_submitted'
    or (legal_name_ciphertext is not null and document_type is not null and document_number_ciphertext is not null
        and document_number_last4 is not null and country_code is not null and submitted_at is not null)
  ),
  constraint kyc_review_state check (
    (status in ('approved','rejected','suspended','expired') and reviewed_at is not null)
    or (status in ('not_submitted','pending') and reviewed_at is null)
  ),
  constraint kyc_rejection_reason check (status='rejected' or rejection_reason_code is null),
  constraint kyc_expiry_after_review check (expires_at is null or reviewed_at is null or expires_at>reviewed_at)
);

create table private.kyc_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  kyc_profile_id uuid not null references private.kyc_profiles(id) on delete restrict,
  media_id uuid not null unique references public.media_assets(id) on delete restrict,
  document_side private.kyc_document_side not null,
  status private.kyc_document_status not null default 'uploaded',
  retained_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kyc_profile_id,document_side,media_id),
  constraint kyc_document_retention_future check (retained_until is null or retained_until>created_at)
);

create table private.bank_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.creator_profiles(user_id) on delete restrict,
  bank_code text not null,
  account_number_ciphertext text not null,
  account_number_last4 text not null,
  account_holder_ciphertext text not null,
  status private.bank_account_status not null default 'pending',
  is_default boolean not null default false,
  submission_request_id uuid not null unique,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  rejection_reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint bank_code_format check (bank_code ~ '^[A-Z0-9_-]{2,32}$'),
  constraint bank_ciphertext_format check (
    account_number_ciphertext ~ '^v1\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$'
    and account_holder_ciphertext ~ '^v1\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$'
  ),
  constraint bank_last4_format check (account_number_last4 ~ '^[0-9]{4}$'),
  constraint bank_verification_state check ((status='verified' and verified_at is not null) or status<>'verified'),
  constraint bank_rejection_reason check (status='rejected' or rejection_reason_code is null),
  constraint bank_deleted_state check (deleted_at is null or status='disabled')
);
create unique index bank_accounts_one_default_idx on private.bank_accounts(user_id) where is_default and deleted_at is null and status<>'disabled';

create table private.withdrawals (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete restrict,
  bank_account_id uuid not null references private.bank_accounts(id) on delete restrict,
  requested_reward_units bigint not null,
  amount_vnd bigint not null,
  heart_vnd_rate_snapshot bigint not null,
  heart_units_per_heart_snapshot bigint not null,
  bank_code_snapshot text not null,
  bank_account_last4_snapshot text not null,
  bank_account_holder_ciphertext_snapshot text not null,
  status private.withdrawal_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  rejection_reason_code text,
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(creator_id,idempotency_key),
  constraint withdrawals_units_positive check (requested_reward_units>0 and amount_vnd>0 and heart_vnd_rate_snapshot>0 and heart_units_per_heart_snapshot>0),
  constraint withdrawals_last4_format check (bank_account_last4_snapshot ~ '^[0-9]{4}$'),
  constraint withdrawals_holder_ciphertext_format check (bank_account_holder_ciphertext_snapshot ~ '^v1\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$'),
  constraint withdrawals_review_state check ((status in ('under_review','approved','rejected','processing','paid','reversed') and reviewed_at is not null) or status in ('pending','cancelled')),
  constraint withdrawals_approval_state check ((status in ('approved','processing','paid','reversed') and approved_at is not null) or status in ('pending','under_review','rejected','cancelled')),
  constraint withdrawals_paid_state check ((status='paid' and paid_at is not null and payment_reference is not null) or status<>'paid'),
  constraint withdrawals_rejection_reason check (status='rejected' or rejection_reason_code is null)
);

create table private.withdrawal_reward_allocations (
  withdrawal_id uuid not null references private.withdrawals(id) on delete restrict,
  gift_transaction_id uuid not null references private.creator_reward_positions(gift_transaction_id) on delete restrict,
  allocated_units bigint not null,
  released_units bigint not null default 0,
  paid_units bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key(withdrawal_id,gift_transaction_id),
  constraint withdrawal_allocations_positive check (allocated_units>0),
  constraint withdrawal_allocations_conservation check (released_units>=0 and paid_units>=0 and released_units+paid_units<=allocated_units)
);

create table private.account_holds (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  hold_type private.account_hold_type not null,
  reason_code text not null,
  scope private.account_hold_scope not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  released_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint account_holds_reason_format check (reason_code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint account_holds_time_range check (ends_at is null or ends_at>starts_at),
  constraint account_holds_release_state check ((released_at is null and released_by is null) or (released_at is not null and released_by is not null and released_at>=starts_at))
);

create table private.account_deletion_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status private.account_deletion_status not null default 'requested',
  requested_at timestamptz not null default now(),
  scheduled_delete_at timestamptz,
  cancelled_at timestamptz,
  processed_at timestamptz,
  legal_hold boolean not null default false,
  reason text,
  idempotency_key uuid not null unique,
  previous_profile_status public.profile_status not null,
  previous_discovery_enabled boolean not null,
  previous_nearby_enabled boolean not null,
  previous_account_status private.account_status not null,
  previous_payout_eligible boolean not null default false,
  previous_creator_account_frozen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deletion_reason_length check (reason is null or char_length(reason)<=500),
  constraint deletion_schedule_state check (status in ('cancelled','completed') or scheduled_delete_at is not null),
  constraint deletion_cancel_state check ((status='cancelled' and cancelled_at is not null) or status<>'cancelled'),
  constraint deletion_processed_state check ((status='completed' and processed_at is not null) or status<>'completed'),
  constraint deletion_legal_hold_state check (not legal_hold or status='blocked_by_legal_hold')
);
create unique index account_deletion_one_active_idx on private.account_deletion_requests(user_id)
where status in ('requested','scheduled','processing','blocked_by_legal_hold');

create table private.admin_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role private.user_role not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  reason text,
  request_id uuid not null unique,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  constraint audit_action_format check (action ~ '^[a-z][a-z0-9_]{2,95}$'),
  constraint audit_target_format check (target_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint audit_json_objects check (jsonb_typeof(before_json)='object' and jsonb_typeof(after_json)='object'),
  constraint audit_reason_length check (reason is null or char_length(reason)<=1000),
  constraint audit_hash_format check ((ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$') and (user_agent_hash is null or user_agent_hash ~ '^[0-9a-f]{64}$'))
);

create table public.payout_sync (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kyc_version bigint not null default 0,
  bank_version bigint not null default 0,
  withdrawal_version bigint not null default 0,
  deletion_version bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint payout_sync_versions_nonnegative check (kyc_version>=0 and bank_version>=0 and withdrawal_version>=0 and deletion_version>=0)
);

create index kyc_profiles_status_submitted_idx on private.kyc_profiles(status,submitted_at,id);
create index kyc_documents_profile_status_idx on private.kyc_documents(kyc_profile_id,status,created_at);
create index bank_accounts_user_status_idx on private.bank_accounts(user_id,status,created_at desc) where deleted_at is null;
create index withdrawals_creator_created_idx on private.withdrawals(creator_id,created_at desc,id);
create index withdrawals_status_created_idx on private.withdrawals(status,created_at,id);
create index withdrawals_bank_idx on private.withdrawals(bank_account_id,created_at desc);
create index withdrawal_allocations_gift_idx on private.withdrawal_reward_allocations(gift_transaction_id,withdrawal_id);
create index account_holds_user_active_idx on private.account_holds(user_id,scope,starts_at) where released_at is null;
create index account_deletion_user_created_idx on private.account_deletion_requests(user_id,created_at desc);
create index admin_audit_actor_created_idx on private.admin_audit_logs(actor_user_id,created_at desc,id);
create index admin_audit_target_created_idx on private.admin_audit_logs(target_type,target_id,created_at desc);

create trigger kyc_profiles_set_updated_at before update on private.kyc_profiles for each row execute function private.set_updated_at();
create trigger kyc_documents_set_updated_at before update on private.kyc_documents for each row execute function private.set_updated_at();
create trigger bank_accounts_set_updated_at before update on private.bank_accounts for each row execute function private.set_updated_at();
create trigger withdrawals_set_updated_at before update on private.withdrawals for each row execute function private.set_updated_at();
create trigger account_deletion_requests_set_updated_at before update on private.account_deletion_requests for each row execute function private.set_updated_at();

create or replace function private.prevent_admin_audit_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception using errcode='42501',message='admin_audit_logs_are_immutable';
end $$;
create trigger admin_audit_logs_immutable before update or delete on private.admin_audit_logs for each row execute function private.prevent_admin_audit_mutation();

create or replace function private.validate_kyc_document_media()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_media public.media_assets%rowtype;
begin
  select kp.user_id into v_owner from private.kyc_profiles kp where kp.id=new.kyc_profile_id;
  select * into v_media from public.media_assets where id=new.media_id;
  if v_owner is null or v_media.id is null then raise exception using errcode='23503',message='kyc_profile_or_media_not_found'; end if;
  if v_media.owner_id<>v_owner or v_media.visibility<>'kyc' or v_media.storage_bucket<>'kyc-private' then
    raise exception using errcode='42501',message='invalid_kyc_document_media';
  end if;
  return new;
end $$;
create trigger kyc_documents_validate_media before insert or update on private.kyc_documents for each row execute function private.validate_kyc_document_media();

create or replace function private.bootstrap_payout_sync()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.payout_sync(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end $$;
create trigger profiles_bootstrap_payout_sync after insert on public.profiles for each row execute function private.bootstrap_payout_sync();
insert into public.payout_sync(user_id) select id from public.profiles on conflict(user_id) do nothing;

alter table private.kyc_profiles enable row level security;
alter table private.kyc_documents enable row level security;
alter table private.bank_accounts enable row level security;
alter table private.withdrawals enable row level security;
alter table private.withdrawal_reward_allocations enable row level security;
alter table private.account_holds enable row level security;
alter table private.account_deletion_requests enable row level security;
alter table private.admin_audit_logs enable row level security;
alter table public.payout_sync enable row level security;

revoke all on private.kyc_profiles,private.kyc_documents,private.bank_accounts,private.withdrawals,private.withdrawal_reward_allocations,private.account_holds,private.account_deletion_requests,private.admin_audit_logs from public,anon,authenticated;
revoke all on public.payout_sync from public,anon,authenticated;
grant all on private.kyc_profiles,private.kyc_documents,private.bank_accounts,private.withdrawals,private.withdrawal_reward_allocations,private.account_holds,private.account_deletion_requests,private.admin_audit_logs to service_role;
grant all on public.payout_sync to service_role;

revoke all on function private.prevent_admin_audit_mutation() from public,anon,authenticated;
revoke all on function private.validate_kyc_document_media() from public,anon,authenticated;
revoke all on function private.bootstrap_payout_sync() from public,anon,authenticated;

comment on table private.kyc_profiles is 'Encrypted Creator KYC state; exact identity data is never exposed through public schema or logs.';
comment on table private.bank_accounts is 'Encrypted Creator payout destinations; clients receive only bank code and last four digits.';
comment on table private.withdrawals is 'Manual Creator payout requests backed by held Creator reward positions and immutable audit events.';
comment on table private.admin_audit_logs is 'Append-only audit trail. before_json and after_json must contain redacted metadata only.';
comment on table public.payout_sync is 'Owner-only Realtime invalidation metadata shared by Expo Web, Android and iOS.';
