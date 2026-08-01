# BR-01 — Security Cleanup and Source-of-Truth Reconciliation

Date: 2026-07-31

## Scope

BR-01 removes the temporary beta-bootstrap attack surface, reconciles the remote Supabase migration ledger with the repository, and makes RPC-only table access explicit.

No production user, profile, media, location, economy, gift, KYC, bank or withdrawal row is deleted or rewritten by this work.

## Temporary Edge Functions

The following deployed functions are retained only as non-operational tombstones because the available deployment API cannot delete function records:

- `seed-myfan-beta-users`
- `reset-myfan-beta-passwords`

Both functions:

- require a valid JWT at the platform gateway;
- contain no service-role lookup;
- contain no Auth Admin calls;
- contain no token or password;
- return HTTP `410 Gone` with `Cache-Control: no-store`;
- cannot create users, update passwords, inspect users or mutate data.

The source-of-truth tombstones are committed under `supabase/functions/`.

## Migration reconciliation

The remote migration ledger contained seven one-time beta-bootstrap entries that were absent from GitHub. Their final remote cleanup left no product-schema objects and removed the temporary `pg_net` extension.

The repository now contains exact filenames for those historical ledger entries. The first six entries are intentionally inert reconciliation records because recreating their privileged temporary transport objects during a clean reset would reintroduce an attack surface. The final cleanup migration is idempotent and guarantees the final state:

- no `pg_net` extension;
- no public/private helper functions containing `seed`, `beta`, `transport` or `reset` in their names.

Beta fixture users are operational test data and are not recreated by schema migrations.

## Explicit RPC-only access

Migration `20260731114823_br_01_explicit_rpc_only_deny_policies.sql`:

- revokes direct `anon` and `authenticated` grants;
- adds restrictive deny-all policies for direct client access;
- documents the RPC-only boundary on six tables;
- removes `pg_net` if present.

Protected tables:

- `public.creator_posts`
- `public.creator_post_media`
- `private.creator_post_unlocks`
- `private.creator_post_unlock_events`
- `private.message_user_hides`
- `private.vietqr_payment_orders`

Existing bounded RPC behavior is unchanged.

## Automated controls

`scripts/validate-br01.mjs` fails CI when:

- any reconciled migration file is missing;
- either tombstone stops returning HTTP 410;
- privileged bootstrap patterns such as Auth Admin, service-role access, hard-coded password/token variables or password login verification reappear;
- the historical cleanup stops removing `pg_net`;
- a required explicit deny policy disappears from the migration source.

`supabase/tests/br_01_security_reconciliation.sql` verifies:

- all six explicit policies exist;
- no direct app-role grants exist on those tables;
- `pg_net` is absent;
- no temporary seed/reset helper remains in product schemas;
- the BR-01 migration is recorded in the ledger.

## Release boundaries

- Branch: `agent/br-01-security-reconciliation`
- Base: `feature/phase-c-session-21-vietqr-heart-payments`
- `main` unchanged.
- `develop` unchanged.
- No Netlify production deployment.
- Gift, KYC and withdrawal execution remain feature-gated.
