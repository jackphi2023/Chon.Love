# Chon.Love Signup / Onboarding V2 — SU-00 Baseline

Status: implementation branch baseline for SU-00 through SU-03.

## Source of truth

- Base branch: `main`
- Original SU-00 base commit: `ebab066f4c19efd6f2b9a0a659258d59a97ed3c8`
- Integration branch: `feature/signup-onboarding-v2`
- Production database project: `asnydvqsduonyidjyyzq`
- SU-00/SU-01 contain no database mutation.
- SU-03 contains an additive migration in the repository, but this implementation session does not apply it directly to the hosted production project.

## Existing flow at baseline

1. Public Homepage had its own `PublicHeader` / `PublicFooter` implementation inside `apps/mobile/app/index.tsx`.
2. Auth had a separate navy header/footer and two join steps: preferences then email/password account creation, with Google OAuth behind a feature flag.
3. Minimum onboarding had DOB plus three policy/adult checkboxes.
4. Profile onboarding combined username, display name, gender, province and a single profile photo.
5. Selfie onboarding already used the live camera and the existing member photo verification service.
6. Existing verification threshold remains 60%; SU-01 through SU-03 do not change verification logic.

## Safety boundaries

- Do not merge this branch to `main` until the complete Signup / Onboarding V2 release gate is green.
- Do not reset, recreate, truncate or destructively backfill existing member tables.
- Do not change existing user IDs, existing usernames, public profile codes, media ownership, membership, balances or verification history.
- Do not change location persistence or selfie provider behavior before their dedicated SU sessions.
- Do not make stricter Signup V2 product rules into global constraints that can invalidate historical active profiles.

## SU-01 UI foundation contract

SU-01 introduced reusable presentation primitives only:

- shared public site header/footer matching the Homepage visual language;
- `SignupShell` for registration/onboarding screens;
- `ProfileSetupProgress` for the eight-step profile setup flow;
- consistent primary/secondary buttons, field labels, help/status text, text inputs and selectable tags;
- responsive behavior for phone/tablet/desktop without changing business data contracts.

## SU-02 authentication contract

- Email registration remains email + password, minimum 8 characters.
- If confirmation is required, the Confirm signup template emits a 6-digit OTP.
- OTP verifies the email after the password account is created; it is not passwordless signup.
- Google OAuth skips the email OTP screen.
- Password is never persisted in the temporary Signup V2 draft.

## SU-03 profile-data contract

- Reuse existing canonical public profile fields for gender, dating interest, height, weight, education, relationship status, children, drinking and smoking.
- Keep date of birth in `private.user_identity` and reuse the established versioned 18+ / policy authority.
- Add only a nullable `marital_status` profile attribute; no existing row backfill is required.
- Signup V2 requires display name 10–50 and accepts height 120–220, but these are enforced by the staged signup RPC/shared validation rather than tightening legacy global constraints.
- The staged personal-info RPC is restricted to `profile_status = incomplete`, preserves existing usernames, generates an internal username only when missing, and does not activate discovery, location, media or the profile.

## Visual contract

- Primary action: red with white text; hover/press keeps red and adds a subtle elevation state on web-capable surfaces.
- Secondary action: pink active surface, red hover/press, gray disabled.
- Selectable tag: gray border by default; selected state uses gold border/background.
- Form controls: 48–50 px minimum height with consistent horizontal padding.
- Field/section labels: 15 px bold.
- Body copy: 15 px dark text.
- Help/warning/success copy: 11–12 px gray/red/green.
- Step page title remains a display heading (roughly 28–32 px) so the Seeking-style information hierarchy is preserved.

## Release acceptance through SU-03

- Integration branch remains isolated from `main` until the complete Signup / Onboarding V2 gate passes.
- Shared public chrome and SignupShell remain reusable.
- Email/password + signup OTP contract is preserved.
- SU-03 migration is additive and regression-tested against legacy/profile safety boundaries.
- Production user data is not mutated as part of this implementation session.
- Database, typecheck, unit/build and browser regression workflows must be green before moving the integration PR out of Draft.
