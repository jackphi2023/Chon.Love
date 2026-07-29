# MyFan V1 — Screen Inventory V2

- **Document:** Phase A / Session 3
- **Status:** Approved screen and state inventory for V1 implementation
- **Last reviewed:** 2026-07-29
- **Depends on:** `01-product-positioning.md` and `02-business-rules.md`
- **Source UI:** `MyFan.dc.html` static prototype and attached screenshot; the prototype is design reference only, not production/WebView code
- **Machine-readable companion:** `docs/phase-a/screen-inventory.csv`

## 1. Session 1–2–3 consistency decision

| Foundation | Source of truth | Session 3 enforcement | Review result |
|---|---|---|---|
| Product positioning | Session 1: Social Creator, 18+, moderated UGC, friendship before chat, privacy by default | Every screen uses neutral Creator/Fan/supporter language; high-risk features are removed or Future-OFF | Consistent; no Session 1 edit required |
| Heart economy | Session 2: integer heart units, 70/30 split, separate balances, immutable ledgers, refund/withdrawal controls | Purchase, gift, earnings, refund and withdrawal screens are separated and show VNĐ only in approved purchase/withdrawal contexts | Consistent; no Session 2 edit required |
| UI scope | Session 3: official Mobile/Admin/Public Web inventory with permissions, moderation and states | Static prototype is mapped to official screens; missing safety, legal, billing and Admin screens are added | Complete for Phase A Sessions 1–3 |

**Decision:** Sessions 1, 2 and 3 are mutually consistent. Session 3 does not change the approved positioning or business rules; it translates them into implementable screens and explicit system states.

## 2. Inventory summary

- Total official screen/state records: **124**.
- V1 records: **113**.
- Future/OFF or prohibited records: **11**.
- Mobile-oriented records: **84**.
- Admin Web records: **29**.
- Public Web records: **11**.

Screen IDs are stable product identifiers. iOS and Android visual adaptations must not create duplicate business IDs; for example the prototype H1/H2/H3 Android frames map to the same official Discovery, Chat and balance screens.

## 3. Mandatory cross-screen rules

- **18+ gate:** Social, discovery, profile upload, gifting and chat routes are inaccessible until DOB, 18+ confirmation and required policy versions are accepted.
- **Friendship gate:** V1 realtime chat requires an accepted friendship. VIP/Thương gia cannot bypass this rule.
- **Moderated UGC:** Avatar, public photos and Fan Album media are non-public while `pending_review`; only approved media is returned to viewers.
- **Location privacy:** Other users never receive raw coordinates or exact pins. UI shows province/city and broad fuzzy distance bands only.
- **Virtual economy:** Social surfaces show ❤️ only. VNĐ or localized purchase price appears only on Nạp ❤️, purchase history/details, withdrawal and authorized Admin reconciliation.
- **Separate assets:** `Số dư ❤️` and `Thu nhập Creator` are separate screens and data sources. Purchased hearts cannot be withdrawn.
- **Safety access:** Profile, media and chat contexts expose report and block. Settings exposes blocked-user management and account deletion.
- **External payment removal:** VietQR/Google Pay substitute checkout does not appear in the Android V1 digital-goods flow.
- **Feature flags:** Stranger messaging, bulk messaging, exact map pins, video/live, automatic payout and unreviewed Fan content default OFF.

## 4. Prototype disposition

| Prototype ID | Prototype screen | Official V2 mapping | Required disposition |
|---|---|---|---|
| A1 | WELCOME | `M-AUTH-002` | Retain layout; replace anonymous/gift-economy positioning with Social Creator 18+. |
| A2 | ĐĂNG NHẬP | `M-AUTH-004` | Retain; add suspension/deletion and secure error states. |
| A3 | XÁC THỰC OTP | `M-AUTH-007` | Retain; add expiry, cooldown and attempt limits. |
| A4 | THIẾT LẬP HỒ SƠ | `M-PROF-001 / M-PROF-003` | Rebuild; no anonymous identity promise; moderated avatar; neutral roles. |
| A5 | CẤP QUYỀN VỊ TRÍ | `M-DISC-004 / M-DISC-005` | Retain with optional permission, province fallback and fuzzy distance. |
| B1 | KHÁM PHÁ GRID | `M-DISC-001 / M-DISC-003` | Rebuild cards; approved media only; no exact location. |
| B2 | BỘ LỌC | `M-DISC-002` | Remove “Kết hôn”; use safe Social/Creator/community filters. |
| B3 | CHỌN TỈNH/THÀNH | `M-DISC-007` | Retain with canonical areas and privacy-safe counts. |
| B4 | TÌM USERNAME | `M-DISC-008` | Retain; remove exact district exposure. |
| C1 | HỒ SƠ CHI TIẾT | `M-PROF-008` | Rebuild; ❤️ only; friendship before chat; report/block; safe Fan language. |
| C2 | ALBUM FAN KHÓA | `M-FAN-003` | Rebuild; no suggestive teaser; threshold-based safe access. |
| C4 | ĐIỀU KIỆN FAN | `M-FAN-002` | Replace required gifts and VNĐ with net eligible ❤️ progress. |
| D1 | DANH SÁCH HỘI THOẠI | `M-CHAT-001` | Retain; accepted friends only. |
| D2 | CHAT REALTIME | `M-CHAT-002 / M-CHAT-004` | Retain; gift message uses ❤️; add report/block and enforcement states. |
| D4 | LỜI MỜI KẾT BẠN | `M-FRND-002 / M-FRND-003` | Split received/sent states; add report/block and anti-spam. |
| E1 | CỬA HÀNG QUÀ | `M-HRT-008` | Replace VNĐ with canonical 20-gift ❤️ catalog. |
| E2 | XÁC NHẬN TẶNG | `M-HRT-009` | Use balance and total ❤️; remove payment/VietQR action. |
| E3 | THANH TOÁN VIETQR | `FUT-PAY-002 (OFF); replaced by M-HRT-002` | Remove from Android V1; use Google Play Billing top-up. |
| E4 | THANH TOÁN THÀNH CÔNG | `M-HRT-010` | Rename gift success; ❤️ only; threshold-based Fan result. |
| E5 | BẢNG XẾP HẠNG | `FUT-RANK-001 (OFF)` | Remove from V1 due money/compensated-dating risk. |
| F1 | TỔNG QUAN VÍ | `M-HRT-001 / M-CRT-006` | Split purchased hearts from Creator earnings; no common wallet. |
| F2 | QUÀ ĐÃ NHẬN | `M-HRT-013` | Change 60% to 70%; show gross ❤️ and reward status separately. |
| F3 | TÀI KHOẢN NHẬN KYC | `M-CRT-003 / M-CRT-005` | Split secure KYC and bank-account flows. |
| F4 | YÊU CẦU RÚT | `M-WDR-001` | Withdraw Creator earnings only; configurable minimum and manual review. |
| F5 | LỊCH SỬ RÚT | `M-WDR-002 / M-WDR-003` | Retain with full state timeline and detail. |
| G1 | HỒ SƠ CỦA TÔI | `M-PROF-007` | Retain structure; approved content and ❤️ terminology. |
| G3 | QUẢN LÝ ALBUM | `M-PROF-004 / M-PROF-005 / M-PROF-006` | Split public/Fan media and moderation status. |
| G4 | CÀI ĐẶT ĐIỀU KIỆN FAN | `M-FAN-001` | Replace specific gift checklist with bounded total ❤️ threshold. |
| G5 | HẠNG THÀNH VIÊN | `FUT-MEMBER-001 / FUT-MSG-001 / FUT-MSG-002` | Remove from V1; stranger and bulk messaging remain disabled. |
| G6 | CHIA SẺ HỒ SƠ | `M-PROF-007 / W-CREATOR-001` | Retain safe public share with approved fields only. |
| G7 | CÀI ĐẶT | `M-PROF-009 / M-SAFE-005 / M-SAFE-006` | Expand with deletion, blocked users, legal and safety controls. |
| H1 | ANDROID KHÁM PHÁ | `Same official Discovery screens` | Do not duplicate business screen IDs by OS; implement platform adaptations. |
| H2 | ANDROID CHAT | `Same official Chat screens` | Do not duplicate business screen IDs by OS; implement platform adaptations. |
| H3 | ANDROID VÍ | `M-HRT-001 / M-CRT-006` | Replace with separated balances; same domain model across platforms. |

## 5. Official screen inventory

The canonical row-level inventory is stored in `docs/phase-a/screen-inventory.csv`. It contains **124 records**, each with all required fields:

```text
screen_id
screen_name
platform
user_role
purpose
required_data
primary_actions
empty_state
loading_state
error_state
permission
moderation_requirement
release
change_vs_current_ui
```

The CSV is intentionally the source of truth for row-level review because a 124-row, 14-column Markdown table is difficult to review and error-prone to maintain. Screen IDs are grouped as follows:

| Prefix | Scope |
|---|---|
| `M-AUTH` | Mobile authentication, DOB, 18+ and legal onboarding |
| `M-PROF` | Mobile profile, avatar, public/Fan media and deletion |
| `M-DISC` | Province and fuzzy-distance discovery |
| `M-FRND` | Friendship requests and accepted friends |
| `M-CHAT` | Conversation list, realtime chat and gift events |
| `M-SAFE` | Report, block, unblock, blocked list and appeals |
| `M-HRT` | Heart balance, Play Billing, purchases, gifts and refunds |
| `M-CRT` | Creator application, terms, KYC, bank and earnings |
| `M-FAN` | Fan threshold, progress and Fan Album access |
| `M-WDR` | Creator withdrawal request, history and holds |
| `A-*` | Admin authentication, users, moderation, payments, KYC, withdrawal, audit and config |
| `W-*` | Public profile, legal, safety, support and deletion pages |
| `FUT-*` | Future/OFF or prohibited capabilities |

### 5.1 Required V1 coverage confirmed

- Mobile Auth: Splash, Welcome, Register, Login, Forgot/Reset Password, OTP, DOB, 18+, Terms/Privacy and Community Standards.
- Mobile Profile: create/edit, avatar, public photos, Fan photos, moderation status, own/other profile and account deletion.
- Discovery: province, safe filters, fuzzy nearby, location permission/fallback, empty results and username search.
- Friendship/Chat/Safety: requests received/sent, friends, chat list/realtime, locked chat, gift event, report, block/unblock and safety center.
- ❤️/Gifts: separate heart balance, Play Billing packages/states/history/refund, 20-gift catalog, confirmation/success/failure and sent/received history.
- Creator/Fan: Creator application/terms, KYC/status, bank, pending/available earnings, Fan threshold/progress, locked/unlocked Fan Album, withdrawal/history/detail and recovery holds.
- Admin: users, uploaded media, moderation, reports, blocks, gift catalog, Play purchases, gift transactions, refunds, KYC, withdrawals, deletion, appeals, child safety, audit and app configuration.
- Public Web: landing, public Creator profile, Privacy, Terms, Community Standards, Child Safety Standards, Creator Terms, deletion request/status, support and safety center.
- Future/OFF: stranger/bulk messaging, video/live, exact map pins, automatic payout, VietQR/Google Pay substitute checkout, unreviewed Fan content, money ranking and prototype VIP/Thương gia tiers.

## 6. Navigation and route groups

Recommended Mobile route ownership for the later Expo Router skeleton:

```text
(auth)        Splash, Welcome, Register, Login, Password, OTP
(onboarding)  DOB, 18+, Terms, Community Standards, profile setup, location education
(tabs)        Discovery, Friends/Chat, Gifts, Heart/Creator balances, My Profile
creator       Creator application, KYC, bank, earnings, Fan threshold, withdrawal
settings      Edit profile, moderation status, blocked users, safety, deletion
```

Admin modules are route-protected independently. Public legal/deletion routes must remain accessible without the mobile app.

## 7. Permission matrix summary

| Capability | Guest | Authenticated adult | Friend | Creator | Eligible Fan | Admin |
|---|---:|---:|---:|---:|---:|---:|
| Read public legal pages | Yes | Yes | Yes | Yes | Yes | Yes |
| Discovery/profile viewing | No | Yes | Yes | Yes | Yes | Role-dependent |
| Upload profile media | No | Own only | Own only | Own only | Own only | Moderation access only |
| Realtime chat | No | No unless friendship accepted | Yes | Yes when friend | Yes when friend | Case-context only |
| Purchase ❤️ | No | Own account | Own account | Own account | Own account | Reconcile only |
| Withdraw | No | No | No | Available Creator earnings after KYC/bank/holds | No | Review/pay by role |
| View Fan Album | No | No unless eligible | No unless eligible | Own management | Approved content only | Moderation access by role |
| Direct balance edit | No | No | No | No | No | **No; controlled ledger adjustment only** |

## 8. Moderation state requirements

```text
draft → pending_review → approved
                       → rejected → edited/resubmitted
approved → removed
any reviewable state → escalated/held when required
```

Viewer APIs must filter to `approved`; owner screens may show status metadata; Admin review uses private authorized access. Removal revokes access immediately, including signed Fan Album URLs.

## 9. QA state coverage

Every V1 data-driven screen must have tests or fixtures for: initial loading, success with data, empty, recoverable error, permission denied, blocked/suspended target where relevant, stale/realtime update where relevant, offline/retry behavior, and accessibility labels/focus order. Financial screens additionally require duplicate-command, pending verification, refund/revocation, hold and reconciliation-mismatch states.

## 10. Removed or deferred V1 capabilities

- VietQR and external digital-goods checkout in Android.
- VIP stranger messaging and Thương gia bulk messaging.
- Public ranking by VNĐ, spending or income.
- Exact user map pins.
- Video and livestream.
- Automatic Creator payout.
- Any Fan media visible before approval.
- Adult, sexually suggestive or gift-for-access content.

## 11. Acceptance criteria verification

- [x] The entire approved V1 scope has corresponding Mobile, Admin or Public Web screens/states.
- [x] Mobile, Admin Web and Public Web are classified explicitly.
- [x] Every record contains empty, loading and error behavior.
- [x] Every record has a stable Screen ID.
- [x] Every record contains permission and moderation requirements.
- [x] Future/OFF and prohibited capabilities are listed separately.
- [x] VietQR is removed from the Android V1 purchase flow.
- [x] VNĐ is restricted to purchase, withdrawal and authorized Admin contexts.
- [x] 18+, report/block, deletion, moderation states, Creator onboarding and KYC are present.
- [x] Bulk/stranger messaging is disabled in V1.
- [x] No exact location exposure exists.
- [x] Sessions 1, 2 and 3 have been reviewed for consistency.

## 12. Session 3 completion record

### Completed

- Audited the attached static HTML prototype containing 34 labeled mobile frames/variants.
- Defined 124 official screen/state records across Mobile, Admin Web, Public Web and Future/OFF scope.
- Mapped every prototype frame to retain, rebuild, replace or remove actions.
- Added all missing V1 safety, moderation, age, billing, refund, Creator, KYC, withdrawal, Admin and legal surfaces.
- Verified consistency with Session 1 positioning and Session 2 business rules.

### Files created

```text
docs/phase-a/03-screen-inventory-v2.md
docs/phase-a/screen-inventory.csv
```

### Validation performed

- Unique Screen ID check: passed.
- Required-field completeness check for all CSV rows: passed.
- Required prototype change checklist: passed.
- No source code, schema, Supabase data or deployment environment changed in Session 3.

---

**Decision:** The Screen Inventory V2 is the UI/UX scope source of truth for MyFan V1. Prototype elements that conflict with Sessions 1–2 must not be implemented, even if they remain visible in the historical static design file.
