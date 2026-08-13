import { ModerationAdmin } from './moderation-admin';
export default function Page(){return <section className="card"><h1>Báo cáo & kiểm duyệt</h1><p>Xử lý report của thành viên theo mức ưu tiên. Mọi thao tác yêu cầu moderator/super_admin và được ghi audit.</p><ModerationAdmin/></section>}
