# Chon.Love Signup / Onboarding V2 — SU-00 Baseline

Status: integration baseline through SU-04.

## Source of truth

- Base branch: `main`
- Original SU-00 base commit: `ebab066f4c19efd6f2b9a0a659258d59a97ed3c8`
- Integration branch: `feature/signup-onboarding-v2`
- Production database project: `asnydvqsduonyidjyyzq`
- Hosted production data/schema is not directly mutated by these implementation sessions.

## Safety boundaries

- Do not merge this branch to `main` until the complete Signup / Onboarding V2 release gate is green.
- Do not reset, recreate, truncate or destructively backfill existing member tables.
- Do not change existing user IDs, usernames, public profile codes, media ownership, membership, balances or verification history.
- Do not change location persistence or selfie-provider behavior before their dedicated SU sessions.
- Do not turn stricter new-signup rules into global constraints that can invalidate historical active profiles.

## SU-01 UI foundation

- Shared public Header/Footer extracted from Homepage.
- `SignupShell` + eight-step `ProfileSetupProgress`.
- Shared red/pink buttons, form labels/help text, inputs, tags and responsive dropdown primitive.
- Responsive desktop + mobile-web presentation.

## SU-02 authentication

- Email registration remains email + password, minimum 8 characters.
- Signup email confirmation uses a 6-digit OTP when confirmation is required.
- Google OAuth skips the email OTP screen.
- Password login remains available for existing and new email/password accounts.
- Step 1 gender/interest is preserved through auth redirects in an expiring session-scoped draft; the password is never stored there.

## SU-03/SU-04 personal-info contract

- Required Step 3 fields: date of birth and display name; Step 1 gender/interest remains required context.
- Optional: height, weight, education, relationship status, children, drinking, smoking.
- Every optional dropdown uses `Chọn` → `Không chia sẻ` → actual values.
- Physical not-shared state persists as `null`; enum not-shared state persists as canonical `prefer_not_to_say`.
- Public presentation continues to treat these mature values as **Chưa chia sẻ**, and the values remain editable in Profile Edit.
- `relationship_status` is the only relationship/marital-state field. **No `marital_status` type/column is introduced.**
- DOB remains in `private.user_identity` and reuses the established versioned 18+ / policy authority.
- The three old visible adult/Terms/Community checkboxes are removed from Step 3; acceptance remains recorded atomically when Personal Info is saved.
- Signup V2 display name is 10–50 and signup height is 120–220, enforced only by staged signup validation/RPC rather than by tightening mature global constraints.
- The staged Personal Info RPC is restricted to `profile_status = incomplete`, preserves existing usernames, generates an internal username only when missing, and does not activate discovery, location, media or the profile.
- Existing incomplete users who already completed the mature age/policy onboarding contract continue through the existing bridge instead of being forced through the stricter new-registration screen.

## Visual contract

- Primary action: red with white text; hover/press stays red with subtle elevation.
- Secondary action: pink active, red hover/press, gray disabled.
- Selected tag: yellow/gold border/background.
- Inputs/dropdowns: consistent 48–50 px minimum height, 15 px content.
- Field labels: 15 px bold.
- Help/warning/success copy: approximately 11–12 px gray/red/green.
- Step title remains a 28–32 px display heading.

## Release acceptance through SU-04

- Integration branch remains isolated from `main`.
- Shared public chrome / SignupShell remain the single registration presentation foundation.
- Email/password + signup OTP contract remains intact.
- Personal Info DB contract, validation, optional-dropdown mapping and UI are regression-tested.
- Production user data remains unchanged by this implementation session.
- Database, typecheck, unit/build and browser regression workflows must be green before the integration PR leaves Draft.
