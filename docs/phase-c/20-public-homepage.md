# Phase C Session 20 — Public mobile web homepage

**Updated:** 2026-07-31  
**Branch:** `feature/phase-c-session-20-public-homepage`  
**Supabase project:** `asnydvqsduonyidjyyzq`

## Scope

Session 20 rebuilds the supplied `dist/trang-chu.html` prototype as production React/Next.js code at `/`.

The bundled HTML is not shipped, embedded in an iframe or wrapped in a WebView. The production page reuses the visual direction only:

- warm white background;
- coral, pink and purple gradients;
- rounded mobile cards;
- compact MyFan brand mark;
- mobile-first spacing and typography;
- a responsive phone-style product illustration.

## Public homepage sections

- Responsive header with desktop navigation and a no-JavaScript mobile menu.
- Hero with official Social Creator 18+ positioning.
- Product principles strip: 18+, 70% Creator reward rule and moderated content.
- MyFan explanation and core product capabilities.
- Separate Creator and Fan benefit sections.
- Public-safe approved Creator cards.
- Public-safe approved Activity highlights when real data exists.
- Privacy and safety explanation.
- Final join/login CTA.

The unsupported prototype claims `50K+ members` and `4.9★` are not rendered.

## Footer and policy pages

The Footer contains exactly two policy links:

1. `/terms` — Điều khoản.
2. `/community-standards` — Tiêu chuẩn cộng đồng.

Privacy, account-deletion and child-safety links were removed from the Footer as requested. Existing product routes are not deleted; they are simply not included in the Footer.

Both policy pages use a white background and plain document text. They do not use marketing cards, dashboards or prototype bundles.

## Public-safe data contract

Migration:

```text
20260731080246_phase_c_20_public_homepage_queries.sql
```

RPCs:

```text
list_public_featured_creators(limit)
list_public_activity_highlights(limit)
```

A row is eligible only when the relevant checks pass:

- profile is active and not deleted;
- account is an active adult;
- Creator is approved, not suspended and has an approval timestamp;
- Creator Activity visibility is `public`;
- Activity post is approved, published and not deleted;
- attached image is approved and not deleted;
- avatar path is returned only for an approved avatar media record.

No email, date of birth, exact coordinates, KYC, bank, moderation notes or private relationship data is returned.

## Storage protection

A dedicated Storage policy permits anonymous read of an avatar only when the object matches the approved avatar of an active adult approved Creator.

Activity image delivery continues to use the existing Activity privacy predicate and short-lived signed URLs. The homepage never receives media paths for friend-only or Fan-only Activity.

## Shared client

`packages/supabase/src/homepage.ts` contains:

- Zod response schemas;
- public homepage query keys;
- public Creator query;
- public Activity query;
- runtime normalization;
- safe text truncation.

The public web renders explicit loading, error and empty states. It does not substitute fake Creator fixtures when the database is empty.

## SEO and static export

Implemented:

- page title and description;
- canonical metadata;
- Open Graph metadata;
- Twitter card metadata;
- JSON-LD WebSite data;
- SVG favicon;
- web manifest;
- robots metadata route;
- sitemap metadata route;
- Vietnamese default language.

`NEXT_PUBLIC_SITE_URL` is configurable. Sitemap URLs and robots host metadata are emitted only when a valid HTTPS site origin is configured. Localhost is allowed for development.

The manifest, robots and sitemap routes are explicitly `force-static` for the repository's Next.js `output: export` configuration.

## Security and Advisor review

Database verification confirms:

- migration ledger entry exists;
- both RPCs are limited to `anon`, `authenticated` and `service_role`;
- public-safe predicates include public Activity visibility, active-adult state and approved media;
- direct INSERT/UPDATE/DELETE grants for app roles on source content tables remain zero;
- the approved Creator avatar Storage policy exists;
- development data currently contains zero profiles, approved Creators and approved Activity posts.

Security Advisor reports the expected warning for anonymous `SECURITY DEFINER` public-read RPCs. They are intentional narrow gateways with fixed empty `search_path`, bounded limits and server-side eligibility checks.

Performance Advisor reports unused-index information because the development database has no traffic or fixtures. The new public-highlight index should not be removed based on an empty database.

## Automated tests and CI

New unit tests verify:

- only public-safe Creator fields are accepted;
- unsupported Activity content shapes fail runtime validation;
- public copy whitespace and truncation are deterministic.

GitHub Actions CI run #502 passed:

- frozen lockfile install;
- workspace validation;
- environment validation;
- ESLint;
- TypeScript;
- 58 unit tests;
- Admin build;
- Public Web static export;
- Expo Web export.

## Deploy state

- Supabase development migration: applied.
- Public web code: implemented.
- Draft PR: open.
- Netlify preview: not deployed.
- Production domain: not configured in repository.
- APK/AAB: outside Session 20.

## Remaining QA

- Create real approved Creator and Activity fixtures.
- Verify anonymous signed avatar and Activity media URLs in a browser.
- Review layouts at 360, 390, 430, 768, 1024 and 1440 px.
- Run Lighthouse and Core Web Vitals against a deployed preview.
- Configure `NEXT_PUBLIC_SITE_URL` with the final Netlify/custom domain.
- Confirm join/login CTA destination once the authenticated mobile-web URL is deployed.
