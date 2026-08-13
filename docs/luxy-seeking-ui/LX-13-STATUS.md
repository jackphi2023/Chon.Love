# LX-13 — Clone Member Profile Seeking → Luxy.Love

**Status:** COMPLETED  
**Repository:** `jackphi2023/Luxy.Love`  
**Branch:** `agent/luxy-seeking-ui-foundation`  
**LX-13 base:** `cb819e513d976d44b8baa81c1150d93e89ddf015`  
**Final implementation head:** `48239435fea5079e98a5f3452a2e4e61d0f2007f`

## 1. Kết quả triển khai

LX-13 đã thay Member Profile legacy bằng presentation hierarchy theo Seeking reference, nhưng giữ Luxy.Love branding, tiếng Việt và các boundary backend hiện có.

### Desktop

- Bố cục hai cột giống Seeking: ảnh chính/facts ở trái, identity/message/photos/story ở phải.
- Tên + tuổi, khu vực, headline, trạng thái hoạt động và các thuộc tính hồ sơ Luxy từ schema LX-07.
- Composer nhắn tin ở phần đầu hồ sơ.
- Public photo grid, khu vực ảnh riêng tư dạng locked presentation card.
- `Về tôi`, `Tôi đang tìm kiếm`, lifestyle tags và các thuộc tính lifestyle/career.
- Favorite tiếp tục dùng LX-12, không tạo một hệ favorite khác.

### Mobile

- Cùng information hierarchy nhưng chuyển thành một cột.
- Hero portrait, Favorite, Message CTA và badge vẫn có touch target phù hợp.
- Không có horizontal overflow tại viewport 390px trong Browser E2E.

## 2. Premium / Diamond badge

Đã thêm presentation membership contract do server kiểm soát:

- `public.luxy_membership_tier`: `free | premium | diamond`.
- `private.luxy_memberships` lưu server-side membership snapshot.
- `public.get_my_luxy_membership_snapshot()` chỉ trả snapshot của chính người dùng.
- Member Profile chỉ hiện badge khi hồ sơ là **nam** và có active paid tier `premium` hoặc `diamond`.
- Client không được tự cấp badge và không có quyền đọc trực tiếp bảng membership private.

Migration:

- `supabase/migrations/20260812094000_lx_13_member_profile_membership_presentation.sql`
- `supabase/migrations/20260812101500_lx_13_paid_male_badge_presentation.sql`

## 3. Photo viewer

Đã thêm `LuxyProfilePhotoModal`:

- Click ảnh chính hoặc ảnh hồ sơ mở ảnh lớn.
- Có Favorite ngay trong photo viewer.
- Có input nhắn tin và CTA `Nhắn tin cho <member>` ngay trong popup.
- Public profile media vẫn dùng signed URL/private storage contract hiện tại.
- Private photo binary/path không bị lộ qua read model; LX-13 chỉ hiển thị count/locked presentation.

## 4. Message upgrade gate

Khi người dùng chưa có messaging entitlement:

1. Bấm `Nhắn tin` ở profile hoặc photo popup.
2. Hiện modal `Bắt đầu nhắn tin ngay!`.
3. Hiển thị ngắn các quyền lợi: nhắn tin không giới hạn, huy hiệu thành viên trả phí, tìm kiếm nâng cao, ưu tiên.
4. CTA `Nâng cấp Premium` tạo **upgrade intent** server-side.
5. Điều hướng sang cấu trúc Membership/Upgrade hiện có.

`public.create_luxy_upgrade_intent(...)` chỉ ghi nhận ý định nâng cấp. Nó **không charge tiền, không kích hoạt membership và không tự cấp entitlement**.

## 5. Privacy / security boundary

`public.get_luxy_member_profile(username)` chỉ trả read model cần cho Member Profile:

- tuổi đã tính từ DOB,
- tỉnh/thành,
- public dating/profile fields,
- public/private photo counts,
- membership tier/badge signal.

Không trả:

- date of birth,
- latitude/longitude chính xác,
- CCCD/KYC,
- bank data,
- financial ledger.

Private membership tables không cấp table access cho `authenticated`/`anon`; client chỉ đi qua RPC được giới hạn.

## 6. Boundary với các phiên sau

LX-13 cố ý **không** kéo các phiên sau vào scope:

- **LX-14:** request / approve / decline ảnh riêng tư thật; quà không unlock ảnh riêng tư.
- **LX-15:** final direct messaging entitlement, bao gồm bỏ friendship prerequisite cho Premium/Diamond.
- **LX-17:** membership engine authoritative, activation/expiry/priority entitlements.
- **LX-18:** actual billing/payment/checkout.

Do đó LX-13 không giả lập thanh toán thành công và không cấp membership từ client.

## 7. Regression compatibility

Đã giữ các social/safety contract cũ để không phá regression trước khi LX-15 migration messaging hoàn tất:

- friendship request / accept / cancel,
- chat route hiện có khi conversation đã tồn tại,
- block / unblock / report,
- Creator Activity privacy regression.

Các browser tests cũ đã được cập nhật selector đúng với title `Tên, tuổi`, composer mới và retry state; không giảm assertions nghiệp vụ.

LX-12 Favorites regression cũng được cập nhật selector Member Profile mới, không thay business logic LX-12.

## 8. Test coverage

### Unit / shared client

- `packages/supabase/src/member-profile.test.ts`
- `packages/supabase/src/membership.test.ts`

Kiểm tra safe parsing, badge paid-male rule, malformed tier rejection, membership snapshot và upgrade intent validation.

### Database

- `supabase/tests/lx_13_member_profile_membership_presentation.sql`
- 23 pgTAP assertions cho ACL/RPC/privacy/read model/Free → upgrade intent/Premium-Diamond snapshot.
- LX-09 test signature được đồng bộ với extension Search của LX-12; assertions không bị nới lỏng.

### Browser

- `tests/br-06/luxy-member-profile.spec.mjs`
- Desktop 1280px: Seeking hierarchy, Diamond badge, hero photo viewer, Favorite, Message → Upgrade gate → membership handoff.
- Mobile 390px: responsive profile, Diamond badge, Message → Upgrade gate, no horizontal overflow.
- Existing BR-06 multi-account social/privacy lifecycle vẫn pass.
- Existing BR-09 accessibility/resilience suite vẫn pass.

## 9. Final validation

All final implementation gates passed on head `48239435fea5079e98a5f3452a2e4e61d0f2007f`:

- **Application CI:** run `31563268617` — `success`.
- **Database:** run `31563268667` — `success`.
- **Browser E2E:** run `31563268747` — `success`.

Browser E2E specifically passed both:

- `Run BR-06 mobile web browser E2E`
- `Run BR-09 accessibility and resilience E2E`

## 10. Diff boundary

LX-13 implementation includes Member Profile UI/components, membership/profile read-model clients, forward-only membership presentation migrations, generated public database types, database/browser tests and fixture extensions.

No `main` merge was performed.  
No production deployment was performed.  
No real billing/payment activation was enabled.
