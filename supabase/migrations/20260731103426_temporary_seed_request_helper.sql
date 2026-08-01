-- Historical migration reconciliation for the temporary seed request helper.
--
-- The original helper supported a single privileged bootstrap request and was
-- removed immediately afterward. This no-op preserves migration-ledger parity
-- while preventing a clean rebuild from recreating callable seed machinery.

do $$
begin
  perform 1;
end
$$;
