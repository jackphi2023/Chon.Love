# Chon.Love — Netlify Production Runbook

## 1. Một production source of truth

Repository:

```text
jackphi2023/Chon.Love
```

Branch:

```text
main
```

Netlify config:

```text
/netlify.toml
```

Production app:

```text
apps/mobile
```

Build:

```text
corepack enable && pnpm --filter @myfan/mobile build:web
```

Publish:

```text
apps/mobile/dist
```

`@myfan/mobile` là technical package name lịch sử; user-facing product là Chon.Love.

`apps/public-web` **không phải production target**. Netlify config trong thư mục này fail-closed để tránh public-web/combined build cũ quay lại route `/`.

## 2. Netlify UI settings

Trong **Project configuration → Build & deploy → Build settings**:

```text
Production branch: main
Base directory: [repository root / để trống]
Package directory: [để trống]
Build command: [để netlify.toml quản lý]
Publish directory: [để netlify.toml quản lý]
Functions directory: [để trống]
```

Nếu UI còn override từ MyFan/Luxy, xóa các giá trị như:

```text
Package directory: apps/mobile
Package directory: apps/public-web
Build: pnpm build:netlify:chon
Publish: apps/public-web/.next
```

Trạng thái mong muốn là Netlify đọc root `netlify.toml` và log đúng `@myfan/mobile build:web`.

## 3. Environment variables

Repository chỉ hard-code production Supabase URL trong `context.production`:

```text
EXPO_PUBLIC_SUPABASE_URL=https://asnydvqsduonyidjyyzq.supabase.co
```

Publishable/anon key phải cấu hình trong Netlify UI:

```text
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

Không commit:

```text
SUPABASE_SERVICE_ROLE_KEY
MYFAN_PII_ENCRYPTION_KEY_B64
OAuth client secret
Google Play service-account credential
bank/webhook secrets
```

## 4. Preview/staging không dùng production DB mặc định

`deploy-preview`, `branch-deploy`, `develop` và `release/staging` không hard-code project production.

Khi cần preview có backend, cấu hình riêng theo Netlify context:

```text
EXPO_PUBLIC_SUPABASE_URL=<preview/staging project>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<matching publishable key>
```

Nếu chưa có preview database, để build/runtime fail closed. Không trỏ preview vào production chỉ để Deploy Preview chạy được.

## 5. Feature flags Web V1

Giữ fail-closed cho tới khi module vận hành tương ứng được release:

```text
EXPO_PUBLIC_FEATURE_GOOGLE_PLAY_BILLING=false
EXPO_PUBLIC_FEATURE_SEND_GIFT=false
EXPO_PUBLIC_FEATURE_CREATOR_WALLET=false
EXPO_PUBLIC_FEATURE_CREATOR_KYC=false
EXPO_PUBLIC_FEATURE_WITHDRAWAL=false
```

## 6. Deploy production

Sau merge `main`:

1. Xác nhận Netlify checkout exact SHA mới nhất của `main`.
2. Build log phải hiển thị:
   `corepack enable && pnpm --filter @myfan/mobile build:web`.
3. Publish phải là `apps/mobile/dist`.
4. Build output phải có `_redirects` SPA fallback.
5. Nếu site còn asset cũ, dùng **Clear cache and deploy site**.
6. Chỉ coi release hoàn tất khi exact SHA đã **Published** và smoke test pass.

## 7. Smoke test bắt buộc

Public `/`:

- Chon.Love branding.
- `Chọn đúng Người, Yêu đúng Gu`.
- hero desktop/mobile đúng phiên bản hiện hành.
- CTA signup/login.
- legal/footer không còn MyFan/Luxy copy.

Existing-user flow:

- login email/password;
- refresh giữ session;
- user đã xác thực tuổi không bị buộc đổi DOB khi re-accept policy;
- Search/Kết nối;
- Yêu thích;
- Member Profile;
- Tin nhắn;
- Settings/Membership;
- Verification.

Entitlement:

- Free không gửi message khi contract khóa.
- Premium/Diamond đúng entitlement.
- Free không nhận private-photo storage path.
- Premium/Diamond xem private photos theo backend entitlement hiện tại.

Responsive:

```text
390 × 844
430 × 932
768 × 1024
1024 × 768
1280 × 900
1440 × 1000
```

Không horizontal overflow.

## 8. Khi thấy homepage MyFan/Luxy cũ

Không sửa UI trước.

Kiểm tra theo thứ tự:

1. Netlify repository có đúng `jackphi2023/Chon.Love` không.
2. Production branch có phải `main` không.
3. Base directory có phải repository root không.
4. Package directory có đang override sang `apps/public-web` không.
5. Build command có đúng `@myfan/mobile build:web` không.
6. Publish có đúng `apps/mobile/dist` không.
7. Exact deployed commit có đúng SHA trên `main` không.

Nếu bất kỳ mục nào sai, sửa deploy configuration trước khi đụng product code.

## 9. Rollback

Rollback frontend bằng Netlify deploy trước đó chỉ khi database migration mới vẫn backward compatible.

Database production không rollback bằng reset/truncate. Mọi schema correction phải là forward-only migration hoặc migration đảo ngược được review riêng.
