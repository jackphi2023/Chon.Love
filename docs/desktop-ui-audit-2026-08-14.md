# Chon.Love — Desktop UI audit & consolidation

Date: 2026-08-14
Scope: desktop web (>= 1024px) only. Mobile web remains intentionally deferred.

## Goal

Create one professional visual system for Chon.Love that can later be reused by mobile web and a native mobile app. The desktop release should consistently use the supplied Chon.Love logo, red/gold as the primary brand palette, blue/black as secondary colors, predictable icon sizing, desktop-native account layouts, and visible interaction feedback.

## Audit findings

### 1. Brand shell was split between old Luxy/MyFan conventions and Chon.Love

- Authenticated Expo navigation rendered a text brand from `luxyBrand.productName` instead of the supplied Chon.Love logo asset.
- The account menu still contained visible legacy `Luxy.Love` copy.
- Public Next.js header/footer already had the Chon.Love logo asset, but desktop navigation still used the older marketing palette and pink gradient treatment.
- Authenticated pages did not have one shared desktop footer.

### 2. Navigation icons and states were visually inconsistent

- Navigation used Unicode symbols without a shared desktop icon box or brand color rule.
- Active, hover and pressed states were not defined as one coherent desktop system.
- Favorite controls had pressed feedback but no desktop hover feedback.

Desktop rule adopted:

- Navigation icons: monochrome gold, fixed 20–24px visual box.
- Primary action: red.
- Informational/supporting iconography: blue, red or neutral gray.
- Active navigation: red label/underline.
- Hover: warm gold/red surface; pressed state remains visibly distinct.

### 3. Desktop content shell was too mobile-like for account pages

- `Screen` used one narrow stacked card pattern regardless of desktop width.
- `Hồ sơ của tôi` was one long vertical mobile flow.
- `Số dư` was a stacked mobile card flow.
- `Quà & Thu nhập` was responsive but constrained and did not use the wider desktop visual hierarchy.

Desktop rule adopted:

- Shared max content width: 1180px for account/workspace pages.
- 32px desktop internal padding.
- Two-column layouts where the information hierarchy benefits from it.
- Cards use restrained borders/shadows instead of oversized mobile blocks.

### 4. Member/search/message routes did not share a footer

The authenticated route shell had navigation but no desktop footer. The member detail route had neither authenticated desktop navigation nor footer.

Desktop rule adopted:

- Search/member-list, Favorites/Friends and Messages receive the shared desktop footer.
- Member profile detail receives desktop product navigation and footer.
- Mobile/tablet route shell remains unchanged in this pass.

## Implemented desktop work sessions

### D-01 — Brand tokens & shell foundation

- Added red/gold/blue/black brand tokens and desktop layout tokens.
- Added reusable Chon.Love image-logo component.
- Added new desktop-only authenticated navigation.
- Added desktop-only authenticated footer.
- Kept existing mobile/tablet navigation untouched.

### D-02 — Navigation, public profile continuity & interactions

- Product navigation now uses the supplied Chon.Love logo image rather than a text logo.
- Product navigation uses gold monochrome icons in a fixed visual box.
- Desktop hover/active/pressed states added to product navigation and favorites.
- Public desktop navigation aligned to Search / Favorites / Messages / Login flow while the mobile public menu remains unchanged.
- Public desktop footer shifted to black + gold brand treatment and no longer renders a text `Chon.Love` copyright mark.

### D-03 — Desktop account workspace

- Shared `Screen` gains a desktop max-width layout without altering mobile styling.
- `Hồ sơ của tôi` becomes a desktop workspace: profile hero, two-column content, photo management main column, verification/safety side column.
- `Số dư` becomes a two-column desktop payment/balance workspace.
- `Quà & Thu nhập` uses a wider four-card summary grid and clearer desktop history hierarchy.

### D-04 — Route consistency & release validation

- Desktop footer added to search/member-list, favorites/friends and messages routes via the authenticated layout.
- Member detail route keeps desktop product navigation and footer.
- Final validation must pass repository typecheck/tests/build before merge to `main`.

## Desktop acceptance criteria

1. At >=1024px, authenticated product navigation shows the Chon.Love logo image, not a text logo.
2. Desktop product navigation icons are gold and visually normalized within the same icon box.
3. Search, Favorites/Friends, Messages and member detail have a footer.
4. Member detail keeps product navigation with Search, Favorites, Messages and Login/Account behavior.
5. My Profile, Gifts and Balance no longer present as narrow mobile-only stacked views on desktop.
6. Primary CTA styling is red; gold is used as a premium/brand accent; blue is informational; black/charcoal anchors navigation/footer.
7. Desktop hover and pressed states are visible on key navigation/action controls.
8. Mobile/tablet authenticated navigation is unchanged in this release.
9. No Supabase schema or data migration is required for this UI consolidation.
10. `main` is updated only after CI/build validation succeeds.

## Deferred mobile work

A later mobile-web/native pass should reuse the same semantic tokens while redesigning navigation placement, touch targets, footer strategy, card density and safe-area behavior specifically for phone screens. It should not simply shrink the desktop layout.
