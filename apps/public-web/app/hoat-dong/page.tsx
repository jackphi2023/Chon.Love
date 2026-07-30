import type { Metadata } from 'next';
import Link from 'next/link';
import './activity.css';
import { PublicCreatorActivity } from './public-creator-activity';

export const metadata: Metadata = {
  title: 'Hoạt động Creator — MyFan',
  description: 'Hoạt động công khai đã được duyệt của Creator trên MyFan 18+.',
  robots: { index: false, follow: false },
};

export default function PublicCreatorActivityPage() {
  return (
    <main className="activityPublicPage">
      <section className="activityPublicHero">
        <p className="eyebrow">MYFAN CREATOR ACTIVITY · 18+</p>
        <h1>Hoạt động Creator</h1>
        <p>
          Text và link chỉ hiển thị sau kiểm duyệt. Ảnh khóa chỉ trả preview mờ riêng; original không xuất hiện trong HTML hoặc response của visitor.
        </p>
        <div className="actions">
          <Link className="primary" href="/?intent=login">Đăng nhập MyFan</Link>
          <Link className="secondary" href="/community-standards">Tiêu chuẩn cộng đồng</Link>
        </div>
      </section>
      <section className="activityPublicFeed" aria-label="Hoạt động Creator công khai">
        <PublicCreatorActivity />
      </section>
    </main>
  );
}
