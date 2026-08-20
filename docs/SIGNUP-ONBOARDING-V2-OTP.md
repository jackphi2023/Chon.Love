# Chon.Love Signup / Onboarding V2 — SU-02 Email Password + OTP

## Scope

SU-02 changes only the authentication entry to Signup V2. It does not migrate profile data, alter existing users, or change selfie verification.

New email signup flow:

1. Step 1 selects self gender and dating interest.
2. Step 2 accepts an email address and a password with a minimum length of 8 characters.
3. Supabase Auth creates the account with `signUp({ email, password })`.
4. When email confirmation is required, the signup confirmation email contains a six-digit `{{ .Token }}` OTP.
5. Step 2.2 accepts the six-digit code and verifies it with `verifyOtp({ type: 'email' })`.
6. A successful OTP creates the authenticated session and routes through the existing `get_my_onboarding_status` gate.

Google OAuth remains a direct authentication path and skips the OTP screen. Existing email/password accounts continue to use the existing password login path; password reset and legacy callback support remain in place.

## Password contract

Email registration is not passwordless. The password requirement remains aligned with the existing Chon.Love Auth contract:

- minimum password length: 8 characters;
- password is sent only to Supabase Auth through `signUp` and is never stored in the Signup V2 client draft;
- login continues to use `signInWithPassword`;
- password reset and controlled Beta credential behavior remain unchanged.

## Preference handoff

Step 1 selections must survive the external authentication boundary. SU-02 stores only the temporary signup draft (gender, dating interest, signup email, stage and timestamp) in session-scoped client storage with an in-memory fallback. The draft expires after 24 hours and is not treated as authoritative profile data. The password is deliberately excluded from this draft.

Existing server profile data always wins over this draft. The current profile bridge may use the draft only when a new profile still has the default/unset gender. The dating-interest value stays pending until the dedicated profile-contract work in the later SU sessions can persist it without bypassing the adult/onboarding gate.

## Email confirmation template requirement

Password signup uses the **Confirm signup** email template, not the Magic Link template. Supabase exposes `{{ .Token }}` in the signup confirmation email, so Chon.Love can keep email/password account creation and still present a six-digit OTP screen.

The repository configures local Supabase with:

- `supabase/config.toml` → `minimum_password_length = 8`;
- `supabase/config.toml` → `[auth.email] enable_confirmations = true`;
- `supabase/config.toml` → `[auth.email.template.confirmation]`;
- `supabase/templates/signup-confirmation-otp.html` → uses `{{ .Token }}` and does not use `{{ .ConfirmationURL }}`.

For the hosted production project `asnydvqsduonyidjyyzq`, this repository change alone does **not** modify hosted Auth settings. Before production release:

1. Authentication → Providers → Email must require email confirmation for new email/password signups.
2. Authentication → Email Templates → Confirm signup must contain `{{ .Token }}` so users receive the six-digit code.

The connected database tools do not expose hosted Auth-template/provider configuration mutation in this workflow, so these remain explicit production configuration gates rather than database migrations.

The callback stays compatible with previously issued confirmation/recovery links so existing inbox links are not deliberately broken by this rollout.

## Resend behavior

The OTP resend action uses `auth.resend({ type: 'signup', email })`. It does not call `signInWithOtp`, so resending a code does not convert the account into a passwordless signup path.

## Non-goals / safety

- No schema migration.
- No direct update to `auth.users`.
- No reset/recreation of existing users.
- No removal of password login for existing or new email accounts.
- No password stored in session/local Signup V2 draft state.
- No change to Google provider behavior beyond preserving the temporary signup draft through redirect.
- No change to user media, membership, economy balances, location data, verification cases, AWS Rekognition, or the 60% selfie threshold.
- No merge to `main` until the complete Signup / Onboarding V2 release gate is satisfied.
