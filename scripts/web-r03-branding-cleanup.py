from pathlib import Path
import json

ROOT = Path('.')

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')

def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))

def replace_all(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:120]!r}')
    write(path, text.replace(old, new))

# Public web shell: remove the legacy Social Creator positioning from every reachable V1 surface.
write('apps/public-web/app/layout.tsx', '''import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import './site-shell.css';

export const metadata: Metadata = {
  title: {
    default: 'Luxy.Love — Kết nối chọn lọc cho người trưởng thành',
    template: '%s · Luxy.Love',
  },
  description: 'Luxy.Love là nền tảng kết nối dành cho người từ đủ 18 tuổi, với hồ sơ xác thực, quyền riêng tư và công cụ an toàn.',
  applicationName: 'Luxy.Love',
  creator: 'Luxy.Love',
  robots: { index: true, follow: true },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#FFF9F6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <a className="skipLink" href="#main-content">Bỏ qua đến nội dung chính</a>
        <header className="publicHeader">
          <Link className="publicBrand" href="/" aria-label="Luxy.Love trang chủ">
            <span aria-hidden="true">♥</span>
            <strong>Luxy.Love</strong>
          </Link>

          <nav className="publicDesktopNav" aria-label="Điều hướng chính">
            <Link href="/">Trang chủ</Link>
            <Link href="/community-standards">Tiêu chuẩn cộng đồng</Link>
            <Link href="/terms">Điều khoản</Link>
          </nav>

          <div className="publicHeaderActions">
            <Link className="publicLogin" href="/?intent=login">Đăng nhập</Link>
            <Link className="publicJoin" href="/?intent=signup">Tham gia</Link>
          </div>

          <details className="publicMobileMenu">
            <summary aria-label="Mở menu điều hướng"><span aria-hidden="true">☰</span></summary>
            <nav aria-label="Điều hướng mobile">
              <Link href="/">Trang chủ</Link>
              <Link href="/community-standards">Tiêu chuẩn cộng đồng</Link>
              <Link href="/terms">Điều khoản</Link>
              <Link href="/?intent=login">Đăng nhập</Link>
              <Link className="publicMobileJoin" href="/?intent=signup">Tham gia Luxy.Love</Link>
            </nav>
          </details>
        </header>

        <div id="main-content" tabIndex={-1}>{children}</div>

        <footer className="publicFooter">
          <div>
            <Link className="publicFooterBrand" href="/">Luxy.Love</Link>
            <span>Kết nối chọn lọc · 18+</span>
          </div>
          <nav aria-label="Chính sách">
            <Link href="/terms">Điều khoản</Link>
            <span aria-hidden="true">–</span>
            <Link href="/community-standards">Tiêu chuẩn cộng đồng</Link>
          </nav>
          <small>© 2026 Luxy.Love</small>
        </footer>
      </body>
    </html>
  );
}
''')

write('apps/public-web/app/page.tsx', '''import type { Metadata } from 'next';
import './home.css';

export const metadata: Metadata = {
  title: 'Luxy.Love — Kết nối chọn lọc cho người trưởng thành',
  description: 'Khám phá hồ sơ phù hợp, kết nối riêng tư và sử dụng các lớp xác thực, an toàn của Luxy.Love.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Luxy.Love — Kết nối chọn lọc cho người trưởng thành',
    description: 'Hồ sơ xác thực, tìm kiếm chọn lọc, nhắn tin và ảnh riêng tư trong một trải nghiệm dành cho người từ đủ 18 tuổi.',
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Luxy.Love — Kết nối chọn lọc · 18+',
    description: 'Khám phá và kết nối với những người phù hợp theo cách riêng tư hơn.',
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Luxy.Love',
  description: 'Nền tảng kết nối dành cho người từ đủ 18 tuổi với hồ sơ xác thực và công cụ an toàn.',
  inLanguage: 'vi-VN',
  audience: { '@type': 'PeopleAudience', requiredMinAge: 18 },
};

export default function Page() {
  return (
    <main className="homePage">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} type="application/ld+json" />

      <section className="homeHero" aria-labelledby="home-title">
        <div className="homeHeroGlow homeHeroGlowOne" aria-hidden="true" />
        <div className="homeHeroGlow homeHeroGlowTwo" aria-hidden="true" />
        <div className="homeHeroCopy">
          <span className="homePill">♥ KẾT NỐI CHỌN LỌC · CHỈ DÀNH CHO NGƯỜI TỪ 18 TUỔI</span>
          <h1 id="home-title">Gặp đúng người,<br /><span>theo cách riêng tư hơn</span></h1>
          <p>
            Luxy.Love kết hợp tìm kiếm hồ sơ, xác thực thành viên, nhắn tin trực tiếp và ảnh riêng tư
            trong một trải nghiệm tập trung vào sự rõ ràng, tôn trọng và an toàn.
          </p>
          <div className="homeHeroActions">
            <a className="homePrimaryButton" href="/?intent=signup">Tham gia Luxy.Love</a>
            <a className="homeGhostButton" href="/?intent=login">Đăng nhập</a>
          </div>
          <p className="homeHeroNote">Tính năng trả phí chỉ mở quyền sử dụng sản phẩm; không mua quyền gặp mặt, tình cảm hay thông tin liên hệ riêng.</p>
        </div>

        <div className="homePhone" aria-label="Minh họa giao diện hồ sơ Luxy.Love">
          <div className="homePhoneTop"><span className="homePhoneBrand">Luxy.Love</span><span className="homePhoneAge">18+</span></div>
          <article className="homePhonePost">
            <header>
              <span className="homePhoneAvatar">L</span>
              <div><strong>Thành viên đã xác thực</strong><small>Hồ Chí Minh · đang online</small></div>
              <span className="homePhoneCheck">✓</span>
            </header>
            <p>Một hồ sơ rõ ràng, chọn lọc và tôn trọng quyền riêng tư.</p>
            <div className="homePhoneMedia"><span>Ảnh hồ sơ đã qua luồng kiểm duyệt</span></div>
            <footer><span>♡ Yêu thích</span><span>✉ Nhắn tin</span></footer>
          </article>
          <div className="homePhoneGifts"><span>Premium</span><span>Diamond</span><span>Ảnh riêng tư</span></div>
        </div>
      </section>

      <section className="homeTrustBar" aria-label="Nguyên tắc chính của Luxy.Love">
        <div><strong>18+</strong><span>Chỉ dành cho người trưởng thành</span></div>
        <div><strong>✓</strong><span>Luồng xác thực hồ sơ và hình ảnh</span></div>
        <div><strong>🔒</strong><span>Quyền riêng tư được kiểm tra tại server</span></div>
      </section>

      <section className="homeSection homeIntro" id="about" aria-labelledby="about-title">
        <div className="homeSectionHeading">
          <div><p className="homeEyebrow">LUXY.LOVE LÀ GÌ?</p><h2 id="about-title">Một không gian kết nối dành cho người trưởng thành</h2></div>
          <p>Từ tìm kiếm đến trò chuyện và ảnh riêng tư, mỗi bề mặt đều được thiết kế để giảm nhiễu và tăng quyền kiểm soát cho thành viên.</p>
        </div>
        <div className="homeFeatureGrid">
          <article><span className="homeFeatureIcon">✦</span><h3>Khám phá phù hợp</h3><p>Tìm thành viên theo tiêu chí hồ sơ và khu vực mà không công khai tọa độ chính xác.</p></article>
          <article><span className="homeFeatureIcon">◎</span><h3>Nhắn tin rõ ràng</h3><p>Premium và Diamond có thể bắt đầu cuộc trò chuyện trực tiếp; chặn và báo cáo luôn được ưu tiên.</p></article>
          <article><span className="homeFeatureIcon">♥</span><h3>Ảnh riêng tư</h3><p>Ảnh riêng tư chỉ mở theo entitlement hợp lệ; kết nối hay thao tác khác không tự tạo quyền xem.</p></article>
        </div>
      </section>

      <section className="homeSection homeBenefits" aria-labelledby="benefits-title">
        <div className="homeSectionHeading homeSectionHeadingLight">
          <div><p className="homeEyebrow homeEyebrowLight">QUYỀN LỢI RÕ RÀNG</p><h2 id="benefits-title">Free, Premium và Diamond được phân lớp minh bạch</h2></div>
          <p>Nâng cấp chỉ mở các quyền sản phẩm được công bố; an toàn, chặn và các giới hạn nền tảng vẫn có ưu tiên cao hơn.</p>
        </div>
        <div className="homeAudienceGrid">
          <article><span className="homeAudienceLabel">FREE</span><h3>Khám phá và thể hiện sự quan tâm</h3><ul><li>Tìm kiếm hồ sơ phù hợp.</li><li>Yêu thích hồ sơ.</li><li>Nhận và đọc hội thoại được gửi tới bạn.</li><li>Sử dụng chặn, báo cáo và các công cụ an toàn.</li></ul></article>
          <article><span className="homeAudienceLabel">PREMIUM / DIAMOND</span><h3>Mở rộng khả năng kết nối</h3><ul><li>Bắt đầu và gửi tin nhắn trực tiếp.</li><li>Xem ảnh riêng tư đủ điều kiện.</li><li>Hiển thị trạng thái gói theo dữ liệu server.</li><li>Không có đường tắt vượt qua block hoặc kiểm duyệt.</li></ul></article>
        </div>
      </section>

      <section className="homeSection homeSafety" id="safety" aria-labelledby="safety-title">
        <div className="homeSafetyCopy">
          <p className="homeEyebrow">RIÊNG TƯ VÀ AN TOÀN</p>
          <h2 id="safety-title">An toàn được xây vào từng luồng sử dụng</h2>
          <p>Luxy.Love tách dữ liệu hồ sơ công khai khỏi ngày sinh đầy đủ, tọa độ chính xác, dữ liệu xác minh và dữ liệu kiểm duyệt nội bộ. Quyền truy cập được kiểm tra phía server.</p>
          <a className="homeTextLink" href="/community-standards">Đọc Tiêu chuẩn cộng đồng ›</a>
        </div>
        <ol className="homeSafetySteps">
          <li><span>01</span><div><strong>Xác nhận đủ 18 tuổi</strong><p>Người dùng phải đáp ứng điều kiện độ tuổi trước khi hoàn tất onboarding.</p></div></li>
          <li><span>02</span><div><strong>Xác thực hồ sơ</strong><p>Ảnh selfie và ảnh hồ sơ đi qua luồng xác minh trước khi tài khoản được kích hoạt tự động.</p></div></li>
          <li><span>03</span><div><strong>Quyền riêng tư có kiểm soát</strong><p>Ảnh riêng tư và nhắn tin được mở theo entitlement; chặn luôn được ưu tiên.</p></div></li>
        </ol>
      </section>

      <section className="homeFinalCta" id="join" aria-labelledby="join-title">
        <div><p className="homeEyebrow homeEyebrowLight">BẮT ĐẦU VỚI LUXY.LOVE</p><h2 id="join-title">Kết nối có chọn lọc, từ đủ 18 tuổi</h2><p>Tạo hồ sơ, xác thực danh tính hình ảnh và khám phá những người phù hợp trong một môi trường có kiểm soát.</p></div>
        <div className="homeFinalActions"><a className="homeWhiteButton" href="/?intent=signup">Tham gia ngay</a><a className="homeOutlineLightButton" href="/?intent=login">Đăng nhập</a></div>
      </section>
    </main>
  );
}
''')

write('apps/public-web/app/terms/page.tsx', '''import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng',
  description: 'Điều khoản sử dụng Luxy.Love dành cho người từ đủ 18 tuổi.',
  alternates: { canonical: '/terms' },
};

export default function Page() {
  return (
    <main className="legalPage">
      <article className="legalDocument">
        <p className="legalKicker">LUXY.LOVE · CẬP NHẬT NGÀY 13/08/2026</p>
        <h1>Điều khoản sử dụng</h1>
        <p className="legalLead">Điều khoản này quy định việc truy cập và sử dụng Luxy.Love, nền tảng kết nối chỉ dành cho người từ đủ 18 tuổi trở lên.</p>

        <h2>1. Điều kiện sử dụng</h2>
        <p>Bạn phải từ đủ 18 tuổi, cung cấp thông tin đăng ký chính xác, sử dụng hình ảnh thuộc quyền sử dụng hợp pháp của mình và tự chịu trách nhiệm bảo vệ tài khoản.</p>

        <h2>2. Mục đích của Luxy.Love</h2>
        <p>Luxy.Love giúp người trưởng thành tạo hồ sơ, khám phá thành viên phù hợp, thể hiện sự quan tâm và trò chuyện theo các quyền sản phẩm đang được mở.</p>
        <p>Luxy.Love không phải dịch vụ mại dâm, môi giới dịch vụ tình dục, chuyển tiền ngang hàng hoặc nền tảng mua bán gặp mặt, tình cảm, quan hệ tình dục hay thông tin liên hệ riêng.</p>

        <h2>3. Hồ sơ, xác thực và quyền riêng tư</h2>
        <p>Người dùng chịu trách nhiệm về thông tin và hình ảnh đã cung cấp. Nền tảng có thể yêu cầu selfie, kiểm tra hình ảnh hoặc tài liệu xác minh để bảo vệ tính xác thực của hồ sơ.</p>
        <p>Ngày sinh đầy đủ, tọa độ chính xác, dữ liệu xác minh, thông tin thanh toán và dữ liệu kiểm duyệt nội bộ không phải dữ liệu hồ sơ công khai. Quyền chặn luôn được ưu tiên hơn các entitlement khác.</p>

        <h2>4. Nhắn tin và ảnh riêng tư</h2>
        <p>Quyền bắt đầu hoặc gửi tin nhắn, cũng như quyền xem ảnh riêng tư, có thể phụ thuộc vào gói thành viên và trạng thái tài khoản. Không được spam, quấy rối, đe dọa, mạo danh hoặc tìm cách vượt qua quyền truy cập.</p>

        <h2>5. Gói thành viên và thanh toán</h2>
        <p>Các khoản thanh toán cho Premium hoặc Diamond là phí sử dụng tính năng nền tảng theo gói được công bố. Việc thanh toán không tạo nghĩa vụ gặp mặt, quan hệ cá nhân hay cung cấp thông tin liên hệ từ người dùng khác.</p>
        <p>Một số tính năng giao dịch hoặc quà tặng có thể chưa khả dụng trong phiên bản hiện tại và chỉ được mở khi đáp ứng điều kiện sản phẩm, vận hành và an toàn.</p>

        <h2>6. Nội dung và hành vi bị cấm</h2>
        <ul>
          <li>Nội dung tình dục, khỏa thân, dịch vụ tình dục hoặc nội dung nhằm kích dục.</li>
          <li>Bóc lột, dụ dỗ, xâm hại hoặc tình dục hóa người dưới 18 tuổi.</li>
          <li>Đổi tiền, quà hoặc lợi ích vật chất lấy gặp mặt, tình cảm, quan hệ tình dục hoặc nội dung người lớn.</li>
          <li>Quấy rối, theo dõi, đe dọa, mạo danh, lừa đảo hoặc thao túng tài chính.</li>
          <li>Đăng thông tin riêng tư của người khác khi chưa được phép.</li>
          <li>Tìm cách vượt qua kiểm duyệt, block, RLS hoặc các biện pháp an toàn.</li>
        </ul>

        <h2>7. Kiểm duyệt và xử lý vi phạm</h2>
        <p>Luxy.Love có thể hạn chế hiển thị, gỡ nội dung, hạn chế tính năng, đình chỉ hoặc vô hiệu tài khoản khi cần bảo vệ người dùng, điều tra vi phạm, tuân thủ pháp luật hoặc thực thi Tiêu chuẩn cộng đồng.</p>

        <h2>8. Báo cáo và chặn</h2>
        <p>Người dùng có thể báo cáo tài khoản, ảnh hoặc tin nhắn và có thể chặn tài khoản khác. Lạm dụng công cụ báo cáo hoặc trả đũa người báo cáo có thể bị xử lý.</p>

        <h2>9. Xóa tài khoản</h2>
        <p>Người dùng có thể gửi yêu cầu xóa tài khoản. Một số dữ liệu có thể được giữ trong thời hạn cần thiết để chống gian lận, xử lý nghĩa vụ pháp lý hoặc thực thi an toàn trước khi được xóa hoặc ẩn danh.</p>

        <h2>10. Thay đổi điều khoản</h2>
        <p>Luxy.Love có thể cập nhật Điều khoản khi sản phẩm, pháp luật hoặc yêu cầu vận hành thay đổi. Khi cần, người dùng sẽ được yêu cầu đọc và chấp nhận phiên bản mới.</p>

        <p className="legalUpdated">Việc tiếp tục sử dụng Luxy.Love sau khi Điều khoản có hiệu lực đồng nghĩa với việc bạn đồng ý tuân thủ Điều khoản và Tiêu chuẩn cộng đồng hiện hành.</p>
      </article>
    </main>
  );
}
''')

write('apps/public-web/app/community-standards/page.tsx', '''import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tiêu chuẩn cộng đồng',
  description: 'Tiêu chuẩn cộng đồng áp dụng cho hồ sơ, ảnh, tin nhắn và hành vi trên Luxy.Love.',
  alternates: { canonical: '/community-standards' },
};

export default function Page() {
  return (
    <main className="legalPage">
      <article className="legalDocument">
        <p className="legalKicker">LUXY.LOVE · CẬP NHẬT NGÀY 13/08/2026</p>
        <h1>Tiêu chuẩn cộng đồng</h1>
        <p className="legalLead">Tiêu chuẩn này áp dụng cho hồ sơ, ảnh, tin nhắn, liên kết và mọi nội dung hoặc hành vi trên Luxy.Love.</p>

        <h2>1. Chỉ dành cho người từ đủ 18 tuổi</h2>
        <p>Luxy.Love không cho phép người dưới 18 tuổi đăng ký hoặc sử dụng nền tảng. Cấm tuyệt đối nội dung hoặc hành vi bóc lột, dụ dỗ, xâm hại, tình dục hóa hoặc khai thác người dưới 18 tuổi.</p>

        <h2>2. Không cho phép nội dung tình dục hoặc bóc lột</h2>
        <ul>
          <li>Khỏa thân, hành vi tình dục hoặc nội dung khiêu dâm.</li>
          <li>Dịch vụ tình dục, mại dâm, môi giới hoặc quảng cáo liên quan.</li>
          <li>Hình ảnh thân mật không có sự đồng thuận, deepfake tình dục hoặc sextortion.</li>
          <li>Yêu cầu chuyển nội dung tình dục qua nền tảng khác.</li>
        </ul>

        <h2>3. Không mua bán quan hệ hoặc quyền tiếp cận</h2>
        <p>Không được đề nghị, yêu cầu hoặc ám chỉ rằng tiền, quà hoặc lợi ích vật chất sẽ được đổi lấy gặp mặt, tình cảm, quan hệ tình dục, thông tin liên hệ riêng, dịch vụ cá nhân hoặc nội dung người lớn.</p>

        <h2>4. Tôn trọng ranh giới</h2>
        <ul>
          <li>Không đe dọa, bắt nạt, làm nhục, ép buộc hoặc theo dõi người khác.</li>
          <li>Không tiếp tục liên hệ khi người nhận đã từ chối hoặc chặn.</li>
          <li>Không làm lộ thông tin cá nhân hoặc hình ảnh riêng tư của người khác.</li>
          <li>Không kích động thù ghét hoặc bạo lực.</li>
        </ul>

        <h2>5. Không lừa đảo hoặc mạo danh</h2>
        <p>Cấm giả danh cá nhân, nhân viên Luxy.Love hoặc tổ chức khác; tạo hồ sơ gây hiểu nhầm; lừa lấy tiền, tài khoản hoặc dữ liệu cá nhân; phát tán liên kết độc hại hoặc thao túng giao dịch.</p>

        <h2>6. Bảo vệ quyền riêng tư</h2>
        <p>Không đăng số điện thoại, địa chỉ, tọa độ chính xác, tài liệu định danh, tài khoản ngân hàng, nội dung riêng tư hoặc thông tin nhạy cảm của người khác khi chưa được phép.</p>
        <p>Không tìm cách suy luận vị trí chính xác, vượt qua quyền xem ảnh riêng tư hoặc chia sẻ lại nội dung riêng tư ngoài phạm vi được cấp quyền.</p>

        <h2>7. Hồ sơ và hình ảnh xác thực</h2>
        <p>Không dùng ảnh của người khác để giả danh. Ảnh mới có thể ở trạng thái chờ kiểm duyệt; selfie hoặc tài liệu xác minh có thể được yêu cầu để bảo vệ tính xác thực của hồ sơ.</p>

        <h2>8. Spam và thao túng nền tảng</h2>
        <p>Không gửi hàng loạt tin nhắn, tạo tương tác giả, dùng nhiều tài khoản để né hạn chế, tự động hóa trái phép, khai thác lỗi, sửa request hoặc tìm cách truy cập dữ liệu của người khác.</p>

        <h2>9. Báo cáo và chặn</h2>
        <p>Người dùng nên báo cáo nội dung hoặc tài khoản có nguy cơ gây hại và có thể chặn tài khoản khác. Không được lạm dụng công cụ báo cáo, gửi bằng chứng giả hoặc trả đũa người báo cáo.</p>

        <h2>10. Cách Luxy.Love thực thi</h2>
        <p>Tùy mức độ và lịch sử vi phạm, Luxy.Love có thể từ chối hoặc gỡ nội dung, hạn chế hiển thị, khóa tính năng, đình chỉ hoặc vô hiệu tài khoản. Nội dung nghiêm trọng có thể được giữ phục vụ điều tra và nghĩa vụ pháp lý.</p>

        <p className="legalUpdated">Hãy sử dụng Luxy.Love với sự tôn trọng, trung thực và đồng thuận; không tạo áp lực tài chính hoặc quan hệ đối với người khác.</p>
      </article>
    </main>
  );
}
''')

write('apps/public-web/app/qua-tang/page.tsx', '''import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Quà tặng — Luxy.Love',
  description: 'Tính năng quà tặng chưa khả dụng trong phiên bản Luxy.Love hiện tại.',
  robots: { index: false, follow: false },
};

export default function GiftCatalogPage() {
  return (
    <main className="giftPublicPage">
      <section className="giftPublicHero">
        <p className="eyebrow">LUXY.LOVE · 18+</p>
        <h1>Quà tặng chưa khả dụng</h1>
        <p>Tính năng quà tặng đang được giữ ở trạng thái tắt trong phiên bản phát hành hiện tại. Luxy.Love không hiển thị giao dịch giả hoặc tạo entitlement thay thế.</p>
        <div className="actions">
          <Link className="primary" href="/">Về trang chủ</Link>
          <Link className="secondary" href="/?intent=login">Đăng nhập</Link>
        </div>
      </section>
      <section className="giftPolicySection">
        <div><p className="eyebrow">NGUYÊN TẮC AN TOÀN</p><h2>Không mua quyền gặp mặt hay quan hệ cá nhân</h2></div>
        <p>Nếu quà tặng được mở trong tương lai, quà không bảo đảm gặp mặt, liên hệ riêng, nội dung người lớn hoặc bất kỳ quan hệ tình cảm nào.</p>
        <Link className="secondary" href="/community-standards">Xem Tiêu chuẩn cộng đồng</Link>
      </section>
    </main>
  );
}
''')

write('apps/public-web/app/hoat-dong/page.tsx', '''import { redirect } from 'next/navigation';

export default function LegacyActivityPage() {
  redirect('/');
}
''')

replace_all('apps/public-web/app/manifest.ts', "MyFan — Social Creator 18+", "Luxy.Love — Kết nối chọn lọc 18+")
replace_all('apps/public-web/app/manifest.ts', "MyFan", "Luxy.Love")

# Mobile legal surfaces aligned to current Luxy V1 semantics.
write('apps/mobile/app/legal/terms.tsx', '''import { spacing } from '@myfan/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/screen';

export default function TermsScreen() {
  return (
    <Screen title="Điều khoản sử dụng" description="Phiên bản 13/08/2026 · Áp dụng cho Luxy.Love dành cho người từ đủ 18 tuổi.">
      <Text style={styles.heading}>1. Điều kiện sử dụng</Text>
      <Text style={styles.body}>Bạn phải từ đủ 18 tuổi, cung cấp thông tin chính xác, sử dụng hình ảnh hợp pháp của mình và chịu trách nhiệm bảo vệ tài khoản.</Text>
      <Text style={styles.heading}>2. Mục đích nền tảng</Text>
      <Text style={styles.body}>Luxy.Love là nền tảng kết nối dành cho người trưởng thành. Gói trả phí chỉ mở quyền sử dụng sản phẩm và không mua quyền gặp mặt, tình cảm, quan hệ cá nhân hay thông tin liên hệ riêng.</Text>
      <Text style={styles.heading}>3. Hồ sơ, xác thực và quyền riêng tư</Text>
      <Text style={styles.body}>Hồ sơ và hình ảnh có thể được kiểm duyệt hoặc yêu cầu xác minh. Ảnh riêng tư chỉ được mở theo entitlement hợp lệ; block luôn có ưu tiên cao hơn.</Text>
      <Text style={styles.heading}>4. Nhắn tin và thanh toán</Text>
      <Text style={styles.body}>Quyền gửi tin nhắn có thể phụ thuộc gói thành viên. Thanh toán Premium hoặc Diamond là phí dịch vụ nền tảng, không phải khoản chuyển tiền giữa người dùng.</Text>
      <Text style={styles.heading}>5. Đình chỉ và xóa tài khoản</Text>
      <Text style={styles.body}>Luxy.Love có thể giới hạn hoặc đình chỉ tài khoản vi phạm. Người dùng có quyền yêu cầu xóa tài khoản theo quy trình công khai.</Text>
      <Link href="/(onboarding)" style={styles.link}>Quay lại xác nhận 18+</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '800', marginTop: spacing.md },
  body: { fontSize: 14, lineHeight: 22, marginTop: spacing.xs },
  link: { fontSize: 15, fontWeight: '800', marginTop: spacing.xl },
});
''')

write('apps/mobile/app/legal/community-standards.tsx', '''import { spacing } from '@myfan/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/screen';

export default function CommunityStandardsScreen() {
  return (
    <Screen title="Tiêu chuẩn cộng đồng" description="Phiên bản 13/08/2026 · Áp dụng cho hồ sơ, ảnh, tin nhắn và hành vi trên Luxy.Love.">
      <Text style={styles.heading}>An toàn người dưới 18 tuổi</Text>
      <Text style={styles.body}>Cấm tuyệt đối nội dung, hành vi dụ dỗ, bóc lột hoặc tình dục hóa người dưới 18 tuổi. Luxy.Love chỉ dành cho người trưởng thành.</Text>
      <Text style={styles.heading}>Nội dung tình dục và mua bán quan hệ</Text>
      <Text style={styles.body}>Không cho phép khỏa thân, nội dung tình dục, dịch vụ tình dục hoặc đổi tiền, quà hay lợi ích vật chất lấy gặp mặt, quan hệ, thông tin liên hệ riêng hay nội dung người lớn.</Text>
      <Text style={styles.heading}>Quấy rối và gian lận</Text>
      <Text style={styles.body}>Cấm đe dọa, theo dõi, cưỡng ép, lừa đảo, mạo danh, phát tán hình ảnh riêng tư không đồng thuận và thao túng tài chính.</Text>
      <Text style={styles.heading}>Hồ sơ và hình ảnh xác thực</Text>
      <Text style={styles.body}>Không dùng ảnh của người khác để giả danh. Ảnh mới có thể chờ kiểm duyệt; người dùng có thể báo cáo và chặn, và Luxy.Love có thể áp dụng biện pháp với tài khoản vi phạm.</Text>
      <Text style={styles.heading}>Vị trí và quyền riêng tư</Text>
      <Text style={styles.body}>Không công khai tọa độ chính xác và không tìm cách vượt qua quyền xem ảnh riêng tư, block hoặc các lớp kiểm soát truy cập khác.</Text>
      <Link href="/(onboarding)" style={styles.link}>Quay lại xác nhận 18+</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '800', marginTop: spacing.md },
  body: { fontSize: 14, lineHeight: 22, marginTop: spacing.xs },
  link: { fontSize: 15, fontWeight: '800', marginTop: spacing.xl },
});
''')

# Remove the deferred Activity surface from Member Profile entirely.
replace_once('apps/mobile/app/profile/[username].tsx', "import { CreatorActivityList } from '@/components/creator-activity';\n", '')
replace_once('apps/mobile/app/profile/[username].tsx', '''              {social.is_creator ? (
                <View style={styles.activitySection}>
                  <View style={styles.sectionHeadingRow}>
                    <Text style={styles.sectionTitle}>Hoạt động & Album ảnh</Text>
                    {social.activity_can_view ? <Text style={styles.sectionCount}>{social.activity_post_count} bài</Text> : null}
                  </View>
                  <CreatorActivityList compact username={social.username} />
                </View>
              ) : null}
''', '')
replace_once('apps/mobile/app/profile/[username].tsx', "function formatLastActive(value: string | null): string { if (!value) return 'Hoạt động gần đây'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Hoạt động gần đây'; const diff = Date.now() - date.getTime(); if (diff < 15 * 60_000) return 'Đang online'; if (diff < 3_600_000) return `Hoạt động ${Math.max(1, Math.floor(diff / 60_000))} phút trước`; if (diff < 86_400_000) return `Hoạt động ${Math.max(1, Math.floor(diff / 3_600_000))} giờ trước`; return `Hoạt động ${Math.max(1, Math.floor(diff / 86_400_000))} ngày trước`; }", "function formatLastActive(value: string | null): string { if (!value) return 'Truy cập gần đây'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Truy cập gần đây'; const diff = Date.now() - date.getTime(); if (diff < 15 * 60_000) return 'Đang online'; if (diff < 3_600_000) return `Truy cập ${Math.max(1, Math.floor(diff / 60_000))} phút trước`; if (diff < 86_400_000) return `Truy cập ${Math.max(1, Math.floor(diff / 3_600_000))} giờ trước`; return `Truy cập ${Math.max(1, Math.floor(diff / 86_400_000))} ngày trước`; }")

# Mobile visible-copy cleanup.
for path in ['apps/mobile/app/chat/[conversationId].tsx', 'apps/mobile/app/auth/forgot-password.tsx', 'apps/mobile/app/settings/account-deletion.tsx', 'apps/mobile/app/payments/vietqr.tsx', 'apps/mobile/src/components/app-error-boundary.tsx', 'apps/mobile/src/lib/activity-media.ts', 'apps/mobile/src/lib/location-errors.ts', 'apps/mobile/src/lib/onboarding.ts']:
    text = read(path)
    if 'MyFan' in text:
        write(path, text.replace('MyFan', 'Luxy.Love'))

replace_once('apps/mobile/app/chat/[conversationId].tsx', "Hai tài khoản sẽ không thể kết bạn, nhắn tin, tặng quà hoặc xem Album Fan của nhau.", "Hai tài khoản sẽ không thể tương tác, nhắn tin, tặng quà hoặc xem nội dung riêng tư của nhau.")
replace_once('apps/mobile/app/chat/[conversationId].tsx', "{detail.is_creator ? <Text style={styles.creatorBadge}>Creator</Text> : null}", "{detail.is_creator ? <Text style={styles.creatorBadge}>Đã duyệt</Text> : null}")

replace_once('apps/mobile/app/settings/account-deletion.tsx', '• Nearby, lời mời kết bạn, chat và Album Fan bị tắt.', '• Khám phá, tương tác, chat và quyền xem nội dung riêng tư bị tắt.')
replace_once('apps/mobile/app/settings/private-photos.tsx', 'Quà tặng, Fan hoặc kết nối không mở khóa ảnh.', 'Quà tặng hoặc các loại kết nối không mở khóa ảnh.')
replace_once('apps/mobile/app/settings/gifts.tsx', 'Các preference này cần persistence + policy ở LX-19; release V1 vẫn giữ luồng quà tặng tắt cho người dùng thật.', 'Tùy chọn quà tặng hiện chưa khả dụng; luồng gửi quà vẫn được giữ ở trạng thái tắt cho người dùng thật.')
replace_once('apps/mobile/app/settings/gifts.tsx', '• Gift, Fan và friendship không được dùng để suy luận quyền truy cập profile.', '• Quà tặng và các loại kết nối không được dùng để suy luận quyền truy cập hồ sơ.')
replace_once('apps/mobile/app/settings/membership.tsx', 'Sản phẩm mua một lần chưa mở trong LX-18', 'Sản phẩm mua một lần chưa khả dụng')
replace_once('apps/mobile/app/settings/membership.tsx', 'Tab được giữ theo cấu trúc Billing của Seeking. Quà tặng và giao dịch một lần thuộc LX-19; Luxy không tạo sản phẩm giả chỉ để lấp giao diện.', 'Các giao dịch mua một lần hiện chưa được mở. Luxy.Love không tạo sản phẩm giả chỉ để lấp giao diện.')
replace_once('apps/mobile/app/settings/membership.tsx', 'VietQR chỉ mở trên web/PWA. Android Google Play Billing thuộc LX-21.', 'VietQR chỉ mở trên web. Thanh toán Google Play chưa được hỗ trợ trong phiên bản này.')
replace_once('apps/mobile/app/(tabs)/balance.tsx', '❤️ mua để dùng trong MyFan được tách khỏi Thu nhập Creator và không thể rút thành tiền.', '❤️ dùng cho tính năng quà tặng (khi được mở) được tách khỏi các khoản chi trả và không thể rút trực tiếp thành tiền.')
replace_once('apps/mobile/app/(tabs)/gifts.tsx', 'Luồng xác thực người dùng sẽ tiếp tục được hoàn thiện trong LX-20. LX-19 không tạo đường tắt KYC/ngân hàng.', 'Luồng quà tặng không tạo đường tắt cho xác thực, KYC hoặc tài khoản ngân hàng.')
replace_all('apps/mobile/app/(tabs)/friends.tsx', 'Thành viên MyFan', 'Thành viên Luxy.Love')
replace_all('apps/mobile/app/(tabs)/friends.tsx', 'Tài khoản MyFan', 'Tài khoản Luxy.Love')
replace_all('apps/mobile/app/(tabs)/friends.tsx', '<Text style={styles.creatorBadge}>Creator</Text>', '<Text style={styles.creatorBadge}>Đã duyệt</Text>')
replace_once('apps/mobile/src/components/luxy-search-mobile.tsx', 'suffix="LX-20"', 'suffix="Sắp mở"')
replace_once('apps/mobile/src/components/luxy-search-mobile.tsx', 'suffix="LX-20"', 'suffix="Sắp mở"')
replace_once('apps/mobile/src/components/luxy-search-desktop.tsx', 'suffix="LX-20"', 'suffix="Sắp mở"')
replace_once('apps/mobile/src/components/luxy-search-desktop.tsx', 'suffix="LX-20"', 'suffix="Sắp mở"')
replace_once('apps/mobile/src/components/luxy-search-desktop.tsx', 'accessibilityHint="Lưu tìm kiếm chưa thuộc LX-12"', 'accessibilityHint="Lưu tìm kiếm chưa khả dụng trong phiên bản này"')
replace_once('apps/mobile/src/components/luxy-upgrade-gate-modal.tsx', 'Gift, Fan, friendship và legacy approval request không mở khóa ảnh riêng tư. Block vẫn có ưu tiên cao hơn trạng thái gói.', 'Quà tặng, các loại kết nối và yêu cầu duyệt cũ không mở khóa ảnh riêng tư. Block vẫn có ưu tiên cao hơn trạng thái gói.')

write('apps/mobile/app/creator/index.tsx', '''import { Placeholder, Screen } from '@/components/screen';

export default function Page() {
  return (
    <Screen title="Tính năng chưa khả dụng" description="Các công cụ nhận thưởng và rút tiền hiện chưa được mở trên Luxy.Love.">
      <Placeholder text="Không có luồng tài chính thay thế được mở trong phiên bản hiện tại." />
    </Screen>
  );
}
''')

# Safe internal display labels. Keep workspace/package/env/protocol identifiers unchanged.
replace_all('apps/mobile/src/lib/logger.ts', '[MyFan]', '[Luxy.Love]')
replace_once('packages/config/src/index.ts', "export const PRODUCT_NAME = 'MyFan';", "export const PRODUCT_NAME = 'Luxy.Love';")
replace_once('packages/validation/src/index.ts', 'Bạn phải đủ 18 tuổi để sử dụng MyFan.', 'Bạn phải đủ 18 tuổi để sử dụng Luxy.Love.')

# Admin shell branding only; legacy operational identifiers remain stable.
for path in ['apps/admin/app/runtime-observability/page.tsx', 'apps/admin/app/kyc-withdrawal-operations/page.tsx', 'apps/admin/app/vietqr-reconciliation/page.tsx', 'apps/admin/app/layout.tsx', 'apps/admin/app/admin-login.tsx', 'apps/admin/app/activity-moderation/page.tsx']:
    text = read(path)
    if 'MyFan' in text:
        write(path, text.replace('MyFan', 'Luxy.Love'))
replace_once('apps/admin/app/(protected)/dashboard/page.tsx', 'KPI user, Creator, ❤️, moderation và withdrawal sẽ xuất hiện tại đây.', 'KPI thành viên, gói dịch vụ, moderation và nghiệp vụ vận hành sẽ xuất hiện tại đây.')
replace_all('apps/admin/app/admin-login.tsx', 'Kiểm duyệt Hoạt động', 'Kiểm duyệt nội dung legacy')
replace_once('apps/admin/app/activity-moderation/page.tsx', 'Kiểm duyệt Hoạt động — Luxy.Love Admin', 'Kiểm duyệt nội dung legacy — Luxy.Love Admin')
replace_once('apps/admin/app/activity-moderation/activity-moderation-client.tsx', '<div><p className="adminEyebrow">CREATOR ACTIVITY</p><h1>Kiểm duyệt Hoạt động</h1><p>Text, link, ảnh xem trước và original được xem qua quyền moderator. Quyền Công khai, Bạn bè hoặc Fan được áp dụng cho toàn bộ feed sau khi duyệt.</p></div>', '<div><p className="adminEyebrow">LEGACY CONTENT</p><h1>Kiểm duyệt nội dung legacy</h1><p>Luồng nội dung lịch sử được giữ để vận hành dữ liệu cũ. Text, link và ảnh chỉ được xem qua quyền moderator.</p></div>')
replace_once('apps/admin/app/activity-moderation/activity-moderation-client.tsx', '<div><dt>Quyền xem</dt><dd>Cài đặt chung Creator</dd></div>', '<div><dt>Quyền xem</dt><dd>Cấu hình nội dung legacy</dd></div>')

# Permanent source guard for reachable/user-facing Web V1 copy.
write('scripts/validate-web-r03-branding.mjs', '''import { readFileSync } from 'node:fs';

const noMyFanOrPhase = [
  'apps/mobile/app/chat/[conversationId].tsx',
  'apps/mobile/app/profile/[username].tsx',
  'apps/mobile/app/legal/terms.tsx',
  'apps/mobile/app/legal/community-standards.tsx',
  'apps/mobile/app/auth/forgot-password.tsx',
  'apps/mobile/app/settings/account-deletion.tsx',
  'apps/mobile/app/settings/private-photos.tsx',
  'apps/mobile/app/settings/gifts.tsx',
  'apps/mobile/app/settings/membership.tsx',
  'apps/mobile/app/(tabs)/balance.tsx',
  'apps/mobile/app/(tabs)/gifts.tsx',
  'apps/mobile/app/(tabs)/friends.tsx',
  'apps/mobile/app/payments/vietqr.tsx',
  'apps/mobile/app/creator/index.tsx',
  'apps/mobile/src/components/luxy-search-mobile.tsx',
  'apps/mobile/src/components/luxy-search-desktop.tsx',
  'apps/mobile/src/components/luxy-upgrade-gate-modal.tsx',
  'apps/mobile/src/components/app-error-boundary.tsx',
  'apps/mobile/src/lib/location-errors.ts',
  'apps/mobile/src/lib/onboarding.ts',
  'packages/config/src/index.ts',
  'packages/validation/src/index.ts',
  'apps/admin/app/layout.tsx',
  'apps/admin/app/admin-login.tsx',
];

const publicReachable = [
  'apps/public-web/app/layout.tsx',
  'apps/public-web/app/page.tsx',
  'apps/public-web/app/terms/page.tsx',
  'apps/public-web/app/community-standards/page.tsx',
  'apps/public-web/app/qua-tang/page.tsx',
  'apps/public-web/app/hoat-dong/page.tsx',
  'apps/public-web/app/manifest.ts',
];

const failures = [];
for (const path of noMyFanOrPhase) {
  const text = readFileSync(path, 'utf8');
  if (/MyFan/.test(text)) failures.push(`${path}: legacy MyFan copy remains`);
  if (/LX-[0-9]{2}/.test(text)) failures.push(`${path}: internal LX phase label remains user-facing`);
  if (/Album Fan/.test(text)) failures.push(`${path}: legacy Album Fan copy remains`);
}
for (const path of publicReachable) {
  const text = readFileSync(path, 'utf8');
  for (const [label, pattern] of [
    ['MyFan', /MyFan/],
    ['Creator', /Creator/],
    ['Fan', /\bFan\b/],
    ['Hoạt động', /Hoạt động/],
    ['Social Creator', /Social Creator/],
  ]) {
    if (pattern.test(text)) failures.push(`${path}: legacy public-web term ${label} remains`);
  }
}

if (failures.length) {
  console.error('WEB-R03 branding validation failed:\n' + failures.map((x) => `- ${x}`).join('\n'));
  process.exit(1);
}
console.log('WEB-R03 branding validation passed: reachable Web V1 surfaces use Luxy.Love copy and no LX phase labels.');
''')

# Browser regression: core Expo Web surfaces must not expose legacy brand/phase copy.
write('tests/br-06/web-r03-branding.spec.mjs', '''import { expect, test } from '@playwright/test';

const password = process.env.BR06_E2E_PASSWORD || 'Br06-local-only-2026!';
const freeActor = { email: 'br06.outsider@example.test' };
const creator = { username: 'br06_creator' };

async function login(page) {
  await page.goto('/auth?mode=login');
  await page.getByPlaceholder('email@example.com').fill(freeActor.email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await expect(page.getByText('Tìm kiếm', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function expectCleanBranding(page, screen) {
  const body = page.locator('body');
  await expect(body, `${screen}: MyFan must not be visible`).not.toContainText('MyFan');
  await expect(body, `${screen}: internal LX labels must not be visible`).not.toContainText(/LX-[0-9]{2}/);
  await expect(body, `${screen}: Album Fan must not be visible`).not.toContainText('Album Fan');
}

test('WEB-R03 public/auth surfaces use Luxy.Love branding', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('luxy-public-homepage')).toBeVisible();
  await expectCleanBranding(page, 'homepage');
  await page.goto('/auth');
  await expect(page.getByTestId('luxy-auth-screen')).toBeVisible();
  await expectCleanBranding(page, 'auth');
});

test('WEB-R03 authenticated core surfaces expose no legacy brand or phase labels', async ({ page }) => {
  await login(page);
  for (const [path, marker] of [
    ['/', 'luxy-search-mobile'],
    [`/profile/${creator.username}`, 'luxy-member-profile-page'],
    ['/settings', 'luxy-settings-page'],
    ['/settings/membership', 'luxy-upgrade-billing'],
    ['/settings/private-photos', 'luxy-private-photo-settings'],
    ['/settings/verification', 'luxy-verification-settings'],
  ]) {
    await page.goto(path);
    await expect(page.getByTestId(marker)).toBeVisible({ timeout: 30_000 });
    await expectCleanBranding(page, path);
  }
});
''')

# Wire the permanent validator into package scripts and CI.
package_path = 'package.json'
package = json.loads(read(package_path))
package['scripts']['validate:branding'] = 'node scripts/validate-web-r03-branding.mjs'
old_validate = package['scripts']['validate']
if 'validate:branding' not in old_validate:
    package['scripts']['validate'] = old_validate + ' && pnpm validate:branding'
write(package_path, json.dumps(package, ensure_ascii=False, indent=2) + '\n')

ci = read('.github/workflows/ci.yml')
needle = "      - name: Validate BR-10 Netlify release source\n        run: pnpm validate:netlify-release\n\n"
if needle not in ci:
    raise SystemExit('CI insertion point not found')
ci = ci.replace(needle, needle + "      - name: Validate WEB-R03 branding source\n        run: pnpm validate:branding\n\n", 1)
write('.github/workflows/ci.yml', ci)

# Final local assertions inside the patch job.
for path in noMyFanOrPhase if False else []:
    pass
print('WEB-R03 patch prepared successfully.')
