from pathlib import Path

path = Path('supabase/migrations/20260731192600_br_08_kyc_withdrawal_operational_flow.sql')
text = path.read_text()
old = """  update private.kyc_documents
  set status=case when p_decision='approve' then 'reviewed'::private.kyc_document_status else 'rejected'::private.kyc_document_status end
  where kyc_profile_id=v_kyc.id;"""
new = """  update private.kyc_documents as kd
  set status=case when p_decision='approve' then 'reviewed'::private.kyc_document_status else 'rejected'::private.kyc_document_status end
  where kd.kyc_profile_id=v_kyc.id;"""
if text.count(old) != 1:
    raise SystemExit(f'BR-08 KYC document update target count: {text.count(old)}')
path.write_text(text.replace(old, new, 1))
