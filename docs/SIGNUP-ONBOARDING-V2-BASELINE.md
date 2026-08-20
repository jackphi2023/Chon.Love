# Chon.Love Signup / Onboarding V2 — SU-00 Baseline

Status: implementation branch baseline for SU-00 + SU-01.

## Source of truth

- Base branch: `main`
- Base commit: `ebab066f4c19efd6f2b9a0a659258d59a97ed3c8`
- Integration branch: `feature/signup-onboarding-v2`
- Production database project: `asnydvqsduonyidjyyzq`
- No database mutation is part of SU-00 or SU-01.

## Existing flow at baseline

1. Public Homepage has its own `PublicHeader` / `PublicFooter` implementation inside `apps/mobile/app/index.tsx`.
2. Auth has a separate navy header/footer and two join steps: preferences then email/password account creation, with Google OAuth behind a feature flag.
3. Minimum onboarding has DOB plus three policy/adult checkboxes.
4. Profile onboarding combines username, display name, gender, province and a single profile photo.
5. Selfie onboarding already uses the live camera and the existing member photo verification service.
6. Existing verification threshold remains 60%; SU-01 does not change verification logic.

## SU-00 safety boundaries

- Do not merge this branch to `main` until the complete Signup / Onboarding V2 release gate is green.
- Do not reset, recreate, truncate or backfill existing member tables in SU-00/SU-01.
- Do not change existing user IDs, usernames, public profile codes, media ownership, profile status, membership, balances or verification history.
- Do not change Auth providers or email confirmation behavior in SU-01; OTP conversion belongs to SU-02.
- Do not change location persistence, discovery sorting or selfie provider behavior in SU-01.

## SU-01 UI foundation contract

SU-01 introduces reusable presentation primitives only:

- shared public site header/footer matching the Homepage visual language;
- `SignupShell` for registration/onboarding screens;
- `ProfileSetupProgress` for the eight-step profile setup flow;
- consistent primary/secondary buttons, field labels, help/status text, text inputs and selectable tags;
- responsive behavior for phone/tablet/desktop without changing business data contracts.

## Visual contract

- Primary action: red with white text; hover/press keeps red and adds a subtle elevation state on web-capable surfaces.
- Secondary action: pink active surface, red hover/press, gray disabled.
- Selectable tag: gray border by default; selected state uses gold border/background.
- Form controls: 48–50 px minimum height with consistent horizontal padding.
- Field/section labels: 15 px bold.
- Body copy: 15 px dark text.
- Help/warning/success copy: 11–12 px gray/red/green.
- Step page title remains a display heading (roughly 28–32 px) so the Seeking-style information hierarchy is preserved.

## Acceptance for SU-00 + SU-01

- Branch exists from the recorded `main` commit.
- No Supabase schema/data change.
- Shared public chrome and SignupShell exist in reusable components.
- Auth uses shared public chrome without changing its current authentication contract.
- Existing onboarding screens use SignupShell/progress while preserving their current backend calls.
- Homepage remains behaviorally unchanged; its public chrome must be visually compatible with the extracted shared component.
- Typecheck/build/CI regressions must be fixed on the feature branch before moving to SU-02.
