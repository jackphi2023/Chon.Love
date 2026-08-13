import type { Metadata } from 'next';
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
