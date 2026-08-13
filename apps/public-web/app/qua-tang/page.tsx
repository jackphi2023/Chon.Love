import type { Metadata } from 'next';
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
