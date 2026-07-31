create table public.gift_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete restrict,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  gift_id uuid not null references public.gift_catalog(id) on delete restrict,
  gift_slug_snapshot text not null,
  gift_name_vi_snapshot text not null,
  gift_name_en_snapshot text not null,
  quantity integer not null,
  unit_heart_units bigint not null,
  gross_heart_units bigint not null,
  creator_share_bps integer not null,
  platform_share_bps integer not null,
  creator_reward_units bigint not null,
  platform_gross_units bigint not null,
  reversed_heart_units bigint not null default 0,
  reversed_creator_reward_units bigint not null default 0,
  reversed_platform_units bigint not null default 0,
  status public.gift_transaction_status not null default 'completed',
  message_id uuid unique,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  reversed_at timestamptz,
  constraint gift_transactions_not_self check (sender_id <> creator_id),
  constraint gift_transactions_quantity_positive check (quantity between 1 and 100),
  constraint gift_transactions_unit_positive check (unit_heart_units > 0),
  constraint gift_transactions_gross_match check (gross_heart_units = quantity::bigint * unit_heart_units),
  constraint gift_transactions_share_range check (creator_share_bps between 0 and 10000 and platform_share_bps between 0 and 10000 and creator_share_bps + platform_share_bps = 10000),
  constraint gift_transactions_split_match check (creator_reward_units >= 0 and platform_gross_units >= 0 and creator_reward_units + platform_gross_units = gross_heart_units),
  constraint gift_transactions_reversed_nonnegative check (reversed_heart_units >= 0 and reversed_creator_reward_units >= 0 and reversed_platform_units >= 0),
  constraint gift_transactions_reversed_bounds check (reversed_heart_units <= gross_heart_units and reversed_creator_reward_units <= creator_reward_units and reversed_platform_units <= platform_gross_units),
  constraint gift_transactions_reversed_split check (reversed_creator_reward_units + reversed_platform_units = reversed_heart_units),
  constraint gift_transactions_status_match check (
    (status='completed' and reversed_heart_units=0 and reversed_at is null)
    or (status='partially_reversed' and reversed_heart_units>0 and reversed_heart_units<gross_heart_units and reversed_at is not null)
    or (status='reversed' and reversed_heart_units=gross_heart_units and reversed_at is not null)
  ),
  unique(sender_id,idempotency_key)
);

create table private.gift_funding_allocations (
  gift_transaction_id uuid not null references public.gift_transactions(id) on delete restrict,
  purchase_id uuid not null references private.play_purchases(id) on delete restrict,
  allocated_units bigint not null,
  reversed_units bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key(gift_transaction_id,purchase_id),
  constraint gift_funding_units_positive check (allocated_units > 0),
  constraint gift_funding_reversed_bounds check (reversed_units between 0 and allocated_units)
);

create table private.creator_earning_accounts (
  creator_id uuid primary key references public.creator_profiles(user_id) on delete restrict,
  pending_units bigint not null default 0,
  available_units bigint not null default 0,
  held_units bigint not null default 0,
  paid_units bigint not null default 0,
  reversed_units bigint not null default 0,
  is_frozen boolean not null default false,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_earning_balances_nonnegative check (pending_units >= 0 and available_units >= 0 and held_units >= 0 and paid_units >= 0 and reversed_units >= 0),
  constraint creator_earning_version_nonnegative check (version >= 0)
);

create table private.creator_reward_positions (
  gift_transaction_id uuid primary key references public.gift_transactions(id) on delete restrict,
  creator_id uuid not null references public.creator_profiles(user_id) on delete restrict,
  original_units bigint not null,
  pending_units bigint not null,
  available_units bigint not null default 0,
  held_units bigint not null default 0,
  paid_units bigint not null default 0,
  reversed_units bigint not null default 0,
  available_at timestamptz not null,
  status private.reward_position_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reward_positions_units_nonnegative check (original_units >= 0 and pending_units >= 0 and available_units >= 0 and held_units >= 0 and paid_units >= 0 and reversed_units >= 0),
  constraint reward_positions_conservation check (original_units = pending_units + available_units + held_units + paid_units + reversed_units),
  constraint reward_positions_status_match check (
    (status='pending' and pending_units>0 and reversed_units=0)
    or (status='available' and pending_units=0 and available_units>0 and reversed_units<original_units)
    or (status='held' and held_units>0 and reversed_units<original_units)
    or (status='paid' and paid_units>0 and reversed_units<original_units)
    or (status='partially_reversed' and reversed_units>0 and reversed_units<original_units)
    or (status='reversed' and reversed_units=original_units)
  )
);

create table private.creator_reward_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete restrict,
  gift_transaction_id uuid references public.gift_transactions(id) on delete restrict,
  entry_type private.creator_reward_entry_type not null,
  amount_units bigint not null,
  available_at timestamptz,
  reference_type text not null,
  reference_id uuid,
  idempotency_key uuid not null unique,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint creator_reward_amount_nonzero check (amount_units <> 0),
  constraint creator_reward_reference_format check (reference_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint creator_reward_metadata_object check (jsonb_typeof(metadata_json)='object'),
  constraint creator_reward_entry_sign check (entry_type='reward_reversed' or amount_units>0),
  constraint creator_reward_reversal_sign check (entry_type<>'reward_reversed' or amount_units<0)
);

create table public.fan_progress (
  creator_id uuid not null references public.creator_profiles(user_id) on delete restrict,
  fan_user_id uuid not null references public.profiles(id) on delete restrict,
  lifetime_supported_units bigint not null default 0,
  eligible_units bigint not null default 0,
  threshold_units bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(creator_id,fan_user_id),
  constraint fan_progress_not_self check (creator_id <> fan_user_id),
  constraint fan_progress_units_nonnegative check (lifetime_supported_units >= 0 and eligible_units >= 0 and threshold_units > 0),
  constraint fan_progress_eligible_lifetime check (eligible_units <= lifetime_supported_units)
);

create table public.fan_memberships (
  creator_id uuid not null references public.creator_profiles(user_id) on delete restrict,
  fan_user_id uuid not null references public.profiles(id) on delete restrict,
  achieved_at timestamptz not null,
  status public.fan_membership_status not null default 'active',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(creator_id,fan_user_id),
  constraint fan_memberships_not_self check (creator_id <> fan_user_id),
  constraint fan_memberships_revocation_state check ((status='active' and revoked_at is null) or (status='revoked' and revoked_at is not null))
);

create table private.purchase_reversal_events (
  id uuid primary key default extensions.gen_random_uuid(),
  purchase_id uuid not null references private.play_purchases(id) on delete restrict,
  event_type private.purchase_reversal_type not null,
  reason_code text not null,
  unspent_debited_units bigint not null default 0,
  spent_reversed_units bigint not null default 0,
  creator_reward_reversed_units bigint not null default 0,
  creator_liability_units bigint not null default 0,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  constraint purchase_reversal_reason_format check (reason_code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint purchase_reversal_units_nonnegative check (unspent_debited_units >= 0 and spent_reversed_units >= 0 and creator_reward_reversed_units >= 0 and creator_liability_units >= 0),
  unique(purchase_id,event_type)
);

create table private.creator_reward_liabilities (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete restrict,
  purchase_id uuid not null references private.play_purchases(id) on delete restrict,
  gift_transaction_id uuid not null references public.gift_transactions(id) on delete restrict,
  amount_units bigint not null,
  reason_code text not null,
  status private.creator_liability_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint creator_liability_amount_positive check (amount_units > 0),
  constraint creator_liability_reason_format check (reason_code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint creator_liability_resolution_state check ((status='open' and resolved_at is null) or (status in ('resolved','waived') and resolved_at is not null)),
  unique(purchase_id,gift_transaction_id)
);

create table public.economy_sync (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  heart_account_version bigint not null default 0,
  creator_account_version bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint economy_sync_versions_nonnegative check (heart_account_version >= 0 and creator_account_version >= 0)
);

alter table public.messages add constraint messages_gift_transaction_id_fkey foreign key(gift_transaction_id) references public.gift_transactions(id) on delete restrict;
alter table public.gift_transactions add constraint gift_transactions_message_id_fkey foreign key(message_id) references public.messages(id) on delete set null;
create unique index messages_one_gift_transaction_idx on public.messages(gift_transaction_id) where gift_transaction_id is not null;

create index heart_products_active_sort_idx on public.heart_products(is_active,sort_order,id);
create index gift_catalog_active_sort_idx on public.gift_catalog(is_active,sort_order,id) where deleted_at is null;
create index play_purchases_user_created_idx on private.play_purchases(user_id,created_at desc);
create index play_purchases_state_created_idx on private.play_purchases(purchase_state,created_at);
create index play_purchases_product_idx on private.play_purchases(product_id,created_at desc);
create index heart_lots_user_available_idx on private.heart_lots(user_id,created_at,purchase_id) where available_units > 0;
create index heart_ledger_user_created_idx on private.heart_ledger(user_id,created_at desc,id);
create index heart_ledger_reference_idx on private.heart_ledger(reference_type,reference_id) where reference_id is not null;
create index gift_transactions_sender_created_idx on public.gift_transactions(sender_id,created_at desc,id);
create index gift_transactions_creator_created_idx on public.gift_transactions(creator_id,created_at desc,id);
create index gift_transactions_status_created_idx on public.gift_transactions(status,created_at);
create index gift_transactions_gift_idx on public.gift_transactions(gift_id,created_at desc);
create index gift_funding_purchase_idx on private.gift_funding_allocations(purchase_id,gift_transaction_id);
create index creator_reward_positions_creator_due_idx on private.creator_reward_positions(creator_id,available_at,gift_transaction_id) where pending_units > 0;
create index creator_reward_ledger_creator_created_idx on private.creator_reward_ledger(creator_id,created_at desc,id);
create index creator_reward_ledger_gift_idx on private.creator_reward_ledger(gift_transaction_id,created_at) where gift_transaction_id is not null;
create index fan_progress_fan_updated_idx on public.fan_progress(fan_user_id,updated_at desc,creator_id);
create index fan_memberships_fan_status_idx on public.fan_memberships(fan_user_id,status,updated_at desc);
create index purchase_reversal_purchase_idx on private.purchase_reversal_events(purchase_id,created_at desc);
create index creator_liabilities_creator_status_idx on private.creator_reward_liabilities(creator_id,status,created_at);

create trigger heart_products_set_updated_at before update on public.heart_products for each row execute function private.set_updated_at();
create trigger gift_catalog_set_updated_at before update on public.gift_catalog for each row execute function private.set_updated_at();
create trigger play_purchases_set_updated_at before update on private.play_purchases for each row execute function private.set_updated_at();
create trigger heart_accounts_set_updated_at before update on private.heart_accounts for each row execute function private.set_updated_at();
create trigger heart_lots_set_updated_at before update on private.heart_lots for each row execute function private.set_updated_at();
create trigger creator_earning_accounts_set_updated_at before update on private.creator_earning_accounts for each row execute function private.set_updated_at();
create trigger creator_reward_positions_set_updated_at before update on private.creator_reward_positions for each row execute function private.set_updated_at();
create trigger fan_progress_set_updated_at before update on public.fan_progress for each row execute function private.set_updated_at();
create trigger fan_memberships_set_updated_at before update on public.fan_memberships for each row execute function private.set_updated_at();

insert into public.heart_products(google_product_id,display_hearts,heart_units,sort_order) values
 ('myfan_hearts_005',5,500,10),
 ('myfan_hearts_010',10,1000,20),
 ('myfan_hearts_020',20,2000,30),
 ('myfan_hearts_050',50,5000,40),
 ('myfan_hearts_100',100,10000,50),
 ('myfan_hearts_200',200,20000,60),
 ('myfan_hearts_500',500,50000,70);

insert into public.gift_catalog(slug,name_vi,name_en,display_hearts,heart_price_units,sort_order) values
 ('like','Thích','Like',1,100,10),
 ('star','Ngôi sao','Star',2,200,20),
 ('flower','Bông hoa','Flower',3,300,30),
 ('coffee','Cà phê','Coffee',5,500,40),
 ('smile','Nụ cười','Smile',7,700,50),
 ('applause','Tràng pháo tay','Applause',10,1000,60),
 ('balloon','Bóng bay','Balloon',12,1200,70),
 ('lucky_clover','Cỏ may mắn','Lucky Clover',15,1500,80),
 ('crown','Vương miện','Crown',20,2000,90),
 ('fireworks','Pháo hoa','Fireworks',25,2500,100),
 ('trophy','Cúp danh dự','Trophy',30,3000,110),
 ('rainbow','Cầu vồng','Rainbow',35,3500,120),
 ('diamond','Kim cương','Diamond',40,4000,130),
 ('rocket','Tên lửa','Rocket',50,5000,140),
 ('spotlight','Ánh đèn sân khấu','Spotlight',60,6000,150),
 ('golden_heart','Trái tim vàng','Golden Heart',70,7000,160),
 ('celebration','Lễ hội','Celebration',75,7500,170),
 ('super_star','Siêu sao','Super Star',80,8000,180),
 ('galaxy','Dải ngân hà','Galaxy',90,9000,190),
 ('legend','Huyền thoại','Legend',100,10000,200);

comment on table private.play_purchases is 'Server-verified Google Play purchase records. Purchase tokens are never exposed through the Data API.';
comment on table private.heart_ledger is 'Immutable purchased-heart ledger. Hearts are in-app value and are not withdrawable.';
comment on table private.creator_reward_ledger is 'Immutable Creator reward ledger, separate from purchased heart balances.';
comment on table private.gift_funding_allocations is 'FIFO purchase-lot attribution used for accurate refund and revocation reversals.';
comment on table public.economy_sync is 'Owner-only Realtime version signal; clients refresh private summaries through RPC.';
