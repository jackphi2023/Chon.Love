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

Gift/Wallet/KYC payout/withdrawal code lịch sử có thể còn tồn tại để bảo toàn ledger và backward compatibility, nhưng các feature tài chính chưa được mở trong Web V1 nếu feature flag đang `false`.

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

## 4. Monorepo architecture

```text
/
├── mobile/       # CANONICAL Chon.Love responsive Expo Web product
├── admin/        # Admin/operations web
└── public-web/   # RETAINED LEGACY SOURCE only; NOT a production Netlify target

packages/
├── config/
├── domain/
├── supabase/
├── ui/
└── validation/

supabase/
├── migrations/
├── functions/
└── tests/
```

### Vì sao vẫn còn `@myfan/*`, `luxy_*`, `creator_*`?

Dự án kế thừa MyFan → Luxy.Love → Chon.Love. Tên kỹ thuật cũ **không đồng nghĩa tính năng cũ đang active**.

Không broad-rename package, table, enum hoặc migration chỉ để đồng bộ branding nếu việc đó có thể phá:

- Auth/profile foreign keys.
- generated types.
- RPC signatures.
- ledger/payment history.
- migration replay.
- deployed Edge Functions.

Nguyên tắc cleanup là **retire runtime trước, rename internal sau khi có migration/test riêng**.

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

Tên `EXPO_PUBLIC_MYFAN_ENV` vẫn là technical legacy contract và chưa rename trong Web V1.

### Preview/staging isolation

Deploy Preview, branch deploy, `develop` và `release/staging` **không hard-code production Supabase URL trong repository**.

Nếu cần preview có backend, cấu hình `EXPO_PUBLIC_SUPABASE_URL` + publishable key theo đúng Netlify deploy context. Không có preview database thì preview phải fail closed thay vì vô tình ghi test data vào production.

### Feature flags fail-closed

Web V1 hiện giữ các feature sau `false` tại Netlify:

```text
EXPO_PUBLIC_FEATURE_GOOGLE_PLAY_BILLING=false
EXPO_PUBLIC_FEATURE_SEND_GIFT=false
EXPO_PUBLIC_FEATURE_CREATOR_WALLET=false
EXPO_PUBLIC_FEATURE_CREATOR_KYC=false
EXPO_PUBLIC_FEATURE_WITHDRAWAL=false
```

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

Public RPC dùng `SECURITY DEFINER` phải có explicit grant allowlist. Admin-only RPC không được executable bởi `anon`. Creator Activity RPC đã retire khỏi Chon.Love V1 phải bị revoke khỏi client roles thay vì chỉ ẩn nút ở frontend.

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

`validate:creator-e2e:legacy` chỉ là historical regression tool, **không phải Chon.Love Web V1 release gate**.

## 8. Build commands

Canonical production-compatible build:

```bash
pnpm build
```

`pnpm build` hiện build:

1. `apps/admin`
2. `apps/mobile` Expo Web

Không còn chạy combined `public-web + /app` build.

Nếu cần kiểm tra Next.js public-web source lịch sử riêng:

```bash
pnpm build:public-web:legacy
```

Lệnh này không có nghĩa `apps/public-web` là production target.

## 9. Release gate

Trước merge/deploy:

1. Fetch latest `main` và review full diff.
2. Application CI green.
3. Database/migration tests green cho mọi DB change.
4. Browser E2E core flow green.
5. Existing-user login/session/onboarding re-accept smoke pass.
6. Search → Profile → Favorite → Message pass.
7. Free/Premium/Diamond entitlement pass.
8. Private photo entitlement pass.
9. Selfie/CCCD/LinkedIn verification path pass.
10. Netlify build log phải đúng `@myfan/mobile build:web` và publish `apps/mobile/dist`.
11. Smoke exact deployed SHA, không chỉ local branch.
12. Không merge nếu một fix yêu cầu nới RLS/ACL hoặc reset production data.

## 10. Security items cần theo dõi trước public launch

- Bật/test Supabase Auth leaked-password protection.
- Rà explicit allowlist cho SECURITY DEFINER RPC.
- Tạo migration defense-in-depth cho private tables còn RLS-off sau khi test RPC/service-role path.
- Giữ service-role/OAuth secret/PII encryption key ngoài frontend và Git.
- Google OAuth UI phải fail closed cho tới khi hosted provider được cấu hình đúng.

## 11. Documentation policy

Các thư mục `docs/phase-*`, `docs/br-*`, `docs/luxy-seeking-ui` và migration cũ là historical implementation records. Chúng có thể chứa tên MyFan/Luxy hoặc assumptions đã superseded.

**README này + current `main` + applied Supabase migrations là baseline để tiếp tục test-fix, tối ưu UI, build tính năng và chuẩn bị Chon.Love live.** Nếu tài liệu lịch sử mâu thuẫn với implementation hiện tại, cập nhật tài liệu hoặc retire đường code cũ; không tạo thêm lớp chấp vá mới.
