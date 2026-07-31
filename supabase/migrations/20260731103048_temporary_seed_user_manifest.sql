-- Historical migration reconciliation for the temporary beta user manifest.
--
-- The manifest was an operational bootstrap aid for a fixed test cohort. It was
-- not a durable source of product users and was removed after provisioning.
-- Clean resets intentionally create schema only; beta accounts are provisioned
-- separately through an authorized, time-bounded operational runbook.

do $$
begin
  perform 1;
end
$$;
