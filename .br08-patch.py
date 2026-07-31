from pathlib import Path

path = Path('supabase/migrations/20260731192600_br_08_kyc_withdrawal_operational_flow.sql')
text = path.read_text()

replacements = [
    (
        "  perform private.require_boolean_config('kyc_operational_review_enabled');\n  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);",
        "  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);\n  perform private.require_boolean_config('kyc_operational_review_enabled');",
    ),
    (
        "  perform private.require_boolean_config('bank_account_operational_review_enabled');\n  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);",
        "  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);\n  perform private.require_boolean_config('bank_account_operational_review_enabled');",
    ),
    (
        "  perform private.require_boolean_config('withdrawal_operational_review_enabled');\n  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);",
        "  perform private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);\n  perform private.require_boolean_config('withdrawal_operational_review_enabled');",
    ),
]

for flag in (
    'kyc_operational_review_enabled',
    'bank_account_operational_review_enabled',
    'withdrawal_operational_review_enabled',
):
    replacements.append((
        f"  perform private.require_boolean_config('{flag}');\n"
        "  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;\n"
        "  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);",
        "  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);\n"
        f"  perform private.require_boolean_config('{flag}');\n"
        "  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;",
    ))

replacements.extend([
    (
        "  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;\n  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);",
        "  v_role:=private.actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);\n  if p_request_id is null then raise exception using errcode='22023',message='request_id_required'; end if;",
    ),
    (
        "  update private.kyc_profiles\n  set assigned_to=p_actor_user_id,review_started_at=coalesce(review_started_at,now()),\n      review_due_at=coalesce(review_due_at,now()+interval '24 hours'),last_operation_request_id=p_request_id\n  where id=p_kyc_profile_id returning * into v_profile;",
        "  update private.kyc_profiles as kp\n  set assigned_to=p_actor_user_id,review_started_at=coalesce(kp.review_started_at,now()),\n      review_due_at=coalesce(kp.review_due_at,now()+interval '24 hours'),last_operation_request_id=p_request_id\n  where kp.id=p_kyc_profile_id returning kp.* into v_profile;",
    ),
    (
        "  update private.bank_accounts\n  set assigned_to=p_actor_user_id,review_started_at=coalesce(review_started_at,now()),\n      review_due_at=coalesce(review_due_at,now()+interval '24 hours'),last_operation_request_id=p_request_id\n  where id=p_bank_account_id returning * into v_bank;",
        "  update private.bank_accounts as ba\n  set assigned_to=p_actor_user_id,review_started_at=coalesce(ba.review_started_at,now()),\n      review_due_at=coalesce(ba.review_due_at,now()+interval '24 hours'),last_operation_request_id=p_request_id\n  where ba.id=p_bank_account_id returning ba.* into v_bank;",
    ),
    (
        "  update private.withdrawals\n  set status='under_review',assigned_to=p_actor_user_id,review_started_at=coalesce(review_started_at,now()),\n      review_due_at=coalesce(review_due_at,now()+interval '4 hours'),reviewed_at=coalesce(reviewed_at,now()),\n      last_operation_request_id=p_request_id\n  where id=p_withdrawal_id returning * into v_withdrawal;",
        "  update private.withdrawals as w\n  set status='under_review',assigned_to=p_actor_user_id,review_started_at=coalesce(w.review_started_at,now()),\n      review_due_at=coalesce(w.review_due_at,now()+interval '4 hours'),reviewed_at=coalesce(w.reviewed_at,now()),\n      last_operation_request_id=p_request_id\n  where w.id=p_withdrawal_id returning w.* into v_withdrawal;",
    ),
])

for index, (old, new) in enumerate(replacements, start=1):
    if old not in text:
        raise SystemExit(f'BR-08 migration patch target {index} not found')
    text = text.replace(old, new)

if text.count("actor_role_for(p_actor_user_id,array['finance_admin','super_admin']::private.user_role[]);\n  perform private.require_boolean_config") < 11:
    raise SystemExit('BR-08 role-first coverage is incomplete')

path.write_text(text)
