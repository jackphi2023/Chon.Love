# Chon.Love — Web V1

**Chon.Love** là nền tảng hẹn hò web-first dành cho người trưởng thành tại Việt Nam, phát triển theo hướng **người thật, văn minh, an toàn và có tiêu chuẩn**. Product học information architecture và database/search-first model từ Seeking.com, nhưng UI, nội dung, verification, payment và safety được điều chỉnh cho Chon.Love.

> **Chọn đúng Người, Yêu đúng Gu**

SEO title chuẩn:

`Chon.Love | Chọn đúng người, Yêu đúng Gu`

SEO description chuẩn:

`Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm.`

## 1. Source of truth

- Repository: `jackphi2023/Chon.Love`
- Production branch: `main`
- Supabase production project: `asnydvqsduonyidjyyzq`
- Production web app: `apps/mobile`
- Production Netlify config: `/netlify.toml` tại repository root
- Admin app: `apps/admin`

Luôn fetch `main` mới nhất trước khi sửa code, test hoặc deploy. Không dùng tài liệu MyFan/Luxy/LX/BR cũ làm product source of truth khi nó mâu thuẫn với code hiện tại.

Trong giai đoạn UI modernization, thay đổi UI phải đi qua **một integration branch/Draft PR**, không merge rời rạc từng phiên vào `main`. Chỉ UI-REL01 mới được phép thực hiện merge cuối cùng sau khi toàn bộ roadmap và release gates đạt yêu cầu.

## 2. Product scope — Chon.Love Web V1

Web V1 là một responsive web product cho:

- Desktop browser.
- Mobile Safari trên iOS.
- Mobile Chrome trên Android.

Native iOS/Android và EAS không phải release target hiện tại.

Core V1:

- Kết nối/Search member theo database, filter và distance.
- Yêu thích/Interests.
- Tin nhắn trực tiếp theo entitlement.
- Member Profile và Edit Profile.
- Premium / Diamond.
- Selfie / CCCD / LinkedIn verification.
- Public/private profile photos.
- Safety: block, report, moderation, account status.
- VietQR/membership payment trên Web theo contract hiện hành.

**Activity/Creator feed không thuộc Chon.Love Web V1.** Các route lịch sử chỉ được giữ dạng redirect an toàn để bookmark cũ không mở lại sản phẩm MyFan/Luxy.

Gift/Wallet/KYC payout/withdrawal code lịch sử có thể còn tồn tại để bảo toàn ledger và backward compatibility. Feature chỉ được mở khi đúng feature flag, entitlement và contract backend hiện hành.

## 3. Product rules hiện hành

### Auth và onboarding

- Guest không browse member list.
- Người dùng phải đủ 18 tuổi.
- Existing user phải tiếp tục đăng nhập bằng account/Auth UUID hiện có.
- Không bulk-reset user, không tạo lại Auth user, không đổi UUID để “làm sạch” dữ liệu.

### Search và profile

- Chon.Love ưu tiên search/database-first, không swipe-first.
- Không expose email, phone, DOB đầy đủ, KYC, storage path, tọa độ chính xác hoặc Auth UUID qua public profile.
- Distance trả về dạng đã làm tròn; backend giữ tọa độ chính xác.

### Favorite, messaging và membership

- Free member có thể browse/search cơ bản và Favorite theo entitlement backend.
- Direct messaging không phụ thuộc friendship legacy nếu membership contract hiện tại cho phép.
- Premium/Diamond là entitlement backend, không chỉ là badge UI.

### Private photos

Contract hiện tại của LX-20/Chon.Love là:

- Owner có thể đổi ảnh profile eligible giữa `Public` và `Private`.
- **Premium/Diamond có quyền xem private photos tự động theo backend entitlement.**
- Free member chỉ thấy private-photo count/locked upgrade affordance; không nhận storage path.
- Legacy request/approve rows có thể còn trong database để backward compatibility nhưng **không còn là authorization source of truth**.
- Gift, Fan và friendship không unlock private photos.

### Verification

Public badges:

- Selfie.
- CCCD/Identity.
- LinkedIn.

Raw verification documents, legal identity và provider payload không public.

## 4. Monorepo architecture và chiến lược loại bỏ legacy

```text
/
├── apps/
│   ├── mobile/       # CANONICAL Chon.Love responsive Expo Web product
│   ├── admin/        # Admin/operations web
│   └── public-web/   # RETAINED LEGACY SOURCE only; NOT production target
├── packages/
│   ├── config/
│   ├── domain/
│   ├── supabase/
│   ├── ui/
│   └── validation/
└── supabase/
    ├── migrations/
    ├── functions/
    └── tests/
```

### Mục tiêu cuối cùng đối với MyFan/Luxy

Chon.Love là product duy nhất được phép xuất hiện trong production UI. Từ các phiên UI mới:

- Không tạo thêm component, hook, route, CSS/style token, test hoặc copy mới mang tên `myfan`, `luxy`, `creator` nếu đó là UI/runtime Chon.Love.
- Component mới dùng prefix/namespace rõ ràng như `Chon*`, `chon-*`, hoặc tên trung tính theo domain.
- Không hiển thị branding MyFan/Luxy trong text, aria-label, metadata, route public, UI state hoặc asset production.
- Những component legacy còn active phải được **migrate consumer sang component Chon.Love rồi xóa wrapper cũ**, thay vì tiếp tục bọc thêm một lớp.
- Không giữ hai renderer có cùng trách nhiệm cho mobile/desktop nếu có thể dùng một responsive component.
- Test mới phải dùng naming Chon.Love; test legacy chỉ tồn tại tạm thời cho tới khi consumer tương ứng được migrate.

### Không broad-rename database/package trong cùng phiên UI

Repository kế thừa MyFan → Luxy.Love → Chon.Love nên vẫn có technical identifiers như `@myfan/*`, `luxy_*`, enum/table/RPC/migration lịch sử. Mục tiêu cuối cùng là loại bỏ legacy có kiểm soát, nhưng **không được mass-rename chúng trong một phiên UI** nếu có thể phá:

- Auth/profile foreign keys.
- generated types.
- RPC signatures.
- ledger/payment history.
- migration replay.
- Edge Functions đã deploy.
- backward compatibility của existing user.

Chiến lược bắt buộc:

1. Retire visible/runtime consumer cũ.
2. Chuyển UI sang Chon.Love shared component.
3. Bổ sung regression test.
4. Xóa file/import legacy không còn consumer.
5. Với DB/package/RPC legacy: tạo migration/refactor riêng, forward-only, có contract test và compatibility plan.
6. Chỉ xóa tên kỹ thuật cũ khi không còn runtime/deployment dependency.

**Không được dùng lý do backward compatibility để tiếp tục tạo code UI mới mang tên Luxy/MyFan.**

## 5. Production web và Netlify

### Canonical build

Production chỉ build Expo Web hiện tại:

```bash
corepack enable && pnpm --filter @myfan/mobile build:web
```

Publish:

```text
apps/mobile/dist
```

Root `/netlify.toml` là source of truth.

### Netlify UI settings

Trong Build settings của site production:

```text
Production branch: main
Base directory: [repository root / để trống]
Package directory: [để trống]
Build command: [để netlify.toml quản lý]
Publish directory: [để netlify.toml quản lý]
Functions directory: [để trống]
```

Nếu Netlify UI còn command/package từ MyFan/Luxy như:

```text
/mobile
/public-web
pnpm build:netlify:chon
/public-web/.next
```

hãy xóa override để root `netlify.toml` kiểm soát build.

`apps/public-web/netlify.toml` hiện fail-closed có chủ đích để ngăn package cũ bị chọn nhầm làm production site.

### Environment

Production URL hiện dùng Supabase project:

```text
https://asnydvqsduonyidjyyzq.supabase.co
```

Publishable/anon key phải đặt trong Netlify Environment Variables, không commit vào Git:

```text
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

Tên `EXPO_PUBLIC_MYFAN_ENV` hiện là technical legacy contract. Không tạo thêm usage mới; phải được retire trong một refactor riêng khi environment validation và Netlify contexts đã có migration plan.

### Preview/staging isolation

Deploy Preview, branch deploy, `develop` và `release/staging` **không hard-code production Supabase URL trong repository**.

Nếu cần preview có backend, cấu hình `EXPO_PUBLIC_SUPABASE_URL` + publishable key theo đúng Netlify deploy context. Không có preview database thì preview phải fail closed thay vì vô tình ghi test data vào production.

### Feature flags fail-closed

Web V1 giữ feature nhạy cảm fail-closed theo Netlify environment. Không bật feature chỉ bằng thay UI; UI và backend entitlement/contract phải đồng thời sẵn sàng.

## 6. Supabase/data preservation policy

Production database đã có user thật/fixture, profile, media, membership và lịch sử nghiệp vụ. Cleanup **không được**:

- xóa/recreate `auth.users`;
- đổi user UUID;
- truncate profile/media/membership/ledger tables;
- sửa nội dung migration đã apply;
- drop table legacy chỉ vì tên MyFan/Luxy;
- reset database production để “làm sạch”.

Mọi schema change phải là **forward-only migration**.

### Private schema

Client `anon` và `authenticated` không được cấp `USAGE` trực tiếp lên `private` schema hoặc direct table grants trên các bảng identity/membership nhạy cảm. Một số private tables vẫn chưa bật RLS vì đang được service/RPC-only access; đây là defense-in-depth debt cần xử lý bằng một phiên migration + regression riêng, không bật RLS hàng loạt trên production mà chưa kiểm thử RPC.

### SECURITY DEFINER

Public RPC dùng `SECURITY DEFINER` phải có explicit grant allowlist. Admin-only RPC không được executable bởi `anon`. Runtime đã retire khỏi Chon.Love V1 phải bị revoke khỏi client roles thay vì chỉ ẩn nút ở frontend.

### Edge Functions

One-time seed/import/bootstrap endpoints sau khi dùng xong phải trả `410`/fail-closed hoặc được tombstone. Không giữ endpoint Auth Admin/seed thực thi được chỉ vì “có thể cần lại”.

## 7. Local development

Yêu cầu:

- Node `22.23.1` theo repo/Netlify pin.
- pnpm `10.15.1`.
- Corepack.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm validate:workspace
pnpm validate:environments
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Full release-source validation:

```bash
pnpm validate
```

Current release gates:

```text
validate:security
validate:integration
validate:auth
validate:social-e2e
validate:browser-e2e
validate:vietqr-reconciliation
validate:kyc-withdrawal-operations
validate:runtime-quality
validate:netlify-release
validate:branding
```

Legacy regression tools không được coi là product source of truth; sau khi consumer đã migrate sang Chon.Love, test legacy tương ứng phải được rename hoặc retire.

## 8. Build commands

Canonical production-compatible build:

```bash
pnpm build
```

`pnpm build` build:

1. `apps/admin`
2. `apps/mobile` Expo Web

Không chạy combined `public-web + /app` build cho production.

Nếu cần kiểm tra Next.js public-web source lịch sử riêng:

```bash
pnpm build:public-web:legacy
```

Lệnh này không có nghĩa `apps/public-web` là production target.

## 9. Chon.Love UI Design Contract

Mọi phiên UI mới phải bám một design system chung thay vì hard-code style riêng từng màn.

### Brand palette

Semantic tokens là source of truth. Các màu chủ đạo đã chốt:

- Primary red: `#D92D2A`.
- Red hover/active: `#E94A47`.
- Gold: `#FFBB00`.
- Strong gold: `#B87800`.
- Warm surface: `#FAF5F2`.
- Warm highlight: `#FFF1C8`.
- White/surface, ink/text, muted, border, danger, online, focus và overlay lấy từ shared token package.

Không tạo thêm biến màu trùng nghĩa trong từng screen/component.

### Typography

Baseline hiện hành:

- Desktop H1: 36px.
- H2: 26px.
- H3: 16px.
- Body: 12px.
- Help/eyebrow: 10px.

Responsive override phải có lý do rõ ràng và ưu tiên shared typography token. Không trộn nhiều font-size gần giống nhau chỉ vì copy CSS cũ.

### Responsive/layout

- Mobile web được coi là sản phẩm chính, phải dùng tốt như native-app web experience.
- Desktop dùng cùng information architecture và component contract; không tạo một sản phẩm desktop khác nếu không có thiết kế riêng.
- Nếu thiết kế desktop chưa được chỉ định, center/adapt layout mobile một cách hợp lý.
- Ưu tiên một responsive renderer thay vì duplicate `MobileComponent`/`DesktopComponent` có cùng nghiệp vụ.
- Shared header/footer/page chrome phải được tái sử dụng.
- Touch target, breakpoints, content padding, shadows và interaction state lấy từ shared UI tokens.

### Images/icons

- Không làm méo/crop asset ngoài yêu cầu thiết kế.
- Icon thao tác phải rõ ràng, đúng kích thước, không dùng emoji/glyph thay icon khi component icon chuẩn đã tồn tại.
- Badge Premium/Diamond dùng asset/component chuẩn; không tự invent badge mới khi asset final chưa được duyệt.
- Ảnh member phải giữ aspect ratio và tránh blur do CSS sizing sai.

### Buttons và interaction

- Primary CTA: đỏ Chon.Love, hover sáng hơn và shadow/interaction rõ nhưng không phô trương.
- Gold-outline dùng cho secondary/selected actions theo contract màn hình.
- Disabled state dùng shared opacity/token.
- Không copy-paste button style riêng cho từng screen nếu semantics giống nhau.

### Accessibility

- Button có accessibility role/label phù hợp.
- Modal sử dụng modal semantics và close affordance rõ ràng.
- Không dùng chỉ màu sắc để truyền đạt trạng thái khi có thể có text/icon/state.
- Browser regression nên khóa aria/accessibility contract quan trọng nhưng không phụ thuộc implementation detail không ổn định của React Native Web.

## 10. UI modernization roadmap và trạng thái tích hợp

Snapshot này mô tả integration branch của UI modernization; **không đồng nghĩa đã production release**.

### Đã triển khai về code/presentation trên integration branch

**UI-01 — Homepage**

- Warm surface `#FAF5F2` cho các section chính.
- Hero spacing, responsive slider media, giảm flash/fallback duplication.
- Artwork desktop giữ full image, không crop/méo.
- Typography hierarchy và CTA được đồng bộ.
- Testimonials/benefit/culture/sứ mệnh được làm sạch theo Chon.Love branding.

**UI-02 — Navigation sau login**

- Mobile logo cân giữa.
- Avatar/menu sizing gọn hơn.
- `Quà` đổi thành `Quà tặng`.
- Menu icon/text alignment thống nhất.
- Dropdown responsive và interaction state đồng bộ.

**UI-F00 — UI foundation**

- Semantic `chonColors`, `chonTypography`, `chonBreakpoints`, `chonLayout`, `chonShadows`, `chonInteraction`, `chonButtons`.
- Membership badge sizing contract.
- Giữ compatibility tạm thời với legacy tokens trong khi consumer được migrate.

**UI-F01 — Shared Page Chrome**

- Shared authenticated page chrome.
- Shared site footer.
- Settings chuyển sang parent authenticated layout.
- Giảm duplicate header/footer/navigation ownership ở từng screen.

**UI-C01/C02 — Connect + shared member-card foundation**

- Shared Connect member card thay hai renderer mobile/desktop trùng lặp.
- Membership badge đúng entitlement presentation.
- Photo count dùng icon camera thực, không glyph.
- Favorite active: red background + gold heart.
- Overlay card gọn hơn.
- `Xem kết quả` dùng shared gold-outline button.
- Shared member photo/favorite foundation được đưa về component/hook dùng lại.

**UI-FAV01 — Favorites**

- Favorites được chuyển dần sang shared member-card/member-photo/favorite primitives.
- UI/tab/action presentation được làm gọn theo Chon.Love thay vì giữ presentation Luxy cũ.

**UI-MSG01 — Mailbox**

- Mailbox UI được đơn giản hóa theo yêu cầu Chon.Love.
- Regression test riêng khóa mailbox presentation để tránh quay lại category/promo cũ.

**UI-CHAT01 — Conversation**

- Conversation presentation được đồng bộ với palette/interaction Chon.Love.
- Gift action dùng shared gift icon/label.
- Browser regression riêng bảo vệ chat UI.

**UI-MSG02 — Deleted Message Contract**

- Bổ sung retention contract cho deleted messages.
- Đây là thay đổi contract có migration/test riêng, không phải CSS patch.
- Database regression cho deleted-message retention đã pass ở integration workflow gần nhất; generated client types vẫn phải được đồng bộ trước final release gate.

**UI-GIFT01 — Gift Picker**

- Giữ một shared gift modal cho Profile và Conversation.
- Mobile ưu tiên bottom-sheet; desktop modal gọn, responsive.
- Grid 4 cột trên phone nhỏ / 5 cột trên màn rộng hơn.
- Giữ nguyên catalog 20 quà và giá 1–20 ❤️ từ backend.
- Selected state dùng gold/warm surface; CTA `Gửi quà` dùng primary red.
- Balance/loading/error/empty states được trình bày rõ ràng.
- UI không hiển thị VNĐ cho catalog quà.
- Không thay đổi `sendGiftToMember`, wallet, membership entitlement, idempotency, ledger hoặc payout logic.
- Browser regression khóa catalog 20 item, giá đầu/cuối và mobile/desktop presentation.

### Các phiên còn lại theo roadmap

1. `UI-PRO01` — Public Member Profile; canonical signed-in route `/thanh-vien/[username]`, retire legacy public profile route thành redirect an toàn.
2. `UI-PRO02` — My Profile; canonical share URL theo `public_profile_code`, đồng bộ edit/view profile.
3. `UI-MEM01` — Membership; shared auth chrome/footer, clean Chon.Love copy, remove privacy controls khỏi membership.
4. `UI-SET01` — Settings; chuyển privacy controls đúng ownership và loại visible Luxy strings.
5. `UI-BAL01` — Balance/VietQR; six heart packs, server-priced, reuse existing order/polling contract.
6. `UI-AUTH01` — Forgot/Reset; Chon.Love auth presentation và responsive states.
7. `UI-ASSET01` — Final Premium/Diamond/assets; chỉ dùng asset user-approved.
8. `UI-QA01` — Global UI regression, responsive/accessibility/branding/legacy audit.
9. `UI-REL01` — Sync latest `main`, fix conflicts, full release gates, **single final merge**, Netlify build + production smoke.

## 11. Quy tắc code sạch cho mọi phiên UI tiếp theo

Mỗi phiên phải đáp ứng các nguyên tắc sau:

1. **Không patch chồng lớp.** Trước khi thêm component/style mới phải tìm component có cùng trách nhiệm để reuse hoặc refactor.
2. **Không duplicate mobile/desktop business renderer.** Chỉ tách presentation khi responsive contract thật sự khác.
3. **Không thay business logic trong phiên UI-only.** Nếu phát hiện logic bug, tách migration/domain session và test riêng.
4. **Không hard-code branding/style nếu shared semantic token đã có.**
5. **Không introduce Luxy/MyFan naming mới.** Legacy active code phải giảm dần qua từng phiên.
6. **Không đổi user/database để làm UI test pass.** Fixture phải isolated; production data không được reset.
7. **Không sửa migration đã apply.** Schema change luôn forward-only.
8. **Không nới RLS/ACL/entitlement để vượt test.**
9. **Mỗi UI session có regression phù hợp.** Unit/contract/browser tùy phạm vi.
10. **Không merge `main` giữa roadmap.** Integration branch/Draft PR là nơi gom và kiểm tra toàn bộ.

### Definition of Done cho một UI screen/component

Một screen chỉ được coi là sạch khi:

- Có một owner/component chính rõ ràng.
- Không còn renderer cũ đang active song song.
- Không copy-paste style semantics đã có token/component dùng chung.
- Không có visible MyFan/Luxy branding.
- Responsive mobile/desktop không vỡ layout.
- Loading/error/empty/disabled/hover/pressed states rõ ràng.
- Test quan trọng đã khóa hành vi/presentation.
- Không đổi backend behavior ngoài scope.

## 12. Legacy cleanup debt phải đóng trước UI-REL01

Integration branch hiện vẫn còn một số active file/import/test mang tên Luxy, ví dụ các nhóm:

- search mobile/desktop;
- shell/desktop navigation;
- favorite button;
- gift modal;
- settings layout;
- một số `luxy-seeking-*` wrappers;
- một số Browser tests `luxy-*`.

Điều này **không được coi là trạng thái cuối cùng**.

Trước final release cần audit toàn bộ `apps/mobile` và production test surface để:

- rename/migrate active UI component sang Chon.Love naming;
- update all consumers;
- xóa wrapper legacy không còn consumer;
- rename/retire test legacy tương ứng;
- đảm bảo route public không còn Luxy/MyFan;
- chạy branding search/validation trên built bundle;
- xác nhận việc rename không làm thay đổi backend contract.

Riêng `@myfan/*`, database `luxy_*` và historical migrations phải được đánh giá theo dependency. Nếu chưa thể xóa an toàn trước Web V1 release, chúng phải được **quarantine thành technical legacy only**, không được rò ra UI/route/copy hoặc tiếp tục lan rộng. Full internal rename phải là refactor/migration riêng có test, không phải find/replace.

## 13. Current integration risks cần xử lý trước merge main

### R1 — Generated database types đang lệch schema

Workflow database gần nhất đã pass clean reset, BR contracts, LX contracts, signup contracts, UI-MSG02 retention, concurrent gift/withdrawal ledger và schema lint, nhưng fail tại bước **Verify generated public contract**.

Hành động bắt buộc:

- lấy generated public `database.types.ts` từ schema hiện tại;
- commit nguyên contract được generate, không hand-edit để che diff;
- chạy lại Database workflow và workspace typecheck.

### R2 — Browser E2E chưa được phép coi là xanh khi còn đang chạy

Không merge/đánh dấu release-ready khi BR-06/BR-09 chưa completed success trên exact final SHA.

Nếu Browser fail:

- kiểm tra artifact/screenshot/trace;
- phân loại regression mới hay test contract cũ;
- không nới assertion quan trọng chỉ để pass;
- không thay production data/entitlement để làm fixture pass.

### R3 — Legacy UI naming còn active

Đây là rủi ro maintainability lớn nhất cho mục tiêu branding/code cleanliness. Nếu merge ngay, team có thể tiếp tục import `Luxy*` components và tạo thêm patchwork.

Giải pháp: đóng cleanup theo từng ownership boundary trước UI-QA01/UI-REL01, không broad-rename package/DB cùng lúc.

### R4 — PR tích hợp lớn và sống lâu

Draft PR UI modernization chứa nhiều phiên liên tiếp nên càng về cuối càng có nguy cơ lệch `main`.

Giải pháp tại UI-REL01:

- fetch/rebase/sync latest `main` một lần có kiểm soát;
- resolve conflict theo current product source of truth;
- review full diff;
- chạy lại toàn bộ gates trên exact merge candidate.

### R5 — Design token coexistence

Trong giai đoạn chuyển đổi vẫn có thể tồn tại `luxy*` token hoặc local styles. Nếu không cleanup, cùng một semantic action có thể có nhiều màu/font/padding khác nhau.

Giải pháp: các phiên còn lại phải ưu tiên `chon*` tokens/components; UI-QA01 phải audit hard-coded colors, duplicate button/card styles, typography drift và spacing drift.

## 14. Final release gate — chỉ UI-REL01 được merge/deploy

Trước merge/deploy:

1. Hoàn tất tất cả session trong roadmap.
2. Sync latest `main` và review full diff.
3. Application CI green trên exact final SHA.
4. Database/migration tests green cho mọi DB change.
5. Browser E2E core flow + accessibility/resilience green.
6. Existing-user login/session/onboarding re-accept smoke pass.
7. Search → Profile → Favorite → Message → Gift UI flow pass theo entitlement.
8. Free/Premium/Diamond entitlement pass.
9. Private photo entitlement pass.
10. Selfie/CCCD/LinkedIn verification path pass.
11. Branding audit: không visible MyFan/Luxy trong production app.
12. Legacy active UI/component audit hoàn tất; không còn duplicate renderer gây patchwork.
13. Generated database types khớp schema.
14. Netlify build log phải đúng canonical Expo Web target và publish `apps/mobile/dist`.
15. Chỉ **một lần merge** integration PR vào `main` sau khi tất cả gate trên xanh.
16. Smoke exact deployed SHA trên Netlify production sau merge.
17. Không merge nếu một fix yêu cầu nới RLS/ACL, reset production data, hoặc bỏ test để qua gate.

## 15. Security items cần theo dõi trước public launch

- Bật/test Supabase Auth leaked-password protection.
- Rà explicit allowlist cho SECURITY DEFINER RPC.
- Tạo migration defense-in-depth cho private tables còn RLS-off sau khi test RPC/service-role path.
- Giữ service-role/OAuth secret/PII encryption key ngoài frontend và Git.
- Google OAuth UI phải fail closed cho tới khi hosted provider được cấu hình đúng.

## 16. Documentation policy

Các thư mục `docs/phase-*`, `docs/br-*`, `docs/luxy-seeking-ui` và migration cũ là historical implementation records. Chúng có thể chứa tên MyFan/Luxy hoặc assumptions đã superseded.

**README này + current `main` + applied Supabase migrations là baseline để tiếp tục test-fix, tối ưu UI, build tính năng và chuẩn bị Chon.Love live.** Trong thời gian UI roadmap chưa merge, integration branch/Draft PR là implementation candidate nhưng không phải production source of truth.

Sau mỗi UI session nên cập nhật:

- session đã làm gì;
- files/ownership nào đã được consolidate;
- regression tests mới;
- legacy debt đã xóa/đã còn;
- gates pass/fail;
- rủi ro còn lại trước UI-REL01.

Nếu tài liệu lịch sử mâu thuẫn với implementation hiện tại, cập nhật tài liệu hoặc retire đường code cũ; **không tạo thêm lớp chấp vá mới**.
