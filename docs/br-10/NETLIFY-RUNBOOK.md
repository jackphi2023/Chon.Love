# Chon.Love — Netlify Web Production Runbook

## 1. Source of truth

Production web của Chon.Love dùng repository:

```text
jackphi2023/Chon.Love
```

và branch:

```text
main
```

`netlify.toml` tại **repository root** là source of truth khi Netlify dùng Base directory `/`.

Production phải build đúng ứng dụng responsive Expo Web đang chứa toàn bộ UI hiện hành:

```text
corepack enable && pnpm --filter @myfan/mobile build:web
```

và publish:

```text
apps/mobile/dist
```

`@myfan/mobile` là tên package kỹ thuật còn giữ để tránh refactor monorepo; user-facing product là Chon.Love.

Không chọn `apps/public-web` làm production package cho site Chon.Love chính. `apps/public-web` còn được giữ cho các bề mặt public/SEO tương thích, nhưng homepage sản phẩm hiện tại và authenticated UI có source of truth tại `apps/mobile`.

## 2. Netlify Build settings

Trong **Project configuration → Build & deploy → Continuous deployment → Build settings**:

```text
Production branch: main
Base directory: [để trống / repository root]
Package directory: [để trống]
Build command: [để trống nếu Netlify đọc root netlify.toml]
Publish directory: [để root netlify.toml quản lý]
Functions directory: [để trống nếu site này không cần override]
```

Root `netlify.toml` khai báo chính thức:

```text
Build command:
corepack enable && pnpm --filter @myfan/mobile build:web

Publish:
apps/mobile/dist
```

Nếu UI Netlify hiển thị **Overridden by netlify.toml**, đây là trạng thái mong muốn. Xóa các build command/package directory cũ trong Netlify UI để tránh nhầm lẫn.

Không đặt Package directory thành `apps/public-web` hoặc build command `pnpm build:netlify:chon` cho site production chính, vì điều đó có thể đưa một public-web shell cũ trở lại route `/`.

Repository pin:

```text
Node.js: 22.23.1
pnpm: 10.15.1
```

## 3. Environment variables

Trong Netlify Environment variables cần có publishable key Supabase:

```text
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Supabase publishable key>
```

Áp dụng cho Production và các context preview cần test.

Root `netlify.toml` đã đặt:

```text
EXPO_PUBLIC_MYFAN_ENV=production
EXPO_PUBLIC_SUPABASE_URL=https://asnydvqsduonyidjyyzq.supabase.co
```

Tên `EXPO_PUBLIC_MYFAN_ENV` là technical legacy và chưa đổi để tránh phá contract runtime.

Các financial/native flags vẫn fail closed trong Web V1:

```text
EXPO_PUBLIC_FEATURE_GOOGLE_PLAY_BILLING=false
EXPO_PUBLIC_FEATURE_SEND_GIFT=false
EXPO_PUBLIC_FEATURE_CREATOR_WALLET=false
EXPO_PUBLIC_FEATURE_CREATOR_KYC=false
EXPO_PUBLIC_FEATURE_WITHDRAWAL=false
```

Không bao giờ đưa vào frontend Netlify:

```text
SUPABASE_SERVICE_ROLE_KEY
MYFAN_PII_ENCRYPTION_KEY_B64
Google OAuth client secret
Google Play service-account credential
bank/webhook secrets
```

Sau khi sửa environment variable, chạy deploy mới vì `EXPO_PUBLIC_*` được đóng gói lúc build.

## 4. Deploy sau khi merge main

Sau khi release PR merge vào `main`:

1. Mở Netlify → **Deploys**.
2. Xác nhận Git integration checkout đúng commit mới nhất của `main`.
3. Nếu site vẫn hiện asset/homepage cũ, chọn **Trigger deploy → Clear cache and deploy site**.
4. Trong log phải thấy build command:

```text
corepack enable && pnpm --filter @myfan/mobile build:web
```

5. Publish directory phải là:

```text
apps/mobile/dist
```

6. Build output phải chứa `_redirects` với SPA fallback.
7. Chỉ coi deploy hoàn tất khi trạng thái Netlify là **Published**.

## 5. Homepage smoke test

Mở `/` ở cửa sổ ẩn danh và xác nhận homepage rebuilt hiện tại:

- header Chọn.love;
- hero video riêng desktop/mobile;
- slogan `Chọn đúng Người, Yêu đúng Gu`;
- CTA `Tham gia ngay`;
- section định vị `NỀN TẢNG HẸN HỌ THỰC CHẤT VÀ THÚ VỊ`;
- testimonials;
- Quyền lợi thành viên;
- Sứ mệnh;
- Văn hoá kết nối;
- footer/legal Chọn.love.

Nếu `/` vẫn hiện homepage static cũ hoặc UI MyFan/Luxy, dừng release và kiểm tra lại Base/Package directory/build command trước khi sửa product code.

## 6. Authenticated UI smoke test

Đăng nhập một tài khoản test và kiểm tra:

```text
Kết nối
Yêu thích
Tin nhắn
Nâng cấp
Hồ sơ
Quà
Số dư
Cài đặt
```

Kiểm tra thêm:

- navigation desktop/mobile dùng cùng brand Chọn.love;
- gold icons cho Kết nối / Yêu thích / Tin nhắn / Gift / Profile / Location / Recent Access;
- Free user có promo đen `Nâng cấp ngay để gửi tin nhắn`;
- mobile Kết nối dùng card ảnh HQ hai cột;
- Member Profile có Selfie / CCCD / LinkedIn badges theo server state;
- mobile Member Profile có dock `Tặng quà` + `Gửi tin nhắn`;
- Free Message CTA mở Membership;
- không có horizontal overflow.

## 7. Responsive matrix

Kiểm tra tối thiểu:

```text
390 × 844
430 × 932
768 × 1024
1024 × 768
1280 × 900
1440 × 1000
```

Browser ưu tiên:

```text
Chrome desktop
Chrome Android
Safari iOS
Safari macOS
```

## 8. Supabase Auth URL

Supabase project:

```text
asnydvqsduonyidjyyzq
```

`Authentication → URL Configuration` phải dùng hostname production thật của Chon.Love và callback `/auth/callback` tương ứng. Khi custom domain thay đổi, cập nhật Site URL và Redirect URLs trước khi bật production traffic.

Google Auth chỉ được bật khi Supabase Google Provider đã có OAuth Web Client ID/Secret hợp lệ. Không bật nút Google trước provider.

## 9. Rollback

Nếu deploy production có regression:

1. Netlify → Deploys.
2. Chọn deploy Published ổn định gần nhất.
3. Publish/Rollback deploy đó.
4. Smoke test `/`, login, Kết nối và một Member Profile.
5. Fix source trên branch mới; không chỉnh trực tiếp generated build output.

Hosting rollback không rollback Supabase schema. Nếu release có migration riêng, phải theo runbook migration tương ứng.

## 10. Release gate

Không coi production hoàn tất nếu còn một trong các điều kiện:

- GitHub CI/contract/Browser E2E đỏ;
- Netlify checkout không phải `main` mới nhất;
- build command không phải mobile web canonical command;
- homepage `/` không phải homepage rebuilt hiện tại;
- route refresh trả 404;
- auth redirect sai hostname;
- ảnh thành viên quay lại bản low-resolution;
- gold icon/navigation không đồng nhất desktop/mobile;
- layout lỗi nghiêm trọng ở 390–430 px.
