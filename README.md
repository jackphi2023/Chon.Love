# Chon.Love — Web V1

**Chon.Love** là nền tảng hẹn hò web-first dành cho người trưởng thành tại Việt Nam, phát triển theo hướng **người thật, văn minh, an toàn và có tiêu chuẩn**. Product tham chiếu mô hình database/search-first, Interests, Messages và Premium/Diamond của Seeking.com, đồng thời được điều chỉnh cho ngôn ngữ, hành vi người dùng, xác thực, thanh toán và yêu cầu riêng tư tại Việt Nam.

> **Chọn Đúng Người, Yêu Đúng Gu**

SEO title chuẩn:

`Chon.Love | Chọn đúng người, Yêu đúng Gu`

SEO description chuẩn:

`Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm.`

## Source of truth

- Repository: `jackphi2023/Chon.Love`
- Production branch: `main`
- Supabase project: `asnydvqsduonyidjyyzq`
- Luôn fetch lại `main` và ghi nhận exact HEAD SHA trước khi sửa code, test hoặc deploy.
- Không bắt đầu implementation song song khi chức năng đã tồn tại trong codebase hiện tại.

Dự án kế thừa lịch sử kỹ thuật từ MyFan → Luxy.Love → Chon.Love. Các identifier nội bộ như `@myfan/*`, `myfan-*`, một số `luxy*`, schema, migration hoặc bảng legacy **có thể được giữ lại** khi đổi tên có nguy cơ gây regression. Product-facing, metadata và UI dành cho người dùng phải thống nhất là **Chon.Love**.

## Product scope — Web V1

Web V1 ưu tiên một sản phẩm responsive cho:

- Desktop browser.
- Mobile Safari trên iOS.
- Mobile Chrome trên Android.

Native iOS/Android, EAS và PWA nâng cao là roadmap sau khi Web V1 ổn định.

Core product:

- Search/Browse members.
- Advanced filters và location/distance.
- Interests/Favorites.
- Messages.
- Member Profile và Edit Profile.
- Premium / Diamond.
- Verification.
- Private photos.
- Safety / Block / Report / Moderation.

**Activity/Creator feed không thuộc Chon.Love Web V1.** Không đưa lại creator/social-feed model của MyFan vào navigation hoặc dating flow chỉ để tận dụng code legacy.

## Product rules quan trọng

### Access và onboarding

- Guest không được browse danh sách thành viên.
- Người dùng phải đủ 18 tuổi và hoàn thành các bước Terms, Community Standards, profile/media và verification theo flow hiện hành.
- Existing account phải tiếp tục đăng nhập được bằng email/password.
- Không tự cập nhật hoặc giả mạo consent/policy acceptance của người dùng cũ.

### Search và profile

- Search ưu tiên database/search-first thay vì swipe-first.
- Hồ sơ công khai chỉ chứa safe projection; không expose Auth UUID, DOB, email, phone, KYC, storage path, tọa độ chính xác hoặc ảnh riêng tư.
- Public SEO profile dùng mã public riêng, không dùng UUID làm URL công khai.

### Favorites, messaging và membership

- Free member có thể browse/search cơ bản và Favorite theo entitlement hiện hành.
- Messaging, advanced functionality và private-photo request/view tuân theo entitlement Free / Premium / Diamond.
- Messaging theo dating model; không khôi phục friendship làm prerequisite nếu contract hiện tại đã bỏ dependency này.

### Private photos

Private photo không được unlock bằng gift/payment.

Flow chuẩn:

`request access → owner approve / decline → viewer được xem theo quyền backend`

Owner approval và RLS/backend authorization là bắt buộc; không chỉ khóa ở UI.

### Verification và safety

- Selfie live camera hỗ trợ desktop/mobile browser.
- Automatic verification failure chuyển sang review phù hợp; không tự khóa vĩnh viễn chỉ vì face match fail.
- Block/report/moderation/account status/discovery visibility phải được enforce backend.
- Không nới RLS, ACL hoặc SECURITY DEFINER contract để làm UI test pass.

## Monorepo architecture

```text
apps/
├── public-web/   # Next.js: marketing, SEO, legal, public member profile
├── mobile/       # Expo Router: authenticated Chon.Love product, Web V1 dưới /app
└── admin/        # Next.js: moderation, verification, membership/payment, operations

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

### Runtime routing

Production Web V1 dùng cùng origin cho public site và authenticated member app:

```text
/                    → Next.js public/SEO site
/app/auth            → signup
/app/auth?mode=login → login
/app/...              → authenticated Expo Web app
/admin/login          → Admin login theo deployment/admin routing hiện hành
```

Authenticated Expo Web được build dưới base path `/app` và đưa vào combined Netlify release.

## Development principles

1. **Patch nhỏ, test được, backward compatible.** Không rewrite toàn bộ chỉ để đổi brand hoặc style.
2. **Seeking.com là product/UX reference, không phải branding/content source.** Giữ information architecture và conversion logic phù hợp, Việt hóa ngôn ngữ, safety, payment và verification.
3. **Tách presentation khỏi domain/data layer.** Business rules, entitlement, Supabase access và validation phải reusable cho native sau này.
4. **Không hard-code secrets.** `service_role`, OAuth client secret, encryption key và credential server-side không được vào frontend hoặc Git.
5. **Privacy by design.** Private photos/KYC/private identity/private location không được biến thành public URL vì tiện test.
6. **Không broad rename technical legacy.** Chỉ đổi identifier khi có migration plan và test chứng minh an toàn.
7. **UI mới phải responsive ngay từ đầu** cho desktop và mobile browser.

## Local development

Yêu cầu hiện tại theo root `package.json`/Netlify config:

- Node `>=22.13.0` (Netlify hiện pin Node 22.x).
- pnpm `10.15.1` / `>=10.15.0 <11`.
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

Chạy full source/release validation:

```bash
pnpm validate
```

Các gate hiện hữu gồm:

```text
validate:security
validate:integration
validate:auth
validate:social-e2e
validate:creator-e2e
validate:browser-e2e
validate:vietqr-reconciliation
validate:kyc-withdrawal-operations
validate:runtime-quality
validate:netlify-release
validate:branding
```

Một số validator có tên lịch sử (`creator`, `luxy`, `myfan`, `BR-*`, `LX-*`) vì chúng khóa regression kỹ thuật đã tồn tại. Không đổi tên/xóa chúng chỉ vì branding nếu chưa kiểm tra dependency CI.

## Netlify — Chon.Love combined build

Build chuẩn của Web V1:

```bash
corepack enable && pnpm build:netlify:chon
```

Cấu trúc chính:

- Package directory trên Netlify: `apps/public-web`.
- Publish directory: `apps/public-web/.next`.
- Expo authenticated app được build trước và host dưới `/app`.
- Public Web cần Next.js Runtime/OpenNext; không quay lại static homepage-only deploy.
- Không hard-code Netlify preview hostname; auth phải hoạt động same-origin.

## Environment và secrets

Public/browser variables chỉ được chứa dữ liệu an toàn cho client, ví dụ Supabase URL và publishable/anon key theo contract hiện tại.

Không đưa các giá trị sau vào client bundle hoặc repository:

- `SUPABASE_SERVICE_ROLE_KEY`
- OAuth client secret
- PII encryption key
- KYC/provider private credential
- Admin private secrets

## Release gate

Sau mỗi thay đổi liên quan product/runtime:

1. Fetch `main` mới nhất và kiểm tra diff.
2. Chạy lint + typecheck + unit tests.
3. Chạy build và validator liên quan.
4. Với thay đổi UI/auth/data flow: chạy browser E2E/smoke tương ứng.
5. Với database: migration forward-only, generated types và RLS/security tests phải khớp.
6. Chỉ merge về `main` khi gate liên quan xanh.
7. Không tuyên bố production/live nếu chưa smoke-test **exact deployed SHA** trên Netlify.

## Ưu tiên phát triển tiếp

Thứ tự mặc định cho các phiên tiếp theo:

1. Test online Netlify: `/`, `/app/auth`, `/app/auth?mode=login`.
2. Auth/session: existing email/password và Gmail OAuth khi provider được cấu hình đầy đủ.
3. Onboarding + policy re-accept cho user cần cập nhật consent.
4. Search → Member Profile → Favorite → Message.
5. Free vs Premium/Diamond entitlement.
6. Private photo request/approve/decline.
7. Profile edit + upload media.
8. Live selfie camera và pending verification/Admin review.
9. Desktop/mobile Seeking-style UI polish.
10. Chỉ sau khi core Web V1 ổn định mới mở rộng các feature mới.

## Documentation policy

Các thư mục `docs/phase-*`, `docs/br-*` và `docs/luxy-seeking-ui` là **historical implementation/audit records**. Chúng có thể chứa tên MyFan/Luxy hoặc product assumptions cũ và không phải product source of truth hiện tại.

**README này + code trên `main` là baseline để tiếp tục test, debug, tối ưu UI và phát triển Chon.Love Web V1.** Khi README và code mâu thuẫn, hãy kiểm tra implementation thực tế và cập nhật README trong cùng change set thay vì tiếp tục dựa vào tài liệu lịch sử.
