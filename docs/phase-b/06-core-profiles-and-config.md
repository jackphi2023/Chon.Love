# Session 6 — Core profiles, identity, Creator, roles and application configuration

- **Phase:** B — Database and Security
- **Branch:** `feature/phase-b-database-security`
- **Target environment:** MyFan Development (`qxsqrtnelbqquqgbamjo`)
- **Production safety:** no migration is applied to `asnydvqsduonyidjyyzq`
- **Client contract:** one Supabase schema and generated TypeScript contract for Expo Web, Android and iOS

## 1. Initial inventory

Before Session 6, the development project contained no application migration, no application table or function, no Storage bucket, no application RLS policy and no Auth user. PostgreSQL is version 17.6.

Extension state before the migration:

| Extension | Initial state | Session 6 action |
|---|---|---|
| `pgcrypto` | installed in `extensions` | preserve |
| `citext` | available | install in `extensions` |
| `postgis` | available | install in `extensions` |
| `pgtap` | available | install in `extensions` for database tests |

The Phase A repository did not contain `supabase/config.toml`, `docs/phase-a/04-environments.md` or `docs/phase-a/PHASE-A-COMPLETION-REPORT.md`. Session 6 adds the local Supabase configuration and restores the two documentation entry points without changing the approved Phase A rules.

## 2. Environment correction

The Phase B task attachment refers to `asnydvqsduonyidjyyzq` as development. The approved Phase A environment matrix is authoritative:

| Environment | Project ref |
|---|---|
| Development | `qxsqrtnelbqquqgbamjo` |
| Staging | `fciyrjtqnifapafqythy` |
| Production | `asnydvqsduonyidjyyzq` |

Session 6 therefore targets `qxsqrtnelbqquqgbamjo`. This prevents an accidental production migration.

## 3. Migration contents

The migration creates:

### Public Data API objects

- `public.administrative_areas`
- `public.profiles`
- `public.creator_profiles`
- `public.get_public_app_config()`
- `public.get_my_account_bootstrap()`
- `public.complete_adult_onboarding(...)`
- `public.accept_creator_terms(...)`
- `public.apply_for_creator(...)`

All exposed tables have RLS enabled. Client grants are deliberately narrow.

### Private server-only objects

- `private.user_identity`
- `private.user_roles`
- `private.app_config`
- trigger/helper functions

`anon` and `authenticated` have no `USAGE` on `private` and no direct table, sequence or function privileges there.

## 4. Identity and 18+ rules

- Full date of birth is stored only in `private.user_identity`.
- Age is derived from date of birth; no static age column exists.
- Future dates are rejected.
- `age_verified_at` can be set only when the date of birth proves the user was at least 18 on that timestamp.
- Terms and Community Standards versions and acceptance timestamps are stored together.
- `complete_adult_onboarding` is the only client-facing operation that activates the account during Session 6.
- The operation uses `auth.uid()` and never accepts a target user ID.

## 5. Auth bootstrap

The `auth.users` trigger creates only safe minimal records:

- onboarding `public.profiles` row;
- pending-age-verification `private.user_identity` row;
- `not_applied` Creator row;
- base `user` role.

Neither email signup nor OAuth signup copies `raw_user_meta_data` into authorization fields. Role values in user-editable metadata are ignored.

## 6. Roles and Creator controls

The authoritative role source is `private.user_roles`:

- `user`
- `creator`
- `moderator`
- `finance_admin`
- `super_admin`

Clients cannot insert, update or delete roles. A future protected server operation may synchronize selected active roles to `app_metadata`; clients must refresh their JWT before relying on changed claims.

A Creator application can move only to `pending`. It cannot self-approve, set `payout_eligible` or grant the `creator` role.

## 7. Application configuration

The migration seeds all required Session 6 keys. Integer monetary and heart values are stored inside validated JSON integer scalars; no float column is introduced.

High-risk daily limits remain `null` until Risk approves launch values. Public clients read only rows marked `is_public` through `get_public_app_config()`.

## 8. Cross-platform synchronization

Expo Web, Android and iOS use the same package:

```text
packages/supabase
```

The package contains:

- the generated database type contract;
- a single public-client factory;
- optional storage injection for native secure/session persistence;
- typed wrappers for adult onboarding, account bootstrap, public config and Creator application.

No platform is allowed to implement a separate age, role or Creator approval rule. PostgreSQL constraints and RPCs are authoritative, so changes are visible consistently across all signed-in devices through the same Supabase project.

Native applications will provide an Expo-compatible storage adapter in Phase C. Web builds use browser storage and URL session detection.

## 9. Administrative-area data

The schema is updateable and does not encode provinces as an enum. No unverified official Vietnamese administrative code is inserted by the migration.

`supabase/seed.sql` contains only clearly marked `TEST-*` areas for local reset and automated testing. Production administrative data remains blocked until the project approves a source and version.

## 10. Tests

The pgTAP suite covers:

- safe email and OAuth bootstrap;
- case-insensitive username uniqueness;
- future DOB rejection;
- under-18 verification rejection;
- private-schema access denial;
- role/config mutation denial;
- adult onboarding RPC;
- shared account-bootstrap contract;
- Creator terms and pending application;
- 10,000-bps split invariant;
- no float columns;
- RLS coverage;
- PostGIS schema;
- Auth deletion cascade for Session 6 records.

## 11. Migration and deployment sequence

```text
Supabase CLI creates migration filename
→ local Supabase stack starts in GitHub Actions
→ db reset applies migration and fake seed
→ pgTAP tests
→ database lint
→ generated public TypeScript types
→ review
→ apply migration to MyFan Development
→ smoke tests and advisors
→ commit generated types
```

The development project contained zero Auth users and zero application rows before deployment, so no application-data backup was required. The pre-deploy inventory is retained in this document and the migration history is checked before apply.

## 12. Rollback

Session 6 is the first application migration. Rollback is not performed by deleting migration history.

Before shared test data exists, rollback means restoring the development project from a known pre-migration backup/reset point. Once later transactional tables exist, rollback must use a forward corrective migration. Production and staging are not touched by Session 6.

## 13. Known limitations

- Official Vietnamese administrative-area data is not seeded.
- Admin role-management operations are deferred to the protected Admin/backend phase.
- Media foreign-key enforcement for `avatar_media_id` is added in Session 8.
- Location tables and PostGIS queries are added in Session 7.
- KYC, finance ledgers and account-deletion retention are added in Sessions 9–10.
- Native session storage and EAS builds belong to Phase C.
