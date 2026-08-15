import { Text } from 'react-native';
import { PublicLegalShell, publicLegalTextStyles as styles } from '@/components/public-legal-shell';

export default function TermsScreen() {
  return (
    <PublicLegalShell
      description="Phiên bản 15/08/2026 · Áp dụng cho Chọn.love dành cho người từ đủ 18 tuổi."
      title="Điều khoản sử dụng"
    >
      <Text style={styles.heading}>1. Điều kiện sử dụng</Text>
      <Text style={styles.body}>Bạn phải từ đủ 18 tuổi, cung cấp thông tin chính xác, sử dụng hình ảnh hợp pháp của mình và chịu trách nhiệm bảo vệ tài khoản.</Text>

      <Text style={styles.heading}>2. Mục đích nền tảng</Text>
      <Text style={styles.body}>Chọn.love là nền tảng kết nối dành cho người trưởng thành. Gói trả phí chỉ mở quyền sử dụng sản phẩm và không mua quyền gặp mặt, tình cảm, quan hệ cá nhân hay thông tin liên hệ riêng.</Text>

      <Text style={styles.heading}>3. Hồ sơ, xác thực và quyền riêng tư</Text>
      <Text style={styles.body}>Hồ sơ và hình ảnh có thể được kiểm duyệt hoặc yêu cầu xác minh. Ảnh riêng tư chỉ được mở theo quyền truy cập hợp lệ; thao tác chặn luôn có ưu tiên cao hơn.</Text>

      <Text style={styles.heading}>4. Nhắn tin, quà tặng và thanh toán</Text>
      <Text style={styles.body}>Quyền gửi tin nhắn có thể phụ thuộc gói thành viên. Thanh toán Cao cấp hoặc Kim cương là phí dịch vụ nền tảng. Quà tặng là tự nguyện và không tạo nghĩa vụ gặp mặt, phản hồi, đồng hành hay quan hệ cá nhân cho người nhận.</Text>

      <Text style={styles.heading}>5. Hành vi bị cấm</Text>
      <Text style={styles.body}>Không được dùng Chọn.love để lừa đảo, mạo danh, quấy rối, cưỡng ép, phát tán nội dung riêng tư không đồng thuận hoặc trao đổi tiền, quà hay lợi ích vật chất để đổi lấy sự đồng hành hay quan hệ.</Text>

      <Text style={styles.heading}>6. Đình chỉ và xóa tài khoản</Text>
      <Text style={styles.body}>Chọn.love có thể giới hạn hoặc đình chỉ tài khoản vi phạm điều khoản hoặc tiêu chuẩn cộng đồng. Người dùng có quyền yêu cầu xóa tài khoản theo quy trình được cung cấp trong sản phẩm.</Text>

      <Text style={styles.note}>Việc sử dụng Chọn.love đồng nghĩa với việc bạn đồng ý tuân thủ Điều khoản sử dụng và Tiêu chuẩn cộng đồng hiện hành.</Text>
    </PublicLegalShell>
  );
}
