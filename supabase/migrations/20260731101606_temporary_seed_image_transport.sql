-- Historical migration reconciliation for temporary beta image transport.
--
-- The one-time remote helper had no durable product-schema responsibility and
-- was removed after fixture creation. This inert entry preserves exact remote
-- migration ordering without restoring a seed or network transport capability.

do $$
begin
  perform 1;
end
$$;
