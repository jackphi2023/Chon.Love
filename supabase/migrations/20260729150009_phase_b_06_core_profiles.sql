-- MyFan Phase B / Session 6
-- Core profiles, private identity, Creator foundation, roles and application configuration.
-- Generated through `supabase migration new phase_b_06_core_profiles` in CI before commit.

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgtap with schema extensions;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.administrative_areas (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null,
  name_vi text not null,
  name_en text,
  area_type text not null,
  parent_id uuid references public.administrative_areas(id) on delete restrict,
  country_code char(2) not null default 'VN',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint administrative_areas_code_length check (char_length(code) between 1 and 64),
  constraint administrative_areas_name_vi_length check (char_length(name_vi) between 1 and 160),
  constraint administrative_areas_name_en_length check (name_en is null or char_length(name_en) between 1 and 160),
  constraint administrative_areas_type_check check (area_type in ('country', 'province', 'municipality', 'district', 'ward', 'other')),
  constraint administrative_areas_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint administrative_areas_not_self_parent check (parent_id is null or parent_id <> id),
  constraint administrative_areas_code_country_unique unique (country_code, code)
);

create index administrative_areas_active_sort_idx
  on public.administrative_areas (country_code, area_type, is_active, sort_order, name_vi);

create index administrative_areas_parent_idx
  on public.administrative_areas (parent_id)
  where parent_id is not null;

create trigger administrative_areas_set_updated_at
before update on public.administrative_areas
for each row execute function private.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username extensions.citext,
  display_name text,
  bio text,
  gender text,
  province_id uuid references public.administrative_areas(id) on delete set null,
  avatar_media_id uuid,
  profile_status text not null default 'onboarding',
  discovery_enabled boolean not null default false,
  nearby_enabled boolean not null default false,
  is_creator boolean not null default false,
  last_active_at timestamptz,
  username_changed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint profiles_username_unique unique (username),
  constraint profiles_username_length check (username is null or char_length(username::text) between 3 and 30),
  constraint profiles_username_format check (username is null or username::text ~ '^[A-Za-z0-9_]+$'),
  constraint profiles_username_reserved check (
    username is null or lower(username::text) <> all (
      array[
        'admin', 'administrator', 'api', 'auth', 'billing', 'creator_support',
        'finance', 'help', 'moderator', 'myfan', 'official', 'root',
        'security', 'staff', 'support', 'system'
      ]
    )
  ),
  constraint profiles_display_name_length check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 500),
  constraint profiles_gender_check check (gender is null or gender in ('woman', 'man', 'non_binary', 'self_described', 'prefer_not_to_say')),
  constraint profiles_status_check check (profile_status in ('onboarding', 'pending_review', 'active', 'suspended', 'deletion_requested', 'deleted')),
  constraint profiles_deleted_state_check check (
    deleted_at is null or profile_status in ('deletion_requested', 'deleted')
  ),
  constraint profiles_nearby_requires_discovery check (not nearby_enabled or discovery_enabled)
);

create index profiles_username_lookup_idx on public.profiles (username);
create index profiles_province_discovery_idx
  on public.profiles (province_id, profile_status, discovery_enabled, last_active_at desc)
  where deleted_at is null;
create index profiles_status_created_idx
  on public.profiles (profile_status, created_at desc);
create index profiles_creator_active_idx
  on public.profiles (is_creator, profile_status, created_at desc)
  where deleted_at is null;

create or replace function private.enforce_username_change_cooldown()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.username is distinct from old.username then
    if old.username is not null
       and old.username_changed_at is not null
       and old.username_changed_at > timezone('utc', now()) - interval '30 days' then
      raise exception using
        errcode = '23514',
        message = 'username_change_cooldown_active';
    end if;
    new.username_changed_at = timezone('utc', now());
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_username_change_cooldown() from public, anon, authenticated;

create trigger profiles_enforce_username_change_cooldown
before update of username on public.profiles
for each row execute function private.enforce_username_change_cooldown();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create table private.user_identity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date_of_birth date,
  age_verified_at timestamptz,
  age_verification_method text,
  terms_version text,
  terms_accepted_at timestamptz,
  community_rules_version text,
  community_rules_accepted_at timestamptz,
  creator_terms_version text,
  creator_terms_accepted_at timestamptz,
  account_status text not null default 'pending_age_verification',
  suspension_reason_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_identity_dob_not_future check (date_of_birth is null or date_of_birth <= current_date),
  constraint user_identity_age_method_pair check (
    (age_verified_at is null and age_verification_method is null)
    or (age_verified_at is not null and age_verification_method is not null)
  ),
  constraint user_identity_age_verified_is_adult check (
    age_verified_at is null
    or (
      date_of_birth is not null
      and date_of_birth <= (((age_verified_at at time zone 'UTC')::date - interval '18 years')::date)
    )
  ),
  constraint user_identity_terms_pair check (
    (terms_version is null and terms_accepted_at is null)
    or (terms_version is not null and terms_accepted_at is not null)
  ),
  constraint user_identity_community_pair check (
    (community_rules_version is null and community_rules_accepted_at is null)
    or (community_rules_version is not null and community_rules_accepted_at is not null)
  ),
  constraint user_identity_creator_terms_pair check (
    (creator_terms_version is null and creator_terms_accepted_at is null)
    or (creator_terms_version is not null and creator_terms_accepted_at is not null)
  ),
  constraint user_identity_account_status_check check (
    account_status in ('pending_age_verification', 'active', 'suspended', 'deletion_requested', 'deleted')
  ),
  constraint user_identity_suspension_reason_check check (
    (account_status = 'suspended' and suspension_reason_code is not null)
    or (account_status <> 'suspended')
  )
);

create index user_identity_account_status_idx
  on private.user_identity (account_status, created_at desc);
create index user_identity_age_verification_idx
  on private.user_identity (age_verified_at)
  where age_verified_at is not null;

create trigger user_identity_set_updated_at
before update on private.user_identity
for each row execute function private.set_updated_at();

create table public.creator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  creator_status text not null default 'not_applied',
  creator_bio text,
  fan_threshold_units bigint not null default 1000,
  payout_eligible boolean not null default false,
  joined_at timestamptz,
  approved_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint creator_profiles_status_check check (
    creator_status in ('not_applied', 'pending', 'approved', 'rejected', 'suspended', 'closed')
  ),
  constraint creator_profiles_bio_length check (creator_bio is null or char_length(creator_bio) <= 1000),
  constraint creator_profiles_threshold_check check (
    fan_threshold_units >= 100 and fan_threshold_units <= 100000000
  ),
  constraint creator_profiles_payout_requires_approval check (
    not payout_eligible or creator_status = 'approved'
  ),
  constraint creator_profiles_approved_timestamp check (
    creator_status <> 'approved' or approved_at is not null
  ),
  constraint creator_profiles_suspended_timestamp check (
    creator_status <> 'suspended' or suspended_at is not null
  )
);

create index creator_profiles_status_created_idx
  on public.creator_profiles (creator_status, created_at desc);
create index creator_profiles_payout_idx
  on public.creator_profiles (payout_eligible, creator_status)
  where payout_eligible;

create trigger creator_profiles_set_updated_at
before update on public.creator_profiles
for each row execute function private.set_updated_at();

create table private.user_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  constraint user_roles_role_check check (
    role in ('user', 'creator', 'moderator', 'finance_admin', 'super_admin')
  ),
  constraint user_roles_revoke_after_grant check (revoked_at is null or revoked_at >= granted_at)
);

create unique index user_roles_active_unique_idx
  on private.user_roles (user_id, role)
  where revoked_at is null;
create index user_roles_role_active_idx
  on private.user_roles (role, user_id)
  where revoked_at is null;
create index user_roles_granted_by_idx
  on private.user_roles (granted_by)
  where granted_by is not null;

create table private.app_config (
  key text primary key,
  value_json jsonb not null,
  value_type text not null,
  description text not null,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint app_config_key_format check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint app_config_value_type_check check (
    value_type in ('integer', 'integer_or_null', 'boolean', 'text', 'json')
  )
);

create or replace function private.validate_app_config_value()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  scalar_text text;
begin
  scalar_text := new.value_json #>> '{}';

  if new.value_type = 'integer' then
    if jsonb_typeof(new.value_json) <> 'number'
       or scalar_text !~ '^-?[0-9]+$' then
      raise exception using errcode = '23514', message = 'app_config_integer_required';
    end if;
  elsif new.value_type = 'integer_or_null' then
    if new.value_json <> 'null'::jsonb
       and (
         jsonb_typeof(new.value_json) <> 'number'
         or scalar_text !~ '^-?[0-9]+$'
       ) then
      raise exception using errcode = '23514', message = 'app_config_integer_or_null_required';
    end if;
  elsif new.value_type = 'boolean' then
    if jsonb_typeof(new.value_json) <> 'boolean' then
      raise exception using errcode = '23514', message = 'app_config_boolean_required';
    end if;
  elsif new.value_type = 'text' then
    if jsonb_typeof(new.value_json) <> 'string' then
      raise exception using errcode = '23514', message = 'app_config_text_required';
    end if;
  elsif new.value_type = 'json' then
    if new.value_json is null then
      raise exception using errcode = '23514', message = 'app_config_json_required';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_app_config_value() from public, anon, authenticated;

create trigger app_config_validate_value
before insert or update of value_json, value_type on private.app_config
for each row execute function private.validate_app_config_value();

create trigger app_config_set_updated_at
before update on private.app_config
for each row execute function private.set_updated_at();

insert into private.app_config (key, value_json, value_type, description, is_public)
values
  ('heart_units_per_heart', '100'::jsonb, 'integer', 'Canonical number of integer heart units represented by one displayed heart.', true),
  ('heart_vnd_rate', '10000'::jsonb, 'integer', 'Default VND value represented by one heart; transactions must snapshot the applied rate.', true),
  ('creator_share_bps', '7000'::jsonb, 'integer', 'Default Creator reward share in basis points.', true),
  ('platform_share_bps', '3000'::jsonb, 'integer', 'Default platform gross share in basis points.', true),
  ('estimated_google_fee_bps', '1500'::jsonb, 'integer', 'Forecast-only Google Play fee in basis points; actual settlement remains authoritative.', false),
  ('creator_reward_hold_days', '14'::jsonb, 'integer', 'Initial hold period before eligible Creator rewards become available.', true),
  ('minimum_withdrawal_units', '1000'::jsonb, 'integer', 'Minimum Creator reward units required to request a withdrawal.', true),
  ('maximum_daily_gift_units', 'null'::jsonb, 'integer_or_null', 'Daily gifting limit; null until Risk approves a launch value.', false),
  ('maximum_daily_purchase_units', 'null'::jsonb, 'integer_or_null', 'Daily purchase limit; null until Risk approves a launch value.', false),
  ('fan_minimum_units', '1000'::jsonb, 'integer', 'Default minimum eligible support units for Fan benefits.', true),
  ('location_max_radius_meters', '15000'::jsonb, 'integer', 'Maximum nearby discovery radius in meters.', true),
  ('location_stale_after_days', '7'::jsonb, 'integer', 'Location age after which nearby discovery must not use the point.', true),
  ('location_max_accuracy_meters', '5000'::jsonb, 'integer', 'Maximum accuracy value accepted for broad nearby discovery.', true),
  ('account_deletion_grace_days', '30'::jsonb, 'integer', 'Grace period before eligible account deletion processing.', true)
on conflict (key) do nothing;

alter table public.administrative_areas enable row level security;
alter table public.profiles enable row level security;
alter table public.creator_profiles enable row level security;
alter table private.user_identity enable row level security;
alter table private.user_roles enable row level security;
alter table private.app_config enable row level security;

revoke all on public.administrative_areas from public, anon, authenticated;
revoke all on public.profiles from public, anon, authenticated;
revoke all on public.creator_profiles from public, anon, authenticated;

grant select on public.administrative_areas to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.creator_profiles to anon, authenticated;

grant update (
  username,
  display_name,
  bio,
  gender,
  province_id,
  discovery_enabled,
  nearby_enabled,
  last_active_at
) on public.profiles to authenticated;

create policy administrative_areas_read_active
on public.administrative_areas
for select
to anon, authenticated
using (is_active);

create policy profiles_read_active_or_self
on public.profiles
for select
to anon, authenticated
using (
  (profile_status = 'active' and deleted_at is null)
  or id = (select auth.uid())
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy creator_profiles_read_approved_or_self
on public.creator_profiles
for select
to anon, authenticated
using (
  creator_status = 'approved'
  or user_id = (select auth.uid())
);

create or replace function private.sync_creator_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set is_creator = (new.creator_status = 'approved')
  where id = new.user_id;
  return new;
end;
$$;

revoke all on function private.sync_creator_flag() from public, anon, authenticated;

create trigger creator_profiles_sync_creator_flag
after insert or update of creator_status on public.creator_profiles
for each row execute function private.sync_creator_flag();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into private.user_identity (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.creator_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into private.user_roles (user_id, role, granted_by)
  values (new.id, 'user', null)
  on conflict (user_id, role) where revoked_at is null do nothing;

  return new;
exception
  when others then
    raise log 'myfan_auth_bootstrap_failed user_id=% sqlstate=%', new.id, sqlstate;
    raise;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_myfan on auth.users;
create trigger on_auth_user_created_myfan
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function public.get_public_app_config()
returns table (
  key text,
  value_json jsonb,
  value_type text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.key, c.value_json, c.value_type, c.updated_at
  from private.app_config c
  where c.is_public
  order by c.key;
$$;

revoke all on function public.get_public_app_config() from public;
grant execute on function public.get_public_app_config() to anon, authenticated;

create or replace function public.get_my_account_bootstrap()
returns table (
  user_id uuid,
  profile_status text,
  account_status text,
  is_adult_verified boolean,
  terms_accepted boolean,
  community_rules_accepted boolean,
  creator_status text,
  is_creator boolean,
  payout_eligible boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  return query
  select
    p.id,
    p.profile_status,
    i.account_status,
    i.age_verified_at is not null,
    i.terms_accepted_at is not null,
    i.community_rules_accepted_at is not null,
    cp.creator_status,
    p.is_creator,
    cp.payout_eligible
  from public.profiles p
  join private.user_identity i on i.user_id = p.id
  join public.creator_profiles cp on cp.user_id = p.id
  where p.id = current_user_id;
end;
$$;

revoke all on function public.get_my_account_bootstrap() from public, anon;
grant execute on function public.get_my_account_bootstrap() to authenticated;

create or replace function public.complete_adult_onboarding(
  p_date_of_birth date,
  p_confirms_18 boolean,
  p_terms_version text,
  p_community_rules_version text,
  p_username text,
  p_display_name text,
  p_bio text default null,
  p_gender text default null,
  p_province_id uuid default null
)
returns table (
  profile_id uuid,
  profile_status text,
  account_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  accepted_at timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not coalesce(p_confirms_18, false) then
    raise exception using errcode = '23514', message = 'adult_confirmation_required';
  end if;

  if p_date_of_birth is null or p_date_of_birth > (current_date - interval '18 years')::date then
    raise exception using errcode = '23514', message = 'user_must_be_at_least_18';
  end if;

  if p_date_of_birth < date '1900-01-01' then
    raise exception using errcode = '23514', message = 'date_of_birth_out_of_range';
  end if;

  if nullif(btrim(p_terms_version), '') is null
     or nullif(btrim(p_community_rules_version), '') is null then
    raise exception using errcode = '23514', message = 'policy_versions_required';
  end if;

  if p_province_id is not null and not exists (
    select 1
    from public.administrative_areas a
    where a.id = p_province_id
      and a.is_active
      and a.area_type in ('province', 'municipality')
  ) then
    raise exception using errcode = '23503', message = 'active_province_required';
  end if;

  update private.user_identity
  set
    date_of_birth = p_date_of_birth,
    age_verified_at = accepted_at,
    age_verification_method = 'self_declared_dob',
    terms_version = btrim(p_terms_version),
    terms_accepted_at = accepted_at,
    community_rules_version = btrim(p_community_rules_version),
    community_rules_accepted_at = accepted_at,
    account_status = 'active',
    suspension_reason_code = null
  where user_id = current_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'identity_bootstrap_missing';
  end if;

  update public.profiles
  set
    username = nullif(btrim(p_username), '')::extensions.citext,
    display_name = nullif(btrim(p_display_name), ''),
    bio = nullif(btrim(p_bio), ''),
    gender = p_gender,
    province_id = p_province_id,
    profile_status = 'active'
  where id = current_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'profile_bootstrap_missing';
  end if;

  return query
  select p.id, p.profile_status, i.account_status
  from public.profiles p
  join private.user_identity i on i.user_id = p.id
  where p.id = current_user_id;
end;
$$;

revoke all on function public.complete_adult_onboarding(date, boolean, text, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.complete_adult_onboarding(date, boolean, text, text, text, text, text, text, uuid) to authenticated;

create or replace function public.accept_creator_terms(p_creator_terms_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  accepted_at timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if nullif(btrim(p_creator_terms_version), '') is null then
    raise exception using errcode = '23514', message = 'creator_terms_version_required';
  end if;

  update private.user_identity
  set
    creator_terms_version = btrim(p_creator_terms_version),
    creator_terms_accepted_at = accepted_at
  where user_id = current_user_id
    and account_status = 'active'
    and age_verified_at is not null;

  if not found then
    raise exception using errcode = '42501', message = 'active_adult_account_required';
  end if;

  return accepted_at;
end;
$$;

revoke all on function public.accept_creator_terms(text) from public, anon;
grant execute on function public.accept_creator_terms(text) to authenticated;

create or replace function public.apply_for_creator(
  p_creator_bio text,
  p_fan_threshold_units bigint default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  configured_minimum bigint;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select (c.value_json #>> '{}')::bigint
  into configured_minimum
  from private.app_config c
  where c.key = 'fan_minimum_units';

  if not exists (
    select 1
    from private.user_identity i
    where i.user_id = current_user_id
      and i.account_status = 'active'
      and i.age_verified_at is not null
      and i.creator_terms_accepted_at is not null
  ) then
    raise exception using errcode = '42501', message = 'creator_terms_and_adult_account_required';
  end if;

  update public.creator_profiles
  set
    creator_status = 'pending',
    creator_bio = nullif(btrim(p_creator_bio), ''),
    fan_threshold_units = greatest(
      coalesce(p_fan_threshold_units, configured_minimum, 1000),
      coalesce(configured_minimum, 1000)
    ),
    payout_eligible = false,
    joined_at = coalesce(joined_at, timezone('utc', now())),
    approved_at = null,
    suspended_at = null
  where user_id = current_user_id
    and creator_status in ('not_applied', 'rejected');

  if not found then
    raise exception using errcode = '55000', message = 'creator_application_not_allowed';
  end if;

  return 'pending';
end;
$$;

revoke all on function public.apply_for_creator(text, bigint) from public, anon;
grant execute on function public.apply_for_creator(text, bigint) to authenticated;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

comment on schema private is 'Server-only MyFan data. Not exposed through the Data API.';
comment on table public.profiles is 'Cross-platform public profile source for Expo Web, Android, iOS and approved public web surfaces.';
comment on table private.user_identity is 'Private date-of-birth, age assurance and policy acceptance data.';
comment on table private.user_roles is 'Authoritative role source. Never derived from user-editable metadata.';
comment on table private.app_config is 'Server-managed configuration with a restricted public-read RPC.';
comment on function public.complete_adult_onboarding(date, boolean, text, text, text, text, text, text, uuid) is
  'Atomic 18+ onboarding contract shared by Expo Web, Android and iOS clients.';

commit;
