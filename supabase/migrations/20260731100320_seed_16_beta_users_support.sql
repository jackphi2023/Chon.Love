-- Historical migration reconciliation for the one-time 16-account beta bootstrap.
--
-- The original remote operation created temporary bootstrap support used by a
-- privileged, one-time Edge Function. The final cleanup migration removed all
-- helper objects, so a clean database rebuild must not recreate an operational
-- seed endpoint or privileged helper.
--
-- Beta fixture accounts are operational test data, not product schema. They are
-- intentionally not inserted by migrations.

do $$
begin
  perform 1;
end
$$;
