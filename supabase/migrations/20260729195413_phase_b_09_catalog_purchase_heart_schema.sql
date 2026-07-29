-- MyFan Phase B / Session 9
-- Heart products, digital gifts, immutable financial ledgers, Creator rewards and Fan state.

create type public.gift_transaction_status as enum ('completed','partially_reversed','reversed');
create type public.fan_membership_status as enum ('active','revoked');
create type private.play_purchase_state as enum ('pending','purchased','consumed','cancelled','refunded','revoked');
create type private.heart_ledger_entry_type as enum (
  'purchase_credit','gift_debit','refund_debit','reversal_credit',
  'admin_adjustment_credit','admin_adjustment_debit','expiration_debit'
);
create type private.creator_reward_entry_type as enum (
  'gift_reward_pending','reward_released','reward_held','reward_unheld','reward_reversed',
  'withdrawal_hold','withdrawal_paid','withdrawal_released','admin_adjustment'
);
create type private.reward_position_status as enum ('pending','available','held','paid','partially_reversed','reversed');
create type private.purchase_reversal_type as enum ('refund','revocation');
create type private.creator_liability_status as enum ('open','resolved','waived');

create table public.heart_products (
  id uuid primary key default extensions.gen_random_uuid(),
  google_product_id text not null unique,
  heart_units bigint not null,
  display_hearts integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint heart_products_google_id_format check (google_product_id ~ '^[a-z0-9][a-z0-9._]{2,99}$'),
  constraint heart_products_display_positive check (display_hearts > 0),
  constraint heart_products_units_positive check (heart_units > 0),
  constraint heart_products_units_match check (heart_units = display_hearts::bigint * 100)
);

create table public.gift_catalog (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name_vi text not null,
  name_en text not null,
  icon_media_id uuid references public.media_assets(id) on delete set null,
  heart_price_units bigint not null,
  display_hearts integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint gift_catalog_slug_format check (slug ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint gift_catalog_name_vi_length check (char_length(btrim(name_vi)) between 1 and 80),
  constraint gift_catalog_name_en_length check (char_length(btrim(name_en)) between 1 and 80),
  constraint gift_catalog_price_positive check (heart_price_units > 0 and display_hearts > 0),
  constraint gift_catalog_price_match check (heart_price_units = display_hearts::bigint * 100),
  constraint gift_catalog_deleted_state check (deleted_at is null or is_active = false)
);

create table private.play_purchases (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.heart_products(id) on delete restrict,
  google_product_id text not null,
  purchase_token_hash text not null unique,
  purchase_token_ciphertext bytea,
  google_order_id text unique,
  purchase_state private.play_purchase_state not null,
  heart_units bigint not null,
  currency_code char(3),
  gross_amount_micros bigint,
  country_code char(2),
  obfuscated_external_account_id text,
  is_test_purchase boolean not null default false,
  verified_at timestamptz,
  acknowledged_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  refunded_at timestamptz,
  raw_response_encrypted bytea,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint play_purchases_token_hash_format check (purchase_token_hash ~ '^[0-9a-f]{64}$'),
  constraint play_purchases_google_id_length check (char_length(google_product_id) between 3 and 100),
  constraint play_purchases_units_positive check (heart_units > 0),
  constraint play_purchases_currency_format check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  constraint play_purchases_country_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint play_purchases_amount_nonnegative check (gross_amount_micros is null or gross_amount_micros >= 0),
  constraint play_purchases_verified_state check (verified_at is null or purchase_state in ('purchased','consumed','refunded','revoked')),
  constraint play_purchases_consumed_state check (consumed_at is null or purchase_state in ('consumed','refunded','revoked')),
  constraint play_purchases_refunded_state check (refunded_at is null or purchase_state = 'refunded'),
  constraint play_purchases_revoked_state check (revoked_at is null or purchase_state = 'revoked')
);

create table private.heart_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  available_units bigint not null default 0,
  held_units bigint not null default 0,
  lifetime_purchased_units bigint not null default 0,
  lifetime_spent_units bigint not null default 0,
  lifetime_reversed_units bigint not null default 0,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint heart_accounts_available_nonnegative check (available_units >= 0),
  constraint heart_accounts_held_nonnegative check (held_units >= 0),
  constraint heart_accounts_lifetime_nonnegative check (lifetime_purchased_units >= 0 and lifetime_spent_units >= 0 and lifetime_reversed_units >= 0),
  constraint heart_accounts_version_nonnegative check (version >= 0)
);

create table private.heart_lots (
  purchase_id uuid primary key references private.play_purchases(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  original_units bigint not null,
  available_units bigint not null,
  spent_units bigint not null default 0,
  reversed_units bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint heart_lots_units_nonnegative check (original_units > 0 and available_units >= 0 and spent_units >= 0 and reversed_units >= 0),
  constraint heart_lots_conservation check (original_units = available_units + spent_units + reversed_units)
);

create table private.heart_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  entry_type private.heart_ledger_entry_type not null,
  amount_units bigint not null,
  balance_after_units bigint not null,
  reference_type text not null,
  reference_id uuid,
  idempotency_key uuid not null unique,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint heart_ledger_amount_nonzero check (amount_units <> 0),
  constraint heart_ledger_balance_nonnegative check (balance_after_units >= 0),
  constraint heart_ledger_reference_format check (reference_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint heart_ledger_metadata_object check (jsonb_typeof(metadata_json) = 'object'),
  constraint heart_ledger_entry_sign check (
    (entry_type in ('purchase_credit','reversal_credit','admin_adjustment_credit') and amount_units > 0)
    or (entry_type in ('gift_debit','refund_debit','admin_adjustment_debit','expiration_debit') and amount_units < 0)
  )
);
