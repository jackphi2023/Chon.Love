import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicGiftCatalog } from './gift-catalog-client';

export const metadata: Metadata = {
  title: 'Quà tặng số MyFan — 1 đến 20 ❤️',
  description: 'Khám phá 20 quà tặng số dùng để ủng hộ Creator trong cộng đồng MyFan 18+.',
  alternates: { canonical: '/qua-tang' },
  openGraph: {
    title: 'Quà tặng số MyFan',
    description: '20 quà tặng số, hiển thị minh bạch từ 1 đến 20 ❤️.',
    type: 'website',
  },
};

export default function GiftCatalogPage() {
  return (
    <main className="giftPublicPage">
      <section className="giftPublicHero">
        <p className="eyebrow">MYFAN DIGITAL GIFTS · 18+</p>
        <h1>Cửa hàng quà</h1>
        <p>
          Quà tặng số giúp người hâm mộ thể hiện sự ủng hộ với Creator. Danh mục công khai chỉ hiển thị giá bằng ❤️ và không cho thực hiện giao dịch khi chưa đăng nhập.
        </p>
        <div className="actions">
          <Link className="primary" href="/?intent=register">Tham gia MyFan</Link>
          <Link className="secondary" href="/?intent=login">Đăng nhập ứng dụng</Link>
        </div>
      </section>

      <section aria-labelledby="gift-catalog-title" className="giftPublicSection">
        <div className="giftPublicSectionHeading">
          <div>
            <p className="eyebrow">20 MÓN QUÀ · 1–20 ❤️</p>
            <h2 id="gift-catalog-title">Chọn biểu tượng phù hợp</h2>
          </div>
          <p>Danh mục được đọc trực tiếp từ cùng nguồn dữ liệu với ứng dụng Android và Expo Web.</p>
        </div>
        <PublicGiftCatalog />
      </section>

      <section className="giftPolicySection">
        <div>
          <p className="eyebrow">QUÀ TẶNG SỐ AN TOÀN</p>
          <h2>Ủng hộ cộng đồng, không mua quyền tiếp cận</h2>
        </div>
        <p>
          Quà tặng không bảo đảm gặp mặt, liên hệ riêng, nội dung người lớn hoặc bất kỳ quan hệ tình cảm nào. Mọi tài khoản và nội dung vẫn phải tuân thủ Tiêu chuẩn cộng đồng MyFan.
        </p>
        <Link className="secondary" href="/community-standards">Xem Tiêu chuẩn cộng đồng</Link>
      </section>
    </main>
  );
}
