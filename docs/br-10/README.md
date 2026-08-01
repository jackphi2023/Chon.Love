# BR-10 — Netlify Mobile Web Beta

## Mục tiêu

Chuẩn bị một đầu source có thể merge vào `main` và deploy ứng dụng Expo Mobile Web lên Netlify mà không gắn custom domain.

## Source anchor

- BR-09 validated head: `440a68936b2a78ac06e0fb56c672859f794bc912`
- BR-10 branch: `agent/br-10-netlify-mobile-web-beta`
- Production branch sau khi được duyệt: `main`

## Thay đổi release

- Chuyển Expo Web từ static multi-page export sang `single` SPA để các route động như profile, chat và Activity hoạt động khi refresh trực tiếp.
- Thêm `apps/mobile/public/_redirects` để Netlify rewrite mọi route về `/index.html` với HTTP 200.
- Giữ build từ repository root bằng pnpm workspace và publish `apps/mobile/dist`.
- Khóa Google Play Billing, gửi quà, Creator Wallet, KYC và withdrawal ở trạng thái `false` cho Mobile Web Beta.
- Thêm baseline security headers.
- Không commit Supabase publishable key; khóa được cấu hình trong Netlify UI.
- Không đưa service-role key hoặc PII encryption key vào frontend hosting.

## Phạm vi không bao gồm

- Không gắn custom domain.
- Không deploy Admin hoặc Public Web trong BR-10.
- Không deploy Google Play Billing hoặc native Android/iOS.
- Không bật giao dịch quà, KYC hoặc withdrawal.
- Không tự động settlement VietQR.
- Không thay đổi schema hoặc dữ liệu Supabase.

## Release gate

BR-10 chỉ được merge khi Application CI pass trên head của PR. Sau merge, Netlify phải build từ `main`, smoke test URL `.netlify.app` và thực hiện rollback drill trước BR-11 và BR-12.
