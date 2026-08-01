# BR-03 Auth and Session Design

## Authentication methods

- Email/password uses `signInWithPassword` and routes through the same mandatory 18+ onboarding resolver as Google Auth.
- Google Auth keeps the existing PKCE callback flow.
- Password recovery uses `resetPasswordForEmail`, an allowlisted callback destination, `exchangeCodeForSession`, and `updateUser`.

## Callback security

Only the internal `/auth/reset-password` destination is accepted from the callback query. Arbitrary external or application routes are ignored. Provider error details are translated to stable user-facing messages instead of being rendered raw.

## Session restoration

The client first loads the persisted session, then validates the authenticated user with `auth.getUser()` before trusting the restored identity. Auth state changes continue to synchronize the application context.

## Session revocation

- Application sign-out defaults to `global`, revoking refresh sessions on all devices.
- `local` and `others` scopes remain represented in the typed Auth contract for future device-management UI.
- A successful password reset explicitly performs global sign-out and requires a fresh login.
- Revoked access JWTs can remain valid until their short expiry; sensitive server operations must continue enforcing their existing authorization boundaries.

## Enumeration and recovery behavior

The recovery request screen uses a neutral success message for normal accounts. Controlled Beta fixture accounts are excluded from self-service recovery so their operator-issued credential remains unchanged during the closed Beta.
