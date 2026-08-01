'use client';

import { useEffect, useRef } from 'react';

export default function GlobalError({ reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="public-error-title" className="error" role="alert">
      <h1 id="public-error-title" ref={headingRef} tabIndex={-1}>Trang chưa thể tải</h1>
      <p>Vui lòng thử lại. Không có token hoặc dữ liệu nhạy cảm nào được ghi vào nhật ký.</p>
      <button aria-describedby="public-error-title" type="button" onClick={reset}>Thử lại</button>
    </section>
  );
}
