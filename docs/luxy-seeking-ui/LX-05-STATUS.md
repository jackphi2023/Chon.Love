# LX-05 — Public Homepage Luxy.Love

Status: **COMPLETED**

Branch: `agent/luxy-seeking-ui-foundation`

Repository: `jackphi2023/Luxy.Love`

## Scope completed

LX-05 replaces the old public entry screen with a Vietnamese Luxy.Love homepage reconstructed from the supplied Seeking homepage reference while keeping Luxy branding, copy, artwork, safety language and existing authentication routing.

The implementation deliberately keeps the Seeking information hierarchy and page rhythm rather than inventing a generic dating landing page:

1. Public header over a full-bleed hero.
2. Hero positioning statement and primary signup CTA.
3. Luxy mindset / product philosophy section.
4. 18+ and responsible-dating safety notice.
5. Member testimonial image section.
6. Two-column benefit section.
7. Mid-page conversion CTA.
8. Dark navy mission section.
9. Interactive Luxy values section.
10. Full-bleed final CTA.
11. Vietnamese footer with legal and safety links.

All visible homepage copy is Vietnamese. User-facing branding is Luxy.Love.

## Fidelity decisions

The Seeking reference remains the UI source of truth for hierarchy, composition, spacing rhythm, CTA cadence and responsive behavior.

Luxy-specific divergence is limited to:

- Luxy.Love brand and Vietnamese copy.
- Luxy-owned/generated artwork rather than Seeking-owned imagery or trademarks.
- Luxy safety wording, including 18+ positioning and an explicit statement that gifts do not buy dates, messages, replies or private access.
- Existing Luxy authentication routes and session restoration.
- Existing legal routes.

No Seeking logo, proprietary font file, production JS bundle or copyrighted site asset is shipped.

## Responsive behavior

The homepage has dedicated behavior for desktop, tablet and mobile web:

- Desktop keeps the full Luxy.Love brand, primary navigation and join/login actions over the hero.
- Mobile uses a compact header and menu rather than squeezing desktop navigation into the viewport.
- 390 px and 430 px layouts have dedicated assertions for overflow and CTA visibility.
- Long content sections collapse from two columns to one column on phone widths.
- Interactive value and testimonial controls remain keyboard/touch accessible.

## Files changed in LX-05

- `apps/mobile/app/index.tsx` — full public homepage implementation.
- `apps/mobile/src/components/luxy-public-artwork.ts` — Luxy-owned/generated homepage artwork mapping.
- `apps/mobile/app/+html.tsx` — Vietnamese HTML language and Luxy metadata.
- `apps/mobile/app/_layout.tsx` — StyleSheet compatibility initialization used by the homepage build.
- `apps/mobile/src/lib/style-sheet-compat.ts` — narrow React Native / React Native Web StyleSheet alias compatibility bridge.
- `tests/br-06/luxy-public-homepage.spec.mjs` — desktop/mobile homepage regression coverage.
- `tests/br-06/luxy-desktop-shell.spec.mjs` — authenticated shell login helper aligned with the new public entry page and scoped brand locator.
- `tests/br-06/luxy-responsive-shell.spec.mjs` — responsive shell helper/locator alignment.
- `tests/br-06/mobile-web-multi-account.spec.mjs` — social lifecycle login helper aligned with Luxy public entry.
- `tests/br-09/observability-accessibility-resilience.spec.mjs` — BR-09 entry flow aligned with Luxy homepage.
- `scripts/validate-br09.mjs` — metadata guard now validates Vietnamese language + non-empty title without hard-coding the retired MyFan brand.

## Validation completed

Application CI on head `60bd052a2f7cf68de316b8f028e4e67ea4aff168` completed successfully:

- Workspace validation.
- Environment validation.
- BR-01 through BR-10 source guards.
- ESLint.
- TypeScript.
- Unit tests.
- Admin/Public/Expo Web builds.

GitHub Actions run: `31482435745`.

Browser E2E on the same head completed successfully:

- Local Supabase start.
- Clean reset from repository migrations.
- Isolated browser fixtures.
- BR-06 mobile-web/browser suite.
- LX-05 homepage desktop 1280 px.
- LX-05 homepage mobile 390 px.
- LX-05 homepage mobile 430 px.
- Existing LX-03 authenticated desktop shell regression.
- Existing LX-04 responsive shell regression.
- Existing multi-account social lifecycle regression.
- BR-09 accessibility and resilience suite.
- Evidence artifact uploads.

GitHub Actions run: `31482435804`.

## Database / business logic boundary

LX-05 does **not** modify:

- Supabase migrations or schema.
- RLS policies.
- Search backend.
- Profile schema.
- Favorites persistence.
- Premium / Diamond entitlements.
- Messaging entitlements.
- Gift ledger or payout timing.
- KYC / verification workflow.

There are no `supabase/` changes in the LX-05 diff.

## Deferred to later LX sessions

- LX-06: Seeking-style Signup/Login UX and onboarding presentation.
- LX-07/LX-08: profile schema + Edit Profile.
- LX-09/LX-10/LX-11: search contract and desktop/mobile Search clone.
- LX-12+: favorites, member profile, private photos, messaging and monetization.

## Completion decision

LX-05 is closed as complete. The public Luxy.Love homepage is now the default unauthenticated entry point, preserves authenticated redirects, passes the existing application and browser regression gates, and stays within the UI-only boundary of this phase.