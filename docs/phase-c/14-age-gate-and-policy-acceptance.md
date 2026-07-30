# Phase C — Session 14: DOB, 18+ age gate and policy acceptance

## Scope

- Require a private date of birth and explicit 18+ confirmation.
- Require acceptance of the current Terms of Service and Community Standards.
- Keep policy versions in server-side app configuration.
- Block direct access to protected tabs until age and policy checks pass.
- Provide matching policy screens on Expo native/web and the public Next.js site.

## Server contract

`complete_my_onboarding(date, termsVersion, communityRulesVersion, method)` is the only client-facing write path.

The server now:

1. Rejects users younger than 18.
2. Rejects stale or invented policy versions.
3. Preserves account enforcement state.
4. Rejects suspended, deactivated, deletion-requested and deleted accounts.
5. Records DOB privately and never returns it through public profile queries.

`get_my_onboarding_status()` considers policy acceptance valid only when the stored versions match the current server configuration.

## Current policy versions

- Terms: `terms-2026-07-30-v1`
- Community Standards: `community-2026-07-30-v1`

Changing either server config value forces existing users back through policy acceptance without exposing DOB.

## Route protection

- Unauthenticated → `/(auth)`
- Authenticated but incomplete/stale policy → `/(onboarding)`
- Authenticated and complete → `/(tabs)`
- Non-active account → blocked onboarding state with sign-out only

The tabs layout performs its own guard so direct route entry cannot bypass onboarding.

## Validation

Shared validation in `@myfan/validation` covers:

- ISO date format.
- Exact 18th-birthday boundary.
- Explicit adult confirmation.
- Terms acceptance.
- Community Standards acceptance.

## Out of scope

- Document-based age verification.
- Native encrypted session persistence.
- Profile fields and avatar upload (Session 15).
- Child-safety operational contact and Play submission package.
