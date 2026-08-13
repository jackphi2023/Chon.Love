import { spacing } from '@myfan/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/screen';

export default function TermsScreen() {
  return (
    <Screen title="Điều khoản sử dụng" description="Phiên bản 13/08/2026 · Áp dụng cho Luxy.Love dành cho người từ đủ 18 tuổi.">
      <Text style={styles.heading}>1. Điều kiện sử dụng</Text>
      <Text style={styles.body}>Bạn phải từ đủ 18 tuổi, cung cấp thông tin chính xác, sử dụng hình ảnh hợp pháp của mình và chịu trách nhiệm bảo vệ tài khoản.</Text>
      <Text style={styles.heading}>2. Mục đích nền tảng</Text>
      <Text style={styles.body}>Luxy.Love là nền tảng kết nối dành cho người trưởng thành. Gói trả phí chỉ mở quyền sử dụng sản phẩm và không mua quyền gặp mặt, tình cảm, quan hệ cá nhân hay thông tin liên hệ riêng.</Text>
      <Text style={styles.heading}>3. Hồ sơ, xác thực và quyền riêng tư</Text>
      <Text style={styles.body}>Hồ sơ và hình ảnh có thể được kiểm duyệt hoặc yêu cầu xác minh. Ảnh riêng tư chỉ được mở theo entitlement hợp lệ; block luôn có ưu tiên cao hơn.</Text>
      <Text style={styles.heading}>4. Nhắn tin và thanh toán</Text>
      <Text style={styles.body}>Quyền gửi tin nhắn có thể phụ thuộc gói thành viên. Thanh toán Premium hoặc Diamond là phí dịch vụ nền tảng, không phải khoản chuyển tiền giữa người dùng.</Text>
      <Text style={styles.heading}>5. Đình chỉ và xóa tài khoản</Text>
      <Text style={styles.body}>Luxy.Love có thể giới hạn hoặc đình chỉ tài khoản vi phạm. Người dùng có quyền yêu cầu xóa tài khoản theo quy trình công khai.</Text>
      <Link href="/(onboarding)" style={styles.link}>Quay lại xác nhận 18+</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '800', marginTop: spacing.md },
  body: { fontSize: 14, lineHeight: 22, marginTop: spacing.xs },
  link: { fontSize: 15, fontWeight: '800', marginTop: spacing.xl },
});
