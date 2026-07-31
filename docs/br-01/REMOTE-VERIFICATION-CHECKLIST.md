# BR-01 Remote Verification Checklist

- [x] Both temporary beta functions require JWT.
- [x] Both temporary beta functions return HTTP 410 and contain no privileged logic.
- [x] Remote migration ledger contains the seven historical bootstrap entries.
- [x] Repository contains the same seven filenames.
- [x] BR-01 forward migration is applied remotely and committed.
- [x] `pg_net` is absent.
- [x] No product-schema seed/beta/transport/reset helper remains.
- [x] Six RPC-only tables have explicit restrictive direct-client deny policies.
- [x] Six RPC-only tables have zero direct `anon`/`authenticated` grants.
- [x] Existing beta users and media are preserved.
- [ ] Supabase leaked-password protection must be enabled in Auth settings when the account plan/control surface permits it.
