export default function Page() {
  return (
    <main>
      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">SOCIAL CREATOR · 18+</p>
          <h1>Cộng đồng của nhà sáng tạo và người hâm mộ</h1>
          <p>Kết nối, theo dõi Creator và ủng hộ bằng quà tặng số trong môi trường riêng tư, có kiểm duyệt.</p>
          <div className="actions">
            <a className="primary" href="#foundation">Khám phá MyFan</a>
            <a className="secondary" href="/community-standards">Tiêu chuẩn an toàn</a>
          </div>
        </div>
        <div className="phone" aria-label="Minh họa giao diện MyFan">
          <div className="phoneHeader"><span>MyFan</span><span>18+</span></div>
          <div className="creatorCard"><div className="avatar">M</div><div><strong>Creator đã duyệt</strong><small>Kết nối cộng đồng an toàn</small></div></div>
          <div className="giftRow"><span>1 ❤️</span><span>10 ❤️</span><span>20 ❤️</span></div>
          <p className="giftNote">Danh mục quà chỉ hiển thị ❤️</p>
        </div>
      </section>
      <section id="foundation" className="section">
        <p className="eyebrow">APP + MOBILE WEB</p>
        <h2>Một nền tảng, cùng nghiệp vụ</h2>
        <div className="grid">
          <article><h3>Ứng dụng</h3><p>Expo React Native cho Android, tương thích iOS và Expo Web để thử nghiệm trên trình duyệt mobile.</p></article>
          <article><h3>Web công khai</h3><p>Next.js cho trang chủ, quà tặng, điều khoản, bảo mật và hồ sơ Creator công khai sau này.</p></article>
          <article><h3>Supabase chung</h3><p>Auth, RLS, Storage, Realtime và RPC dùng chung một project development; không tạo database riêng cho web.</p></article>
        </div>
      </section>
      <section className="section muted">
        <p className="eyebrow">AN TOÀN TỪ NỀN TẢNG</p>
        <h2>Không mở chat trước khi kết bạn</h2>
        <p>Ảnh phải được duyệt; vị trí chỉ hiển thị theo khoảng cách làm mờ; báo cáo, chặn và xóa tài khoản là contract bắt buộc.</p>
      </section>
    </main>
  );
}
