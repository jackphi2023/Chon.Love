import { UserAdmin } from './user-admin';

export default function Page() {
  return (
    <section className="card">
      <h1>Users</h1>
      <p>Tìm kiếm thành viên, xem trạng thái tài khoản và thực hiện các thao tác hỗ trợ có audit. ADM-R01 khóa quyền ở super_admin.</p>
      <UserAdmin />
    </section>
  );
}
