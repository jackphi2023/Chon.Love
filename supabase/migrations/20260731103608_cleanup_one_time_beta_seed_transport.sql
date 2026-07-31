-- Historical final-state cleanup for one-time beta bootstrap transport.
--
-- Remote verification after this migration found no public/private seed, beta,
-- transport or reset helper functions/tables and no pg_net extension. Keep this
-- cleanup idempotent so clean resets converge on the same final state.

drop extension if exists pg_net;

do $$
declare
  v_object record;
begin
  for v_object in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and (
        p.proname ilike '%seed%'
        or p.proname ilike '%beta%'
        or p.proname ilike '%transport%'
        or p.proname ilike '%reset%'
      )
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      v_object.schema_name,
      v_object.function_name,
      v_object.identity_arguments
    );
  end loop;
end
$$;
