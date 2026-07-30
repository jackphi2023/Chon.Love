# Phase B / Session 11 — RLS and permission baseline

## Scope

Session 11 closes Phase B by making the access model explicit and testable across identity, social, media, economy and payout data.

## Client-access model

- `public` tables are exposed only when a user-facing read or Realtime contract is required.
- Every `public` table has RLS enabled.
- `private` has no schema usage for `anon` or `authenticated`.
- Every RLS-enabled table has an explicit policy.
- Private tables use a restrictive `deny_client_access` policy as defense in depth.
- `public.moderation_cases` is server/admin only and has an explicit deny-client policy.
- Service-only KYC, bank, withdrawal, hold and deletion RPCs are executable only by `service_role`.

## SECURITY DEFINER contract

Client RPCs that must mediate private state remain `SECURITY DEFINER`, but the contract is frozen and tested:

- every function pins an empty `search_path`;
- anonymous access is limited to `get_public_app_config()`;
- authenticated access is limited to the reviewed user-facing RPC allowlist;
- service-only payout/admin RPCs are not executable by `anon` or `authenticated`;
- RLS policies do not use deprecated `auth.role()` or user-editable metadata.

The Supabase Security Advisor reports generic warnings for intentionally exposed `SECURITY DEFINER` RPCs. These warnings are accepted only because the functions enforce `auth.uid()` or trusted role checks internally and are covered by pgTAP tests.

## Storage and Realtime

- `kyc-private` and `media-private` remain private buckets.
- KYC has no direct client SELECT policy.
- Storage overwrite remains disabled.
- No private table is added to Realtime.
- Mobile Web, Android and iOS subscribe only to redacted public tables, including `payout_sync`.

## Performance hardening

Added covering indexes for reviewer/actor foreign keys:

- `private.account_holds(created_by)`
- `private.account_holds(released_by)`
- `private.bank_accounts(verified_by)`
- `private.kyc_profiles(reviewed_by)`
- `private.withdrawals(reviewed_by)`

Unused-index notices are not acted on while the remote database is empty; the indexes support planned discovery, messaging, moderation and finance query paths.

## Validation gate

`supabase/tests/11_rls_permission_hardening_test.sql` verifies:

- RLS and explicit-policy coverage;
- private-schema isolation;
- moderation queue denial;
- function grants and pinned search paths;
- policy safety rules;
- Storage and Realtime boundaries;
- immutable audit protection;
- required foreign-key indexes.

Phase B remains on a Draft PR and is not merged into `develop` or `main` without explicit approval.
