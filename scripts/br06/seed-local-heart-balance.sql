-- BR-06 local-only economy fixture.
-- Credit the Viewer through the canonical verified-purchase function so heart_accounts,
-- purchase lots and the immutable ledger stay consistent with production invariants.
do $$
declare
  v_viewer_id uuid;
begin
  select u.id
  into v_viewer_id
  from auth.users u
  where u.email = 'br06.viewer@example.test';

  if v_viewer_id is null then
    raise exception 'BR-06 viewer fixture missing before heart seed';
  end if;

  perform public.record_verified_play_purchase(
    v_viewer_id,
    'myfan_hearts_100',
    repeat('6', 64),
    'BR06-LOCAL-HEART-100',
    encode(extensions.digest(v_viewer_id::text, 'sha256'), 'hex'),
    'VN',
    true,
    '00000000-0000-4000-8000-000000000606'::uuid,
    null
  );
end
$$;
