from pathlib import Path

path = Path('supabase/migrations/20260731192600_br_08_kyc_withdrawal_operational_flow.sql')
text = path.read_text()

replacements = [
    (
        "  select coalesce(array_agg(id order by created_at,id),'{}'::uuid[]) into v_documents\n  from private.kyc_documents where kyc_profile_id=v_kyc.id and status<>'deleted';",
        "  select coalesce(array_agg(kd.id order by kd.created_at,kd.id),'{}'::uuid[]) into v_documents\n  from private.kyc_documents as kd where kd.kyc_profile_id=v_kyc.id and kd.status<>'deleted';",
    ),
    (
        "for v_alloc in select * from private.withdrawal_reward_allocations where withdrawal_id=v_withdrawal.id for update loop",
        "for v_alloc in select wra.* from private.withdrawal_reward_allocations as wra where wra.withdrawal_id=v_withdrawal.id for update loop",
    ),
    (
        "update private.withdrawal_reward_allocations\n      set released_units=allocated_units\n      where withdrawal_id=v_withdrawal.id and gift_transaction_id=v_alloc.gift_transaction_id;",
        "update private.withdrawal_reward_allocations as wra\n      set released_units=wra.allocated_units\n      where wra.withdrawal_id=v_withdrawal.id and wra.gift_transaction_id=v_alloc.gift_transaction_id;",
    ),
    (
        "update private.withdrawal_reward_allocations\n      set paid_units=allocated_units\n      where withdrawal_id=v_withdrawal.id and gift_transaction_id=v_alloc.gift_transaction_id;",
        "update private.withdrawal_reward_allocations as wra\n      set paid_units=wra.allocated_units\n      where wra.withdrawal_id=v_withdrawal.id and wra.gift_transaction_id=v_alloc.gift_transaction_id;",
    ),
    (
        "  select * into v_media from public.media_assets\n  where id=v_document.media_id and storage_bucket='kyc-private' and visibility='kyc' and deleted_at is null;",
        "  select ma.* into v_media from public.media_assets as ma\n  where ma.id=v_document.media_id and ma.storage_bucket='kyc-private' and ma.visibility='kyc' and ma.deleted_at is null;",
    ),
]

expected_counts = [1, 2, 1, 1, 1]
for index, ((old, new), expected) in enumerate(zip(replacements, expected_counts), start=1):
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'BR-08 qualification target {index}: expected {expected}, found {count}')
    text = text.replace(old, new)

path.write_text(text)
