-- Historical migration reconciliation for temporary beta asset transport.
--
-- The original operation existed only long enough to bootstrap non-production
-- fixture media. All transport helpers were removed remotely by
-- 20260731103608_cleanup_one_time_beta_seed_transport.sql. Recreating those
-- helpers during reset would reintroduce an unnecessary privileged surface.

do $$
begin
  perform 1;
end
$$;
