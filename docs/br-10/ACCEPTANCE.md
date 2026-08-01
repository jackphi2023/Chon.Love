# BR-10 Acceptance Criteria

## Source và CI

- [ ] BR-09 Application, Database và Browser E2E đều pass trên validated head.
- [ ] Mobile Web dùng Expo Web output `single`.
- [ ] `apps/mobile/public/_redirects` chứa SPA fallback `/* /index.html 200`.
- [ ] Netlify build từ repository root và publish `apps/mobile/dist`.
- [ ] Node `22.13.0` và pnpm `10.15.1` được pin.
- [ ] Không có service-role key, PII encryption key hoặc Supabase publishable key trong repository.
- [ ] Tất cả financial execution flags vẫn `false`.
- [ ] BR-10 validator, lint, TypeScript, unit tests và web build pass.

## GitHub

- [ ] BR-10 PR target `main` và head đúng branch release.
- [ ] Head SHA không thay đổi sau khi CI pass.
- [ ] PR mergeable và merge vào `main` bằng merge commit.
- [ ] GitHub Actions trên merge commit pass.

## Netlify

- [ ] Site kết nối đúng repository `jackphi2023/myfan`.
- [ ] Production branch là `main`.
- [ ] Base directory để trống.
- [ ] Package directory là `apps/mobile`.
- [ ] Build command và publish directory khớp `apps/mobile/netlify.toml`.
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` được đặt bằng Supabase publishable key trong Netlify UI.
- [ ] Deploy log không chứa secret và build thành công.
- [ ] Production URL `.netlify.app` trả HTTP 200.
- [ ] Refresh trực tiếp route động không trả 404.

## Supabase Auth

- [ ] Site URL trỏ tới production `.netlify.app` URL.
- [ ] Redirect allowlist chứa exact production callback.
- [ ] Redirect allowlist chứa Netlify Deploy Preview callback wildcard khi preview được bật.
- [ ] Email/password login, session refresh, global logout và password reset callback được smoke test.
- [ ] Google OAuth chỉ được đánh dấu pass sau khi provider và redirect configuration được kiểm tra.

## Smoke test

- [ ] `/` tải không lỗi.
- [ ] `/auth/callback` tải khi refresh trực tiếp.
- [ ] `/auth/forgot-password` và `/auth/reset-password` tải khi refresh trực tiếp.
- [ ] Đăng nhập bằng tài khoản Beta thành công.
- [ ] Discovery, profile, Activity, friends và chat tải sau đăng nhập.
- [ ] Route `/profile/<username>` và `/chat/<conversation-id>` không 404 khi refresh.
- [ ] Logout đưa về Auth và route riêng tư không còn truy cập được.
- [ ] Viewport 360, 390, 430, 768, 1024 và 1440 px được kiểm tra.
- [ ] Chrome Android và Safari iOS được kiểm tra thủ công.
- [ ] Không có thao tác tài chính nào được bật.

## Rollback

- [ ] Một deploy production trước đó có thể được chọn và publish lại.
- [ ] Sau rollback, URL, Auth và route fallback vẫn hoạt động.
- [ ] Không có database rollback trong BR-10 vì BR-10 không thay đổi schema.
