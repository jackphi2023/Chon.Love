import { ModerationAdmin } from './moderation-admin';

export default function Page() {
  return (
    <section className="card">
      <h1>Báo cáo & kiểm duyệt</h1>
      <p>Duyệt ảnh hồ sơ/avatar và xử lý report thành viên. Mọi thao tác yêu cầu moderator/super_admin và đi qua pipeline kiểm duyệt có audit.</p>
      <ModerationAdmin />
    </section>
  );
}
