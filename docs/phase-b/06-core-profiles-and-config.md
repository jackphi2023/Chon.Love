# Session 6 — Core profiles, identity, Creator roles and configuration

- **Supabase:** `asnydvqsduonyidjyyzq`
- **Branch:** `feature/phase-b-database-security`
- **Status:** Implemented and smoke-tested

## Initial state

The selected project had zero application migrations, business tables, buckets, policies and Auth users. No application data required backup. Session 6 enabled `citext`, `postgis`, `pg_trgm` and `pgtap`; `pgcrypto` was already installed.

## Remote migrations

| Version | Name |
|---|---|
| `20260729160331` | `phase_b_06_core_profiles` |
| `20260729160609` | `phase_b_06_fix_onboarding_rpc` |
| `20260729160726` | `phase_b_06_add_fk_indexes` |

The old local-only migration version `20260729150009` was removed because it was never applied to the canonical project and conflicted with the remote schema during clean reset.

## Schema

Public: `administrative_areas`, `profiles`, `creator_profiles`. Private: `user_identity`, `user_roles`, `app_config`. Public profiles contain no email, DOB, KYC, bank or exact location. The private schema has client grants revoked and RLS enabled with no client policies.

Auth bootstrap creates a minimal profile, identity row and default `user` role without trusting user metadata. Adult onboarding validates DOB and policy versions. Profile updates use a protected RPC. Creator payout eligibility, roles and configuration are server-controlled.

## Cross-platform synchronization

Expo Web, Android and iOS use one Expo codebase, one `@myfan/supabase` client, one generated public `Database` type and the same RPCs. Admin and Public Web use the same public contract. Private tables are absent from client types.

## Tests

- Remote pgTAP: 18 planned, final result `ok 18`, transaction rolled back.
- Fail-fast remote smoke: PASS for 9 groups; persistent test users = 0.
- Coverage: email/OAuth bootstrap, case-insensitive username, future DOB, under-18 rejection, adult onboarding, private ACL, role escalation, config mutation and Auth deletion cascade.
- GitHub Database workflow performs local start, clean reset, seed, pgTAP, schema lint, generated-contract checks and application lint/typecheck/tests.

## Advisors

Missing FK indexes identified by Performance Advisor were added. Remaining unused-index notices are expected on empty new tables. Security Advisor notices are intentional protected RPCs and policy-free server-only private tables; all `SECURITY DEFINER` functions have empty search paths and explicit grants.

## Limitations

Administrative areas await an approved source. Avatar FK is deferred to Session 8. Session 10 replaces pre-finance Auth cascade deletion with retention-aware account deletion. Build labels share one backend by explicit owner decision.
