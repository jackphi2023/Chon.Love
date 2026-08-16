export function getReadableLocationError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('permission_denied')) {
    return 'Bạn chưa cho phép Chon.Love dùng vị trí. Danh sách Gần đây vẫn hiển thị nhưng không có khoảng cách.';
  }
  if (message.includes('timeout')) {
    return 'Không lấy được vị trí kịp thời. Hãy kiểm tra GPS hoặc thử lại.';
  }
  if (message.includes('accuracy_too_low')) {
    return 'Độ chính xác vị trí chưa đủ để hiển thị khoảng cách.';
  }
  if (message.includes('rate_limited')) {
    return 'Vị trí vừa được cập nhật. Hãy thử lại sau ít phút.';
  }
  if (message.includes('not_supported')) {
    return 'Thiết bị hoặc trình duyệt này không hỗ trợ định vị.';
  }
  return 'Không thể cập nhật vị trí. Danh sách Gần đây vẫn có thể sử dụng.';
}
