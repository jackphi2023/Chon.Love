'use client';

export default function GlobalError({ reset }: { readonly reset: () => void }) {
  return (
    <section className="error" role="alert">
      <h1>Trang chưa thể tải</h1>
      <p>Không có token hoặc dữ liệu nhạy cảm nào được ghi vào nhật ký.</p>
      <button type="button" onClick={reset}>Thử lại</button>
    </section>
  );
}
