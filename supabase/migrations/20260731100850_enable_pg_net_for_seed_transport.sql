-- Historical migration reconciliation for one-time beta asset transport.
--
-- The remote bootstrap temporarily enabled pg_net only to move fixture assets.
-- BR-01 and the historical cleanup migration guarantee the final product schema
-- does not depend on pg_net. A clean rebuild therefore keeps this step inert.

do $$
begin
  perform 1;
end
$$;
