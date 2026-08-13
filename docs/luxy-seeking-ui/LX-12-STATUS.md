# LX-12 — Favorite System — Completion Status

Status: **Complete**

Implementation branch: `agent/luxy-seeking-ui-foundation`

Previous LX-11 completion head: `ae542f8509d77352a6b9a5de54aa407e178f17e1`

Implementation/browser-tested head: `c5a58e22366bf9361117eeb21969d9c4d535cc3e`

LX-12 implements the Favorite / Interests persistence contract that the LX roadmap assigned to `profile_favorites`, `favorite/favorited-me/viewed`, without coupling those dating-interest signals to gifts, Fan status, wallet/economy, private-photo access or messaging entitlement.

## Product boundary

LX-12 makes Favorite a real persisted social signal.

Implemented:

- favorite / unfavorite;
- `Yêu thích` — profiles the caller favorited;
- `Đã xem tôi` — profiles that viewed the caller;
- `Yêu thích tôi` — profiles that favorited the caller;
- mutual-favorite `Tương hợp` state;
- viewed / unviewed Search filters;
- my-favorites / favorited-me Search filters;
- profile-view recording at the routed Member Profile boundary;
- real Favorite heart actions on both mobile and desktop Search.

Deliberately not implemented in LX-12:

- Member Profile visual clone and final profile CTA composition — LX-13;
- private-photo request/approve flows — LX-14;
- messaging entitlement redesign — LX-15;
- membership gating — LX-17/LX-18;
- gift/economy behavior — LX-19;
- photo/CCCD/LinkedIn verification — LX-20;
- saved-search persistence remains deferred.

Favorite does not create or imply any entitlement to a date, message, gift, Fan status, private media, or financial benefit.

## Persistence model

Migration:

- `supabase/migrations/20260811173500_lx_12_favorite_system.sql`

### `public.profile_favorites`

Stores one directed favorite edge:

- `owner_id`;
- `favorite_id`;
- `created_at`;
- composite primary key `(owner_id, favorite_id)`;
- self-favorite is rejected;
- reverse lookup index supports `Yêu thích tôi` efficiently.

### `public.profile_views`

Stores one viewer → viewed profile pair:

- `viewer_id`;
- `viewed_id`;
- `first_viewed_at`;
- `last_viewed_at`;
- `view_count`;
- composite primary key `(viewer_id, viewed_id)`;
- self-view is rejected;
- timestamps/count are constrained;
- reverse index supports `Đã xem tôi`.

The view table intentionally stores the relationship/timestamps/count only. It does not store coordinates, KYC data, financial data, Gift/Fan state or private-media data.

## RLS / access boundary

Both LX-12 tables have RLS enabled.

Direct table access is revoked from:

- `public`;
- `anon`;
- `authenticated`.

Authenticated clients use narrow `SECURITY DEFINER` RPCs instead of selecting/mutating raw relationship tables.

This keeps the permission boundary explicit and allows blocked/inactive/profile-status checks to be applied centrally.

## Favorite RPCs

### `set_profile_favorite(p_profile_id, p_favorited)`

The authenticated adult caller can add or remove a Favorite.

Add validates:

- caller is authenticated and adult-complete;
- target is not caller;
- target is active/available;
- target is not blocked in either direction.

Removal remains possible even if the target later becomes hidden, inactive or blocked so a caller cannot be trapped with an undeletable Favorite edge.

Returns:

- `is_favorited`;
- `is_favorited_by`;
- `is_match`.

### `get_profile_interest_state(p_profile_id)`

Returns directional relationship state without exposing raw table rows:

- caller favorited target;
- target favorited caller;
- caller viewed target;
- target viewed caller;
- mutual Favorite.

### `list_luxy_interests(p_scope, p_limit, p_offset)`

Supported scopes:

- `favorites`;
- `viewed_me`;
- `favorited_me`.

The RPC returns privacy-safe card fields and excludes blocked, inactive, deleted, non-adult or discovery-disabled profiles.

Paging is bounded to the same 200-result safety ceiling used by Search.

## Profile-view recording

RPC:

- `record_profile_view(p_profile_id)`

The first visit creates the pair; later visits update `last_viewed_at` and increment `view_count`.

Self-view, blocked and unavailable targets are ignored.

Route adapter migration:

- `supabase/migrations/20260811173600_lx_12_profile_view_username_rpc.sql`

Adds:

- `record_profile_view_by_username(p_username)`

The route adapter resolves an active username and delegates to the UUID-based view RPC.

Mobile route integration:

- `apps/mobile/app/profile/_layout.tsx`

It records a non-critical view signal once per authenticated user/username route mount. A view-recording failure is logged and never prevents the Member Profile from rendering.

The profile page presentation itself is intentionally not redesigned in LX-12; LX-13 owns the Seeking-style Member Profile clone.

## Search V2 extension

LX-12 extends the existing LX-09 `search_luxy_profiles_v2` RPC in place. It does not create a second Favorite-only Search backend.

New request filters:

- `p_view_state = viewed | unviewed`;
- `p_favorite_scope = favorites | favorited_me`.

New privacy-safe result state:

- `is_favorited`;
- `is_favorited_by`;
- `is_viewed`.

All existing Search constraints remain intact, including adult eligibility, block exclusion, profile status/discovery gates, location privacy and bounded paging.

Client contract:

- `packages/supabase/src/search.ts`

now exposes:

- `LuxySearchViewState`;
- `LuxySearchFavoriteScope`;
- `viewState`;
- `favoriteScope`;
- the new relationship-state booleans.

Runtime Zod validation remains at the RPC boundary.

## Interests client contract

Added:

- `packages/supabase/src/interests.ts`;
- `packages/supabase/src/interests.test.ts`.

Exports include:

- `setProfileFavorite`;
- `getProfileInterestState`;
- `recordProfileView`;
- `recordProfileViewByUsername`;
- `listLuxyInterests`;
- bounded pagination helpers and types.

The module is exported through `packages/supabase/src/index.ts`.

Unit coverage verifies scope validation, favorite mutation shape, view recording, directional state, privacy-safe list fields and pagination.

## Search Favorite actions

Added reusable component:

- `apps/mobile/src/components/luxy-favorite-button.tsx`

Behavior:

- minimum 44px action target;
- empty heart → filled heart;
- optimistic Favorite mutation;
- rollback on mutation failure;
- query invalidation for Search, Interests and profile-interest state;
- directional accessibility label;
- mutual Favorite visual state.

The action is a sibling overlay to the profile-card navigation pressable rather than a nested interactive button.

Integrated into:

- `apps/mobile/src/components/luxy-search-mobile.tsx`;
- `apps/mobile/src/components/luxy-search-desktop.tsx`.

## Search filters activated

The LX-10/LX-11 placeholders owned by LX-12 are now functional.

### Lịch sử xem

- Tất cả;
- Chưa xem;
- Đã xem.

### Yêu thích

- Tất cả;
- Tôi yêu thích;
- Yêu thích tôi.

Verification controls remain visibly deferred to LX-20 and are not faked.

Mobile retains the LX-11 filter sheet; desktop retains the LX-10 filter rail.

## Interests page

Added:

- `apps/mobile/app/(tabs)/favorites.tsx`.

The authenticated shell `Yêu thích` navigation is now active and routes to the page.

The page presents three tabs:

1. `Yêu thích`;
2. `Đã xem tôi`;
3. `Yêu thích tôi`.

Member presentation is photo-first and responsive. Each card can navigate to the current Member Profile route and exposes the real Favorite action.

Mutual Favorite may display `Tương hợp`.

Incoming Favorite/View lists use fresh tab queries so changes from another authenticated session are not hidden behind a long stale client cache.

The empty-state copy explicitly keeps Favorite separate from gifts, Fan and private access.

## Browser regression

Added:

- `tests/br-06/luxy-favorites.spec.mjs`.

The two-user lifecycle verifies:

1. Viewer favorites Creator from Search;
2. Favorite persists after full reload;
3. Creator appears in Viewer `Yêu thích`;
4. Viewer appears in Creator `Yêu thích tôi`;
5. Creator visits Viewer profile;
6. Creator appears in Viewer `Đã xem tôi`;
7. Viewer removes the Favorite;
8. the outgoing and incoming Favorite lists both reflect removal.

Updated Search regressions verify:

- active Favorite hearts;
- active viewed/unviewed filters;
- active my-favorites/favorited-me filters;
- LX-20 verification controls remain deferred;
- mobile 2-column Search is stable at 390, 430 and 768 after responsive layout settles;
- 1023/1024 mobile/desktop Search breakpoint remains intact;
- desktop rail and 3-column result hierarchy remain intact.

The legacy desktop shell regression was scoped to semantic nav buttons so the new Search filter heading `Yêu thích` cannot create a false strict-locator collision.

## Validation

### Application CI

Run **`31522386566`** completed successfully on implementation-tested head:

`c5a58e22366bf9361117eeb21969d9c4d535cc3e`

Passed:

- workspace/environment validation;
- BR-01 through BR-10 source guards;
- lint;
- TypeScript;
- unit tests;
- admin/public/mobile web builds.

### Browser E2E

Run **`31522386538`** completed successfully on the same implementation-tested head:

`c5a58e22366bf9361117eeb21969d9c4d535cc3e`

Passed:

- local Supabase startup;
- clean reset from the full migration chain including LX-12;
- isolated BR-06 fixtures;
- fixture isolation verification;
- BR-06 browser suite including the new two-user Favorite/View lifecycle;
- LX-10/LX-11/LX-12 desktop/mobile Search regressions;
- existing authenticated shell/auth/profile/social regressions;
- BR-09 accessibility/resilience suite;
- evidence upload;
- local Supabase cleanup.

The final BR-06 Playwright report was inspected after the green run: **16 test results passed, with no failed or flaky/retry result**.

## LX-12 changed-file boundary

Compared with LX-11 completion head `ae542f8509d77352a6b9a5de54aa407e178f17e1`, implementation-tested LX-12 changes exactly these product/test areas:

### Mobile presentation/routing

- `apps/mobile/app/(tabs)/favorites.tsx`;
- `apps/mobile/app/profile/_layout.tsx`;
- `apps/mobile/src/components/luxy-favorite-button.tsx`;
- `apps/mobile/src/components/luxy-search-desktop.tsx`;
- `apps/mobile/src/components/luxy-search-mobile.tsx`;
- `apps/mobile/src/components/luxy-shell-navigation.tsx`.

### Supabase client

- `packages/supabase/src/index.ts`;
- `packages/supabase/src/interests.ts`;
- `packages/supabase/src/interests.test.ts`;
- `packages/supabase/src/search.ts`;
- `packages/supabase/src/search.test.ts`.

### Database

- `supabase/migrations/20260811173500_lx_12_favorite_system.sql`;
- `supabase/migrations/20260811173600_lx_12_profile_view_username_rpc.sql`.

### Browser regressions

- `tests/br-06/luxy-desktop-shell.spec.mjs`;
- `tests/br-06/luxy-favorites.spec.mjs`;
- `tests/br-06/luxy-search-desktop.spec.mjs`;
- `tests/br-06/luxy-search-mobile.spec.mjs`.

No Gift ledger, Fan state, wallet/balance, withdrawal, VietQR/payment, private-photo, messaging-entitlement, membership or verification implementation was changed by LX-12.

## Handoff

LX-12 is complete.

Next sequential roadmap session: **LX-13 — Clone Member Profile Seeking → Luxy.Love**.
