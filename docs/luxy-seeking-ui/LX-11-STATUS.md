# LX-11 — Seeking-style Mobile Search — Completion Status

Status: **Complete**

Implementation branch: `agent/luxy-seeking-ui-foundation`

Implementation/browser-tested head: `e33ec9ea2a57f32d4128d65d89b6254260d13eb5`

Previous LX-10 completion head: `9285d3f87d548c644dbf304dad5c036dca8460bd`

LX-11 reuses the LX-09 Search V2 backend contract and preserves the LX-10 desktop Search at the existing desktop breakpoint.

## Objective

Replace the remaining legacy MyFan discovery presentation on mobile/tablet with the Seeking-derived Luxy Search experience defined by the roadmap:

- two-column, photo-first member grid;
- compact Search toolbar;
- mobile filter drawer/sheet;
- mobile sort sheet;
- the same nationwide Search V2 filters and near-to-far location behavior as desktop;
- no second mobile-only backend contract.

## Responsive Search route

`apps/mobile/app/(tabs)/index.tsx` now uses one Search product with responsive presentation:

- `<1024px` → `LuxySearchMobile`;
- `>=1024px` → existing `LuxySearchDesktop`.

The legacy Discovery screen is no longer routed as the Search surface. It remains in source only as historical code and is not used by the main Search route.

This preserves the LX-10 desktop implementation while completing the mobile/tablet half of Search.

## Mobile Search implementation

Added:

- `apps/mobile/src/components/luxy-search-mobile.tsx`

The page is deliberately photo-centric rather than a generic rounded-card list.

### Search toolbar

The mobile toolbar provides:

- `Tìm kiếm` heading;
- current loaded-result count;
- `Bộ lọc` action;
- active-filter count badge;
- `Sắp xếp` action.

Primary toolbar actions meet the existing 44px minimum touch-target contract.

### Two-column member grid

The result surface uses two portrait cards per row across the LX-11 mobile/tablet range.

Each card presents:

- public/signed primary profile photo or neutral fallback;
- photo-count badge;
- online indicator;
- display name / username fallback;
- age;
- province;
- rounded distance from Search V2 when available;
- message/favorite visual affordances;
- full-card navigation to the member profile route when the username exists.

Favorites persistence is deliberately not activated by the heart affordance in LX-11; that contract belongs to LX-12.

## Filter sheet

The `Bộ lọc` action opens a bottom-aligned responsive sheet rather than exposing the desktop rail on a narrow screen.

The sheet reuses the same Search V2 semantics as desktop and includes functional controls for:

- Khu vực — canonical Vietnam provinces / nationwide;
- location refresh;
- Khoảng cách;
- Có ảnh;
- Đang online;
- Tuổi;
- Luxy relationship/lifestyle tags;
- Tình trạng quan hệ;
- Chiều cao;
- Cân nặng;
- Hút thuốc;
- Uống rượu/bia;
- Học vấn;
- Con cái;
- Ngôn ngữ;
- Nghề nghiệp;
- Tìm trong hồ sơ.

The sheet provides:

- `Đóng`;
- `Đặt lại`;
- disabled `Lưu tìm kiếm` presentation;
- primary `Xem kết quả` action.

The sheet is bounded to the viewport and its long filter body scrolls independently, keeping the final action region available on mobile web.

## Honest deferred filters

LX-11 keeps the same product truth boundary as LX-10.

The following Seeking-derived concepts are displayed but disabled because their persistence contracts belong to later sessions:

- Đã xác thực ảnh → LX-20;
- Đã xác thực CCCD → LX-20;
- Chưa xem / Đã xem → LX-12;
- Yêu thích / Yêu thích tôi → LX-12;
- saved-search persistence remains deferred.

No fake state is created to make these controls appear functional.

## Sort sheet

The `Sắp xếp` action opens a compact bottom sheet with the three Search V2 modes:

- `Gần nhất`;
- `Hoạt động gần đây`;
- `Mới tham gia`.

Changing sort updates the same Search V2 query contract; there is no client-only ordering that could contradict server filtering/location rules.

## Location and privacy

LX-11 reuses the existing location adapter and `setMyDiscoveryLocation(...)` path.

After a location refresh, the Search query is invalidated and nearest-first results are recalculated by the LX-09 backend.

The mobile UI only receives/presents rounded `distance_km`; it does not expose another member's latitude or longitude.

## Pagination and states

The mobile Search uses the same bounded Search V2 paging helpers as desktop.

It includes explicit UI for:

- initial loading;
- load error + retry;
- empty result;
- progressive `Xem thêm thành viên`;
- loading more;
- end of available results.

## Shared design-token adjustment

`packages/ui/src/index.ts` adds semantic aliases:

- `luxyColors.action`;
- `luxyColors.actionAccessible`.

Both resolve to the existing accessible action red (`#C81C1D`). This is a presentation-only token alias and does not introduce a new brand color or business behavior.

## Browser regression

Added:

- `tests/br-06/luxy-search-mobile.spec.mjs`

The regression verifies:

### 390×844

- authenticated mobile Search renders;
- at least three fixture profiles are available;
- first and second cards share a row;
- third card starts the next row;
- first/second card widths match;
- filter and sort actions meet the >=44px touch target;
- filter sheet opens and exposes the expected Search hierarchy;
- deferred LX-12/LX-20 concepts remain visibly deferred;
- apply action closes the sheet;
- sort sheet changes to recent activity;
- no document horizontal overflow;
- full-page screenshot evidence is attached.

### 430×932

- two-column grid remains intact;
- no horizontal overflow;
- screenshot evidence is attached.

### 768×1024

- Search remains the mobile/tablet two-column presentation;
- no horizontal overflow;
- screenshot evidence is attached.

### Breakpoint boundary

- `1023px` → mobile Search;
- `1024px` → existing LX-10 desktop Search.

The LX-10 desktop browser regression was updated to lock this new breakpoint handoff rather than expecting the removed legacy Discovery presentation.

## Existing regression updates

Because LX-11 replaces the old authenticated landing label `Khám phá`, old browser login helpers were updated to wait for the stable new Search surface instead of a removed legacy page label.

Updated:

- `tests/br-06/luxy-auth.spec.mjs`;
- `tests/br-06/luxy-responsive-shell.spec.mjs`;
- `tests/br-06/mobile-web-multi-account.spec.mjs`.

These changes do not weaken their original auth, shell or multi-account assertions; they only update the post-login handoff target to the current Search product.

## Validation

### Application CI

Run `31515827146` completed successfully on implementation-tested head `e33ec9ea2a57f32d4128d65d89b6254260d13eb5`.

Passed:

- workspace/environment validation;
- BR-01 through BR-10 source guards;
- lint;
- TypeScript;
- unit tests;
- admin/public/mobile web builds.

During implementation CI caught two references to semantic action-color names that were not yet exported by `luxyColors`. The shared token object was fixed with aliases to the already-approved accessible action red; the type gate was not bypassed.

### Browser E2E

Run `31515827160` completed successfully on implementation-tested head `e33ec9ea2a57f32d4128d65d89b6254260d13eb5`.

Passed:

- clean local Supabase start/reset;
- isolated browser fixtures;
- BR-06 browser suite including LX-03/LX-04 shell, LX-06 auth, LX-08 profile/settings, LX-10 desktop Search, LX-11 mobile Search and existing multi-account social lifecycle;
- BR-09 accessibility/resilience suite;
- BR-06 and BR-09 evidence upload;
- local Supabase cleanup.

Visual evidence was inspected after the green run. The 390, 430 and 768 captures show the intended photo-first two-column Search rather than the legacy MyFan card-list layout. The 1024 boundary returns to LX-10 desktop rail + three-column Search.

## LX-11 changed-file boundary

Compared with LX-10 completion head `9285d3f87d548c644dbf304dad5c036dca8460bd`, the implementation-tested LX-11 head changes only presentation/routing/tests:

- `apps/mobile/app/(tabs)/index.tsx`;
- `apps/mobile/src/components/luxy-search-mobile.tsx`;
- `packages/ui/src/index.ts`;
- `tests/br-06/luxy-auth.spec.mjs`;
- `tests/br-06/luxy-responsive-shell.spec.mjs`;
- `tests/br-06/luxy-search-desktop.spec.mjs`;
- `tests/br-06/luxy-search-mobile.spec.mjs`;
- `tests/br-06/mobile-web-multi-account.spec.mjs`.

There are **no `supabase/` changes** in LX-11.

## Safety / release boundary

- No new database migration.
- No Search V2 semantic change.
- No Favorites persistence activated.
- No viewed/favorited-me state invented.
- No profile verification state invented.
- No messaging entitlement changed.
- No membership/billing/gift behavior changed.
- `main` was not merged.
- Production was not deployed.

## Next roadmap session

**LX-12 — Favorite system**

Target: introduce the real `profile_favorites`/favorite-state contract and related viewed/favorited-me behavior so the heart and associated Search filters can move from honest visual affordances to persisted product behavior.