# LX-00 — Luxy.Love Seeking UI Fidelity Specification

**Trạng thái:** Source of truth cho UI migration Luxy.Love  
**Nguồn tham chiếu:** bộ `Seeking.zip` do Product Owner cung cấp ngày 11/08/2026  
**Base code:** `main` tại commit `dd66befc1807d5bddaa1dd92f8d8542d19f1eda3`  
**Phạm vi LX-00:** chỉ audit, specification và visual contract. Không thay đổi database, RPC, schema hoặc nghiệp vụ.

## 1. Nguyên tắc bắt buộc

1. Seeking là **visual source of truth** cho các màn đã có reference. Luxy.Love không được tự tạo một ngôn ngữ UI khác, không dùng kiểu dating-app màu hồng, gradient tùy ý, card bo tròn dày hoặc bottom-tab mặc định nếu reference Seeking không dùng.
2. Mục tiêu là **80–90% visual/UX fidelity**, trong đó Search, Member Profile, Edit Profile và Upgrade/Billing phải đạt khoảng 90% về hierarchy, placement, spacing, typography, border, card ratio và interaction pattern.
3. Luxy được phép khác Seeking ở: logo/brand text, tiếng Việt, dữ liệu Việt Nam, khoảng cách km, các tier Free/Premium/Diamond, quà, xác thực ảnh/CCCD/LinkedIn và các yêu cầu pháp lý/safety.
4. Luxy không được khác Seeking chỉ vì developer thấy một layout khác “đẹp hơn” hoặc “mobile friendly hơn”. Mọi divergence phải có lý do nghiệp vụ hoặc platform và được ghi trong spec/PR.
5. Không copy trực tiếp JavaScript proprietary, tracking code, analytics, SDK hoặc asset thương hiệu Seeking vào source Luxy. HTML/CSS và screenshots chỉ dùng để đo hierarchy, layout, typography, colors, dimensions và interaction behavior.

## 2. Reference inventory

Manifest machine-readable nằm tại `docs/luxy-seeking-ui/reference-manifest.json`.

### Homepage

- `Homepage Seeking.png` — 1280 × 5803.
- `Home Seeking.com _ You Know What You Want. Find it On Seeking.®.html`.
- Hero full-bleed image/video, white brand/nav trên ảnh, CTA coral/red, serif display headline, white space lớn và editorial/luxury rhythm.
- Không dùng box/card UI dày đặc ở homepage.

### Signup

- `Create Your Seeking Profile _ Sign Up Free Today!.htm`.
- Form onboarding tối giản, nhiều khoảng trắng, control lớn và rõ, text hierarchy restrained.

### Search

- `Search Seeking.png` — 1280 × 5681.
- `(1) Search - Seeking.com.html` và `static_(1) Search - Seeking.com.html`.
- Đây là reference quan trọng nhất cho authenticated discovery.

### Member Profile

- `Profile Seeking.png` — 1280 × 1691.
- `(1) Member Profile - Seeking.com.html` và `static_(1) Member Profile - Seeking.com.html`.

### Edit Profile

- `EditProfile Seeking.png` — 1280 × 2943.
- `(1) Edit Profile - Seeking.com.html` và `static_(1) Edit Profile - Seeking.com.html`.

### Upgrade/Billing

- `Upgrade Seeking.png` — 1280 × 2194.
- `Upgrade-detail Seeking.png` — 466 × 651.
- `(1) Billing - Seeking.com.html` và `static_(1) Billing - Seeking.com.html`.

## 3. Authenticated shell contract

Reference Search/Profile/Edit Profile dùng cùng một shell.

### 3.1 Desktop hierarchy

Từ trên xuống:

1. **Promo strip**: navy/ink rất đậm, chiều cao khoảng 44–48 px, text trắng, nội dung centered. Reference có “Upgrade Now to message”. Luxy dùng wording tiếng Việt tương đương nhưng không kích hoạt subscription cho tới LX-17.
2. **Primary navigation**: white surface, khoảng 58–64 px, shadow/border rất nhẹ.
3. **Brand** ở trái.
4. Nav chính theo đúng Seeking hierarchy: `Tìm kiếm` → `Yêu thích` → `Tin nhắn` → `Nâng cấp`.
5. Account ở phải: avatar tròn + tên/nickname + chevron/menu.
6. Active navigation dùng nền trắng/xám rất nhẹ và underline/ink indicator; không dùng colored pill cho mọi tab.
7. `Nâng cấp` là accent pill riêng, không biến toàn nav thành pill navigation.

### 3.2 Mobile web / iPhone PWA

- Giữ cùng information architecture.
- Ưu tiên icon + label ngắn; nếu thiếu chiều ngang, label phụ có thể ẩn nhưng không đổi thứ tự nav.
- Không quay lại 5–6 bottom tabs của MyFan.
- Profile/account menu là nơi chứa các feature phụ như Hoạt động, Quà, Thu nhập/Số dư, Xác thực và Cài đặt.
- Touch target tối thiểu 44 px.

### 3.3 Current Luxy LX-02 behavior

Ở LX-02 chỉ đổi shell/presentation. Những destination chưa có nghiệp vụ cuối (`Yêu thích`, `Nâng cấp`) phải render đúng visual nhưng **không giả lập success hoặc financial flow**. Chúng được đánh dấu pending trong code/spec cho LX-12 và LX-17.

## 4. Search contract

### 4.1 Desktop composition

- Page content gần full-width, nền white/off-white.
- Sidebar filter cố định bên trái khoảng **330–370 px** ở 1280 px viewport.
- Main result grid chiếm phần còn lại.
- Khoảng cách giữa sidebar và grid ~20–24 px.
- 3 member cards/hàng ở desktop 1280 px.
- Sort dropdown ở góc trên phải của result grid.

### 4.2 Sidebar

Order theo reference:

1. Search Filters heading.
2. Saved searches.
3. Primary CTA `Xem kết quả` dạng navy pill/full width.
4. Secondary `Lưu tìm kiếm`, `Đặt lại`.
5. Location.
6. Distance.
7. Options/verification states.
8. Age.
9. Relationship/lifestyle tags.
10. Height/weight.
11. Smoking/drinking.
12. Education/children/language.
13. Exclusions/profile text.

Luxy phải Việt hóa nội dung nhưng không tự đảo thứ tự chỉ để phù hợp dữ liệu cũ.

### 4.3 Member card

- Photo-first portrait card, target ratio khoảng **3:4**.
- Border radius restrained ~12–16 px.
- Text/controls overlay ở đáy ảnh, dark gradient để đảm bảo readability.
- Photo count badge ở góc trên trái.
- Online indicator xanh cạnh nickname.
- Verification badge cạnh tên khi có.
- Dòng dưới: tuổi · tỉnh/thành; Luxy thêm khoảng cách `0,7 km`, `2,3 km` khi có.
- Message icon và favorite heart ở góc dưới phải.
- Không dùng avatar 72 px + bio + chips như current MyFan discovery.

### 4.4 Mobile search

- 2 cột portrait cards ở 390/430 px nếu không gây overflow.
- Filter chuyển thành drawer/sheet nhưng giữ nguyên order và label.
- Sort ở top of results.
- Location mặc định vẫn ưu tiên gần → xa theo product rule Luxy; UI không được làm mất distance.

## 5. Member Profile contract

Desktop 1280 px:

- Left column khoảng 32–34%: ảnh chính portrait lớn, heart favorite overlay, CTA `Yêu cầu xem ảnh riêng tư`.
- Right column khoảng 66–68%: status online, nickname + tuổi + verification, địa phương/distance, headline, composer + `Nhắn tin` CTA.
- Private photo tile nằm ngay dưới composer, dark/navy panel với request CTA.
- Profile facts ở lower left: chiều cao, cân nặng, relationship status, activity, quốc gia/tỉnh/thành.
- Lower right: `Giới thiệu`, `Tôi đang tìm`, lifestyle/relationship attributes.
- Luxy thêm `Tặng quà` như contextual CTA, không biến gift thành điều kiện xem private photo.
- Safety actions nằm trong overflow/profile menu, không cạnh tranh thị giác với main dating actions.

## 6. Edit Profile contract

- Left photo rail/card: ảnh chính lớn, add/select photos.
- Right form content: width lớn, mỗi field dùng border bottom hoặc restrained input; không chia thành nhiều rounded cards.
- Order đầu trang theo reference: nickname/first-name public → heading → primary location → secondary locations → height → weight → relationship/lifestyle attributes.
- Các section dài phía dưới tiếp tục theo cùng rhythm.
- Luxy dùng nickname public. Legal name từ CCCD tuyệt đối không render như field public mặc định.

## 7. Upgrade/Billing contract

- Narrow centered content column khoảng 560–600 px ở desktop.
- Brand/logo centered ở top, back affordance ở trái.
- Tabs `Gói thành viên` / `Một lần` tương đương reference `Subscriptions / One-time`.
- Premium section trước, Diamond section sau.
- Plan options là border rectangles, selected state dùng accent border + very light accent surface.
- Diamond dùng dark/ink “ultimate access” badge.
- Không thêm gradient pricing cards hoặc neon/gold styling không có trong reference.
- LX-17 sẽ áp pricing Luxy Free/Premium 1M/Diamond 5M. LX-02 chỉ định nghĩa tokens/layout foundation.

## 8. Visual token contract

Color observations từ screenshots/CSS reference:

- Ink/navy: `#081726` — promo strip, primary dark CTA, dark private-photo surfaces.
- Brand coral: `#FF4A4A` — logo/accent identity.
- Accessible action red: `#C81C1D` — dùng khi white text cần AA contrast.
- Danger/reference red: `#CF0404`.
- Text dark: ink/navy hoặc gần `#111827`.
- Body muted: `#545454` / gray family.
- Borders: `#D9D9D9`.
- Subtle backgrounds: `#F8F8F8`, `#F3F2F1`.
- Surface: `#FFFFFF`.

Typography:

- Display/headings: editorial serif, high contrast, không dùng bold sans 900 cho mọi heading.
- Body/nav/forms: clean sans/system.
- Body 14–16 px; primary navigation ~15–16 px; large display titles 28–48+ tùy viewport.

Spacing:

- Base unit 4 px.
- Core scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Không dùng arbitrary spacing ở từng màn nếu token phù hợp.

Radius:

- Inputs/cards: 4 / 8 / 12 / 16 tùy role.
- CTA pill: 999 chỉ khi reference là pill.
- Không blanket `borderRadius: 16` cho mọi component.

## 9. Responsive breakpoints

Token baseline:

- Compact phone: < 430 px.
- Phone/tablet shell: < 768 px.
- Tablet: 768–1023 px.
- Desktop: >= 1024 px.
- Wide desktop: >= 1280 px.

Visual regression viewports bắt buộc:

- 390 × 844
- 430 × 932
- 768 × 1024
- 1024 × 768
- 1280 × 900
- 1440 × 1000

## 10. Fidelity scoring

Mỗi page sau LX-05 phải được review theo bốn lớp:

| Nhóm | Yêu cầu |
|---|---:|
| Information hierarchy | 100% trừ Luxy-specific business divergence |
| Layout/component placement | ≥ 90% cho Search/Profile/Edit/Billing |
| Spacing/sizing/card ratio | ≥ 90% |
| Typography/colors/borders | ≥ 85–90% |
| Interaction pattern | ≥ 90% |

Homepage/Signup target tối thiểu ~85%, các authenticated core screens target ~90%.

## 11. Explicit non-goals LX-00/01/02

Không thực hiện trong ba phiên này:

- Không migration database.
- Không sửa RLS/RPC.
- Không đổi friendship/chat business rules.
- Không thêm favorite table.
- Không thêm membership entitlement.
- Không đổi payout hold.
- Không triển khai private-photo request.
- Không kích hoạt gift/payment/subscription mới.
- Không đổi 34 tỉnh/thành hoặc location ranking backend.

Các nội dung đó thuộc LX-07 trở đi.

## 12. Review gate

LX-02 chỉ được xem là hoàn thành khi:

- branch Luxy độc lập từ `main` tồn tại;
- manifest + fidelity spec tồn tại trong repo;
- `packages/ui` có Seeking-derived Luxy design tokens và backward-compatible exports;
- old MyFan pink `#D81B60` không còn là shared primary token;
- authenticated `Tabs` shell cũ được thay bằng Luxy/Seeking shell hierarchy;
- hidden/non-core MyFan routes vẫn truy cập được nhưng không xuất hiện như six equal primary tabs;
- application TypeScript/unit/build validation không có regression do UI foundation;
- không có file migration/schema/RPC nào thay đổi.
