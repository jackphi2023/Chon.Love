begin;

-- UI-BAL02: /balance is an authenticated purchase surface. The underlying
-- payment/order tables remain RPC-only; only the bounded owner-facing VietQR
-- functions are callable by signed-in members. Settlement stays server-only.
revoke execute on function public.list_vietqr_heart_products() from public, anon;
revoke execute on function public.create_vietqr_heart_order(uuid, uuid) from public, anon;
revoke execute on function public.get_my_vietqr_heart_order(uuid) from public, anon;
revoke execute on function public.mark_my_vietqr_transfer_submitted(uuid) from public, anon;
revoke execute on function public.cancel_my_vietqr_heart_order(uuid) from public, anon;

grant execute on function public.list_vietqr_heart_products() to authenticated, service_role;
grant execute on function public.create_vietqr_heart_order(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_my_vietqr_heart_order(uuid) to authenticated, service_role;
grant execute on function public.mark_my_vietqr_transfer_submitted(uuid) to authenticated, service_role;
grant execute on function public.cancel_my_vietqr_heart_order(uuid) to authenticated, service_role;

do $$
begin
  if not has_function_privilege('authenticated', 'public.list_vietqr_heart_products()'::regprocedure, 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_vietqr_heart_order(uuid,uuid)'::regprocedure, 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_vietqr_heart_order(uuid)'::regprocedure, 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.mark_my_vietqr_transfer_submitted(uuid)'::regprocedure, 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.cancel_my_vietqr_heart_order(uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'UI-BAL02 authenticated VietQR RPC ACL invariant failed';
  end if;

  if has_function_privilege('anon', 'public.list_vietqr_heart_products()'::regprocedure, 'EXECUTE')
     or has_function_privilege('anon', 'public.create_vietqr_heart_order(uuid,uuid)'::regprocedure, 'EXECUTE')
     or has_function_privilege('anon', 'public.get_my_vietqr_heart_order(uuid)'::regprocedure, 'EXECUTE')
     or has_function_privilege('anon', 'public.mark_my_vietqr_transfer_submitted(uuid)'::regprocedure, 'EXECUTE')
     or has_function_privilege('anon', 'public.cancel_my_vietqr_heart_order(uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'UI-BAL02 anonymous VietQR RPC exposure invariant failed';
  end if;

  -- Bank reconciliation is deliberately not a browser mutation.
  if has_function_privilege(
    'authenticated',
    'public.record_verified_vietqr_payment(uuid,text,bigint,uuid)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'UI-BAL02 settlement RPC must remain server-only';
  end if;
end $$;

commit;
