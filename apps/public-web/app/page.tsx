import type { Metadata } from 'next';
import './home.css';
import { HomepagePublicContent } from './homepage-content';

export const metadata: Metadata = {
  title: 'MyFan — Cộng đồng của nhà sáng tạo và người hâm mộ',
  description:
    'MyFan là mạng xã hội Social Creator 18+, nơi người dùng khám phá Creator, kết nối cộng đồng và ủng hộ bằng quà tặng số trong môi trường có kiểm duyệt.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'MyFan — Cộng đồng của nhà sáng tạo và người hâm mộ',
    description:
      'Khám phá Creator, chia sẻ Hoạt động và ủng hộ cộng đồng bằng quà tặng số an toàn trên MyFan.',
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'MyFan — Social Creator 18+',
    description: 'Cộng đồng của nhà sáng tạo và người hâm mộ.',
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MyFan',
  description:
    'Mạng xã hội Social Creator dành cho người dùng từ đủ 18 tuổi, có kiểm duyệt nội dung và công cụ an toàn cộng đồng.',
  inLanguage: 'vi-VN',
  audience: {
    '@type': 'PeopleAudience',
    requiredMinAge: 18,
  },
};

export default function Page() {
  return (
    <main className="homePage">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />

      <section className="homeHero" aria-labelledby="home-title">
        <div className="homeHeroGlow homeHeroGlowOne" aria-hidden="true" />
        <div className="homeHeroGlow homeHeroGlowTwo" aria-hidden="true" />
        <div className="homeHeroCopy">
          <span className="homePill">♥ SOCIAL CREATOR · CHỈ DÀNH CHO NGƯỜI TỪ 18 TUỔI</span>
          <h1 id="home-title">
            Cộng đồng của
            <br />
            <span>nhà sáng tạo</span>
            <br />
            và người hâm mộ
          </h1>
          <p>
            Khám phá Creator, theo dõi Hoạt động, kết nối với cộng đồng và gửi quà tặng số
            trong một không gian riêng tư, an toàn và có kiểm duyệt.
          </p>
          <div className="homeHeroActions">
            <a className="homePrimaryButton" href="/?intent=signup">
              Tham gia MyFan
            </a>
            <a className="homeGhostButton" href="#creators">
              Khám phá Creator
            </a>
          </div>
          <p className="homeHeroNote">
            Quà tặng không mua quyền gặp mặt, thông tin liên hệ riêng, quan hệ cá nhân hoặc
            nội dung người lớn.
          </p>
        </div>

        <div className="homePhone" aria-label="Minh họa giao diện Hoạt động MyFan">
          <div className="homePhoneTop">
            <span className="homePhoneBrand">MyFan</span>
            <span className="homePhoneAge">18+</span>
          </div>
          <article className="homePhonePost">
            <header>
              <span className="homePhoneAvatar">M</span>
              <div>
                <strong>Creator đã duyệt</strong>
                <small>@creator · vừa đăng</small>
              </div>
              <span className="homePhoneCheck">✓</span>
            </header>
            <p>Chia sẻ khoảnh khắc mới với cộng đồng MyFan.</p>
            <div className="homePhoneMedia">
              <span>Hoạt động có ảnh đã kiểm duyệt</span>
            </div>
            <footer>
              <span>♡ Kết nối</span>
              <span>↗ Chia sẻ</span>
            </footer>
          </article>
          <div className="homePhoneGifts">
            <span>🌹 5 ❤️</span>
            <span>🧸 7 ❤️</span>
            <span>👑 20 ❤️</span>
          </div>
        </div>
      </section>

      <section className="homeTrustBar" aria-label="Nguyên tắc chính của MyFan">
        <div>
          <strong>18+</strong>
          <span>Chỉ dành cho người trưởng thành</span>
        </div>
        <div>
          <strong>70%</strong>
          <span>Phần thưởng dành cho Creator theo nghiệp vụ</span>
        </div>
        <div>
          <strong>✓</strong>
          <span>Nội dung và tài khoản có quy trình kiểm duyệt</span>
        </div>
      </section>

      <section className="homeSection homeIntro" id="about" aria-labelledby="about-title">
        <div className="homeSectionHeading">
          <div>
            <p className="homeEyebrow">MYFAN LÀ GÌ?</p>
            <h2 id="about-title">Một nơi để Creator xây dựng cộng đồng lâu dài</h2>
          </div>
          <p>
            MyFan kết hợp hồ sơ Creator, Hoạt động, Album, kết bạn, chat sau khi kết bạn và
            quà tặng số trên cùng một nền tảng dành cho người trưởng thành.
          </p>
        </div>
        <div className="homeFeatureGrid">
          <article>
            <span className="homeFeatureIcon">✦</span>
            <h3>Khám phá phù hợp</h3>
            <p>
              Tìm Creator theo tỉnh/thành và khoảng cách gần đúng, không công khai tọa độ
              chính xác.
            </p>
          </article>
          <article>
            <span className="homeFeatureIcon">◎</span>
            <h3>Kết nối có kiểm soát</h3>
            <p>
              Người dùng chỉ chat sau khi hai bên trở thành bạn bè; chặn và báo cáo luôn dễ
              tiếp cận.
            </p>
          </article>
          <article>
            <span className="homeFeatureIcon">♥</span>
            <h3>Ủng hộ bằng quà số</h3>
            <p>
              Danh mục 20 quà hiển thị bằng ❤️, với giao dịch và quyền Fan được xác minh tại
              server.
            </p>
          </article>
        </div>
      </section>

      <section className="homeSection homeBenefits" aria-labelledby="benefits-title">
        <div className="homeSectionHeading homeSectionHeadingLight">
          <div>
            <p className="homeEyebrow homeEyebrowLight">CÙNG PHÁT TRIỂN</p>
            <h2 id="benefits-title">Giá trị cho Creator và người hâm mộ</h2>
          </div>
          <p>
            Quyền lợi cộng đồng không bao gồm đổi quà lấy gặp mặt, tình cảm, dịch vụ hoặc nội
            dung tình dục.
          </p>
        </div>
        <div className="homeAudienceGrid">
          <article>
            <span className="homeAudienceLabel">DÀNH CHO CREATOR</span>
            <h3>Xây dựng cộng đồng theo cách của bạn</h3>
            <ul>
              <li>Đăng Hoạt động dạng chữ, một ảnh hoặc liên kết video hợp lệ.</li>
              <li>Chọn quyền xem Công khai, Bạn bè hoặc Chỉ Fan.</li>
              <li>Nhận 70% phần thưởng Creator theo quy định và thời gian giữ.</li>
              <li>Rút tiền sau KYC, kiểm tra rủi ro và phê duyệt thủ công.</li>
            </ul>
          </article>
          <article>
            <span className="homeAudienceLabel">DÀNH CHO NGƯỜI HÂM MỘ</span>
            <h3>Khám phá, kết nối và ủng hộ an toàn</h3>
            <ul>
              <li>Theo dõi Hoạt động công khai của Creator đã duyệt.</li>
              <li>Kết bạn trước khi trò chuyện riêng.</li>
              <li>Tặng quà số và tích lũy tiến độ Fan minh bạch.</li>
              <li>Chủ động kiểm soát vị trí, chặn, báo cáo và xóa tài khoản.</li>
            </ul>
          </article>
        </div>
      </section>

      <HomepagePublicContent />

      <section className="homeSection homeSafety" id="safety" aria-labelledby="safety-title">
        <div className="homeSafetyCopy">
          <p className="homeEyebrow">RIÊNG TƯ VÀ AN TOÀN</p>
          <h2 id="safety-title">An toàn được xây vào từng luồng sử dụng</h2>
          <p>
            MyFan tách dữ liệu hồ sơ công khai khỏi ngày sinh, tọa độ chính xác, KYC, ngân
            hàng và dữ liệu kiểm duyệt nội bộ. Quyền xem nội dung được kiểm tra tại server,
            không dựa vào trạng thái giao diện.
          </p>
          <a className="homeTextLink" href="/community-standards">
            Đọc Tiêu chuẩn cộng đồng ›
          </a>
        </div>
        <ol className="homeSafetySteps">
          <li>
            <span>01</span>
            <div>
              <strong>Xác nhận đủ 18 tuổi</strong>
              <p>Ngày sinh được kiểm tra trước khi người dùng hoàn tất onboarding.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Kiểm duyệt nội dung</strong>
              <p>Creator, Hoạt động và ảnh phải đạt điều kiện phù hợp trước khi công khai.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Quyền riêng tư theo quan hệ</strong>
              <p>Creator có thể giới hạn toàn bộ Hoạt động cho Công khai, Bạn bè hoặc Fan.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="homeFinalCta" id="join" aria-labelledby="join-title">
        <div>
          <p className="homeEyebrow homeEyebrowLight">BẮT ĐẦU VỚI MYFAN</p>
          <h2 id="join-title">Tham gia cộng đồng Social Creator 18+</h2>
          <p>
            Tạo hồ sơ, khám phá Creator và xây dựng các kết nối có ý nghĩa trong một môi
            trường có kiểm duyệt.
          </p>
        </div>
        <div className="homeFinalActions">
          <a className="homeWhiteButton" href="/?intent=signup">
            Tham gia ngay
          </a>
          <a className="homeOutlineLightButton" href="/?intent=login">
            Đăng nhập
          </a>
        </div>
      </section>
    </main>
  );
}
