import type { Metadata } from 'next';
import Link from 'next/link';
import './activity.css';
import { PublicCreatorActivity } from './public-creator-activity';

export const metadata: Metadata = {
  title: 'Hoạt động Creator — MyFan',
  description: 'Hoạt động công khai đã được duyệt của Creator trên MyFan 18+.',
  robots: { index: false, follow: false },
};

export default async function PublicCreatorActivityPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const normalized = decodeURIComponent(username).replace(/^@/, '').trim();
  return (
    <main className="activityPublicPage">
      <section className="activityPublicHero">
        <p className="eyebrow">MYFAN CREATOR ACTIVITY · 18+</p>
        <h1>Hoạt động của @{normalized}</h1>
        <p>
          Text và link được hiển thị công khai sau kiểm duyệt. Ảnh khóa chỉ trả preview mờ riêng; original không xuất hiện trong HTML hoặc response của visitor.
        </p>
        <div className="actions">
          <Link className="primary" href="/?intent=login">Đăng nhập MyFan</Link>
          <Link className="secondary" href="/community-standards">Tiêu chuẩn cộng đồng</Link>
        </div>
      </section>
      <section className="activityPublicFeed" aria-label={`Hoạt động của ${normalized}`}>
        <PublicCreatorActivity username={normalized} />
      </section>
    </main>
  );
}
