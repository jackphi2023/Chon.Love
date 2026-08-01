import type { Metadata } from 'next';
import Link from 'next/link';
import './activity.css';
import { PublicCreatorActivity } from './public-creator-activity';

export const metadata: Metadata = {
  title: 'Hoạt động Creator — MyFan',
  description: 'Hoạt động Creator trên MyFan 18+, hiển thị theo quyền Công khai, Bạn bè hoặc Fan.',
  robots: { index: false, follow: false },
};

export default function PublicCreatorActivityPage() {
  return (
    <main className="activityPublicPage">
      <section className="activityPublicHero">
        <p className="eyebrow">MYFAN CREATOR ACTIVITY · 18+</p>
        <h1>Hoạt động Creator</h1>
        <p>
          Creator chọn một quyền chung cho toàn bộ bài viết, ảnh, video và Album Hoạt động: Công khai, Bạn bè hoặc Chỉ Fan. MyFan kiểm tra quyền trước khi trả nội dung hay đường dẫn ảnh.
        </p>
        <div className="actions">
          <Link className="primary" href="/?intent=login">Đăng nhập MyFan</Link>
          <Link className="secondary" href="/community-standards">Tiêu chuẩn cộng đồng</Link>
        </div>
      </section>
      <section className="activityPublicFeed" aria-label="Hoạt động Creator theo quyền riêng tư">
        <PublicCreatorActivity />
      </section>
    </main>
  );
}
