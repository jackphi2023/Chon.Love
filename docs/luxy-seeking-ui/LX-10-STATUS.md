# LX-10 — Seeking-style Desktop Search — Completion Status

Status: **Complete**

Implementation branch: `agent/luxy-seeking-ui-foundation`

Implementation/browser-tested head: `a23a0a6b53a51c95fb2ebb69ef7ddf6d1068a632`

LX-09 Search V2 is the backend contract consumed by this page.

## Objective

Rebuild authenticated Luxy Search on desktop from the supplied Seeking Search reference with the same core information hierarchy rather than continuing the old MyFan discovery-card presentation.

LX-10 is intentionally desktop-only. At widths below the desktop breakpoint the prior discovery screen remains intact until LX-11 rebuilds Search mobile.

## Responsive route boundary

`apps/mobile/app/(tabs)/index.tsx` now switches at the existing Luxy desktop breakpoint:

- `<1024px` → preserved legacy discovery screen;
- `>=1024px` → `LuxySearchDesktop`.

The previous mobile/tablet implementation was moved without redesign into:

- `apps/mobile/src/components/legacy-discovery-screen.tsx`

This prevents LX-10 from prematurely changing mobile UX before the dedicated LX-11 session.

## Desktop Search reconstruction

Added:

- `apps/mobile/src/components/luxy-search-desktop.tsx`

The page follows the supplied Seeking Search hierarchy:

- white authenticated content area under the existing Luxy shell;
- left filter rail using the shared `356px` Search sidebar token;
- subtle divider between filters and results;
- result count at upper left of the main area;
- sort control at upper right;
- three portrait member cards per row;
- minimal spacing and borders rather than generic rounded application cards.

The 1280 browser evidence confirms the intended visual structure: filter rail at left and three photo-centric cards across the first results row.

## Filter rail

Seeking-derived filter structure is represented in Vietnamese with functional controls where LX-09 already has a real data contract.

Functional in LX-10:

- Khu vực — canonical Vietnam provinces / nationwide;
- Cập nhật vị trí của tôi;
- Khoảng cách;
- Có ảnh;
- Đang online;
- Tuổi;
- Luxy relationship/lifestyle tags;
- Cân nặng;
- Tình trạng quan hệ;
- Chiều cao;
- Hút thuốc;
- Uống rượu/bia;
- Học vấn;
- Con cái;
- Ngôn ngữ;
- Nghề nghiệp;
- Tìm trong hồ sơ.

The top and bottom rail both provide the Seeking-style action pattern:

- `Xem kết quả`;
- `Lưu tìm kiếm` presentation;
- `Đặt lại`.

Saved-search persistence itself is not invented in LX-10.

## Honest deferred filters

The reference includes verification, viewed and favorite-state filters, but the owning Luxy persistence contracts come later in the roadmap.

LX-10 therefore presents these concepts as disabled, explicitly deferred affordances rather than fake filters:

- Đã xác thực ảnh → LX-20;
- Đã xác thực CCCD → LX-20;
- Chưa xem / Đã xem → LX-12;
- Yêu thích / Yêu thích tôi → LX-12.

This keeps the Seeking information hierarchy visible without making unsupported product claims.

## Sorting and location

The desktop page consumes `searchLuxyProfilesV2(...)` directly.

Sort options:

- `Gần nhất` — default;
- `Hoạt động gần đây`;
- `Mới tham gia`.

Location refresh uses the existing location adapter and invalidates Search results after the viewer's location is updated.

The UI never displays raw coordinates. Member cards use `formatLuxyDistance(...)` and show only rounded distance returned by LX-09.

## Member grid

Each result card is photo-first and includes:

- portrait aspect ratio from the shared Luxy/Seeking layout token;
- signed avatar URL when a visible avatar exists;
- neutral fallback when no avatar is available;
- photo-count badge;
- online indicator;
- display name / nickname;
- age;
- province;
- rounded distance when available;
- message/favorite visual affordances;
- full-card navigation to the existing member profile route.

LX-10 does not persist Favorites or change messaging entitlements. Those behaviors remain in LX-12 and LX-15.

## Pagination and states

Search loads a bounded page through the LX-09 shared client and supports progressive `Xem thêm thành viên` pagination up to the Search contract limit.

Explicit states exist for:

- initial loading;
- error + retry;
- empty result;
- loading more;
- end of available results.

## Browser regression

Added:

- `tests/br-06/luxy-search-desktop.spec.mjs`

The regression verifies:

- 1280×900 desktop Search renders the filter rail and results area;
- core Seeking-derived filter hierarchy is present;
- default and recent sort interaction works;
- at least three fixture cards form the same first row;
- the filter rail remains approximately 340–370px;
- results remain to the right of the rail;
- document horizontal overflow is absent;
- 1024px remains desktop Search;
- 1023px returns to the preserved pre-LX-11 discovery screen;
- a full-page LX-10 screenshot is uploaded as browser evidence.

During browser regression, existing LX-08 tests were found to wait for the old desktop page label `Khám phá`. Their login helpers were changed to wait for the stable authenticated shell label `Tìm kiếm`, so they remain valid on both desktop and mobile after the route split.

## Final validation

### Application CI

Run `31513023270` completed successfully on source head `cfa4a47b699848a033db9ab6eecf3baa0bd61acd`.

Passed:

- workspace/environment validation;
- BR source guards;
- lint;
- TypeScript;
- unit tests;
- admin/public/mobile web builds.

### Database

Run `31512982323` completed successfully on implementation-tested head `a23a0a6b53a51c95fb2ebb69ef7ddf6d1068a632`.

It includes a clean rebuild plus the full LX-09 Search Backend V2 contract and generated-type verification.

### Browser E2E

Run `31512982365` completed successfully on implementation-tested head `a23a0a6b53a51c95fb2ebb69ef7ddf6d1068a632`.

Passed:

- BR-06 mobile web/browser suite, including LX-03/LX-04 shell, LX-08 profile/settings and LX-10 desktop Search;
- BR-09 accessibility/resilience suite;
- browser evidence upload;
- local Supabase cleanup.

## LX-10 change boundary

LX-10 itself introduces no new database migration and does not alter LX-09 Search semantics.

It is a presentation/integration session consuming the already-versioned Search V2 API.

It also deliberately leaves `<1024px` Search unchanged for LX-11.

## Safety / release boundary

- No Favorites persistence activated.
- No verification status invented.
- No messaging entitlement changed.
- No subscription or gift behavior changed.
- `main` was not merged.
- Production was not deployed.

## Next roadmap session

**LX-11 — Clone Search mobile**

Target: Seeking-derived mobile Search with a two-column photo grid and filter drawer/sheet, reusing the same LX-09 Search V2 contract rather than creating a second mobile backend.
