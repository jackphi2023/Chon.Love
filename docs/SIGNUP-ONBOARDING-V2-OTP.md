# Chon.Love Signup / Onboarding V2 — SU-02 Email OTP

## Scope

SU-02 changes only the authentication entry to Signup V2. It does not migrate profile data, alter existing users, or change selfie verification.

New email signup flow:

1. Step 1 selects self gender and dating interest.
2. Step 2 accepts an email address without creating a password.
3. Supabase Auth sends a one-time code with `signInWithOtp` and `shouldCreateUser: true`.
4. Step 2.2 accepts a six-digit code and verifies it with `verifyOtp({ type: 'email' })`.
5. A successful OTP creates the authenticated session and routes through the existing `get_my_onboarding_status` gate.

Google OAuth remains a direct authentication path and skips the OTP screen. Existing email/password accounts continue to use the existing password login path; password reset and legacy callback support remain in place.

## Preference handoff

Step 1 selections must survive the external authentication boundary. SU-02 stores only the temporary signup draft (gender, dating interest, signup email, stage and timestamp) in session-scoped client storage with an in-memory fallback. The draft expires after 24 hours and is not treated as authoritative profile data.

Existing server profile data always wins over this draft. The current profile bridge may use the draft only when a new profile still has the default/unset gender. The dating-interest value stays pending until the dedicated profile-contract work in the later SU sessions can persist it without bypassing the adult/onboarding gate.

## Email template requirement

Supabase email OTP and Magic Link use the same Auth method. Whether the email contains a link or a six-digit code is controlled by the **Magic Link email template**.

The repository configures local Supabase with:

- `supabase/config.toml` → `[auth.email.template.magic_link]`
- `supabase/templates/magic-link-otp.html` → uses `{{ .Token }}` and does not use `{{ .ConfirmationURL }}`

For the hosted production project `asnydvqsduonyidjyyzq`, this repository change alone does **not** modify the hosted Auth email template. Before production release, Authentication → Email Templates → Magic Link must be changed to an OTP template that includes `{{ .Token }}`. The available connected database tools do not expose hosted Auth-template mutation, so this remains an explicit production configuration gate rather than a database migration.

Until that hosted template is changed, the client keeps the existing callback compatible with previously issued PKCE/Magic Link emails so the rollout fails safely rather than breaking old inbox links.

## Non-goals / safety

- No schema migration.
- No direct update to `auth.users`.
- No reset/recreation of existing users.
- No change to password login for existing accounts.
- No change to Google provider behavior beyond preserving the temporary signup draft through redirect.
- No change to user media, membership, economy balances, location data, verification cases, AWS Rekognition, or the 60% selfie threshold.
- No merge to `main` until the complete Signup / Onboarding V2 release gate is satisfied.
