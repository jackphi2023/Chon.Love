# BR-10 Netlify Mobile Web Runbook

## 1. Tạo hoặc kết nối site

1. Đăng nhập Netlify.
2. Chọn **Add new project** → **Import an existing project**.
3. Chọn GitHub và cấp quyền cho repository cần thiết.
4. Chọn repository `jackphi2023/myfan`.
5. Khi Netlify phát hiện monorepo, chọn ứng dụng `apps/mobile` nếu có màn hình lựa chọn site/app.
6. Chưa thêm custom domain trong BR-10; giữ hostname do Netlify cấp.

## 2. Build settings chính xác

Trong **Project configuration → Build & deploy → Continuous deployment → Build settings** đặt:

```text
Production branch: main
Base directory: [để trống]
Package directory: apps/mobile
Build command: [để trống]
Publish directory: apps/mobile/dist
Functions directory: [để trống]
```

`apps/mobile/netlify.toml` là source of truth và đã khai báo build command chính thức:

```text
pnpm --filter @myfan/mobile build:web
```

Nếu Netlify hiển thị:

```text
Overridden by netlify.toml
```

đây không phải lỗi build. Thông báo chỉ cho biết giá trị trong Netlify UI bị file trong repository ghi đè. Hãy xóa Build command cũ trong UI và để trống để tránh gây nhầm lẫn.

Lý do giữ Base directory trống: pnpm workspace và lockfile nằm ở repository root. Package directory chỉ giúp Netlify nhận diện app Mobile; publish path vẫn tính từ repository root.

Repository đã pin:

```text
Node.js: 22.23.1
pnpm: 10.15.1
```

`apps/mobile/netlify.toml` quản lý build command, publish directory, deploy contexts, financial feature flags và security headers.

## 3. Environment variables

Mở **Project configuration → Environment variables**.

Tạo biến:

```text
Key: EXPO_PUBLIC_SUPABASE_ANON_KEY
Value: Supabase publishable key đang active của project asnydvqsduonyidjyyzq
Scopes/contexts: Production, Deploy Previews và Branch deploys
```

Khuyến nghị dùng modern publishable key có tiền tố `sb_publishable_`, không dùng service-role key.

Google Auth mặc định fail closed:

```text
EXPO_PUBLIC_FEATURE_GOOGLE_AUTH=false
```

Chỉ đổi thành `true` sau khi đã hoàn tất cả Google Cloud và Supabase Provider theo mục 6.

Các biến sau đã được khai báo an toàn trong `netlify.toml` và không cần nhập lại nếu Netlify đọc đúng file:

```text
EXPO_PUBLIC_MYFAN_ENV
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_FEATURE_GOOGLE_PLAY_BILLING=false
EXPO_PUBLIC_FEATURE_SEND_GIFT=false
EXPO_PUBLIC_FEATURE_CREATOR_WALLET=false
EXPO_PUBLIC_FEATURE_CREATOR_KYC=false
EXPO_PUBLIC_FEATURE_WITHDRAWAL=false
```

Tuyệt đối không tạo trên site frontend:

```text
SUPABASE_SERVICE_ROLE_KEY
MYFAN_PII_ENCRYPTION_KEY_B64
Google OAuth client secret
Google Play service-account credential
Bank webhook secret
```

Sau khi thêm hoặc sửa environment variable, chạy một deploy mới vì Expo nhúng các biến `EXPO_PUBLIC_*` trong lúc build.

## 4. Deploy đầu tiên

1. Chọn **Deploys**.
2. Chọn **Trigger deploy** → **Clear cache and deploy site** sau khi sửa build settings hoặc environment variables.
3. Mở deploy log và xác nhận các bước:
   - checkout đúng commit `main`;
   - Node 22.23.1 và pnpm 10.15.1 khởi tạo thành công;
   - workspace dependencies cài bằng lockfile;
   - `@myfan/mobile build:web` hoàn thành;
   - publish directory là `apps/mobile/dist`;
   - file `_redirects` xuất hiện trong deploy output.
4. Chỉ đánh dấu deploy thành công khi trạng thái là **Published**.

## 5. Supabase Auth URL configuration

Mở Supabase project `asnydvqsduonyidjyyzq` → **Authentication → URL Configuration**.

Đặt:

```text
Site URL:
https://myfanlove.netlify.app
```

Thêm Redirect URLs:

```text
https://myfanlove.netlify.app/auth/callback
https://myfanlove.netlify.app/auth/callback/**
https://**--myfanlove.netlify.app/auth/callback
https://**--myfanlove.netlify.app/auth/callback/**
```

Có thể giữ local development entries nếu vẫn cần:

```text
http://localhost:8081/**
http://localhost:3000/**
```

Production nên dùng exact hostname/path; wildcard chỉ dành cho Deploy Preview.

## 6. Bật đăng nhập Google

Lỗi:

```text
Unsupported provider: provider is not enabled
```

có nghĩa Google Provider chưa được bật trong Supabase. Không thể sửa lỗi này chỉ bằng deploy Netlify.

### Google Cloud

1. Mở Google Cloud Console → Google Auth Platform / APIs & Services.
2. Tạo OAuth Client ID loại **Web application**.
3. Thêm Authorized JavaScript origin:

```text
https://myfanlove.netlify.app
```

4. Thêm Authorized redirect URI:

```text
https://asnydvqsduonyidjyyzq.supabase.co/auth/v1/callback
```

5. Sao chép Client ID và Client Secret.

### Supabase

1. Mở **Authentication → Sign In / Providers → Google**.
2. Bật Google Provider.
3. Dán Client ID và Client Secret từ Google Cloud.
4. Chọn Save.

Google OAuth luôn callback về Supabase Auth:

```text
https://asnydvqsduonyidjyyzq.supabase.co/auth/v1/callback
```

Không thay callback Google Cloud thành URL Netlify. Supabase xử lý Google trước, sau đó mới chuyển người dùng về:

```text
https://myfanlove.netlify.app/auth/callback
```

### Mở nút Google trên Netlify

Sau khi provider đã lưu thành công, tạo hoặc sửa biến:

```text
Key: EXPO_PUBLIC_FEATURE_GOOGLE_AUTH
Value: true
Scope: Builds
Contexts: Production, Deploy Previews, Branch deploys
```

Sau đó chạy **Clear cache and deploy site**.

## 7. Smoke test theo thứ tự

### Homepage và route fallback

1. Mở `/` ở cửa sổ ẩn danh.
2. Xác nhận `/` hiển thị homepage MyFan, không tự chuyển sang Login.
3. Chọn **Đăng nhập** hoặc **Tham gia MyFan** để mở trang Auth.
4. Mở trực tiếp rồi refresh:

```text
/auth/callback
/auth/forgot-password
/auth/reset-password
/profile/myfan1
/activity/myfan1
```

Các route có thể hiển thị Auth/guard state, nhưng không được trả Netlify 404.

### Auth

1. Đăng nhập bằng một tài khoản Beta email/password.
2. Refresh trang sau đăng nhập; session phải được giữ.
3. Mở tab mới cùng hostname; session phải đồng bộ.
4. Đăng xuất global; các tab khác phải mất quyền sau khi refresh hoặc auth event.
5. Kiểm tra quên mật khẩu bằng tài khoản thường, không dùng dải tài khoản Beta được quản lý.
6. Chỉ test Google sau khi Supabase provider, Google OAuth client, redirect allowlist và `EXPO_PUBLIC_FEATURE_GOOGLE_AUTH=true` đã đúng.

### Core Social

1. Discovery tải danh sách.
2. Mở profile Creator.
3. Kiểm tra Activity và album theo quyền.
4. Gửi/chấp nhận lời mời bằng hai tài khoản test.
5. Mở chat sau khi friendship accepted.
6. Gửi tin nhắn và kiểm tra realtime.
7. Refresh trực tiếp URL chat; không 404.
8. Block/report và xác nhận access bị đóng đúng contract.

### Financial safety

Xác nhận UI hoặc hành động sau không thể thực thi:

```text
Google Play Billing
Send gift
Creator wallet execution
KYC submission
Withdrawal request
Automatic VietQR settlement
```

## 8. Responsive và browser matrix

Dùng DevTools hoặc thiết bị thật:

```text
360 × 800
390 × 844
430 × 932
768 × 1024
1024 × 768
1440 × 900
```

Kiểm tra tối thiểu:

```text
Chrome desktop
Chrome Android
Safari iOS
Safari macOS nếu có
```

Kiểm tra focus, keyboard, touch target, loading/error/retry, mạng chậm, reconnect và không có horizontal overflow.

## 9. Deploy Preview

Khi tạo PR sau BR-10:

1. Netlify tạo URL dạng `https://<deploy-id>--<site-name>.netlify.app`.
2. Xác nhận Redirect URL wildcard trong Supabase đã cho phép callback.
3. Không dùng Deploy Preview cho dữ liệu production thật ngoài phạm vi Beta đã chấp thuận.
4. Không bật financial flags trong Deploy Preview.

## 10. Rollback drill

1. Mở **Deploys**.
2. Chọn một deploy production đã thành công trước đó.
3. Chọn **Publish deploy** hoặc thao tác rollback tương đương trong UI.
4. Kiểm tra lại `/`, Auth và một route động.
5. Sau khi xác minh rollback, publish lại deploy BR-10 hiện tại.
6. Ghi lại deploy ID, commit SHA, thời điểm và người thực hiện.

BR-10 không có database migration mới, nên rollback hosting không cần rollback Supabase schema.

## 11. Điều kiện dừng trước BR-11–12

Không bắt đầu BR-11 hoặc BR-12 khi còn một trong các lỗi:

- Netlify production deploy chưa Published.
- Route refresh trả 404.
- Supabase Auth redirect về localhost hoặc hostname sai.
- Email/password login hoặc session restore lỗi.
- Google button được bật khi provider chưa cấu hình.
- Financial flag vô tình bật.
- Mobile layout lỗi nghiêm trọng ở 360–430 px.
- Chưa thực hiện rollback drill.
