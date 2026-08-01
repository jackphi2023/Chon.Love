import { spacing } from '@myfan/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/screen';

export default function TermsScreen() {
  return (
    <Screen
      title="Điều khoản sử dụng"
      description="Phiên bản 30/07/2026 · Áp dụng cho MyFan Social Creator 18+."
    >
      <Text style={styles.heading}>1. Điều kiện sử dụng</Text>
      <Text style={styles.body}>Bạn phải từ đủ 18 tuổi, cung cấp thông tin chính xác và chịu trách nhiệm bảo vệ tài khoản Google dùng để đăng nhập.</Text>
      <Text style={styles.heading}>2. Mục đích nền tảng</Text>
      <Text style={styles.body}>MyFan là mạng xã hội Creator và Fan. MyFan không phải dịch vụ hẹn hò có trả phí, chuyển tiền ngang hàng hoặc nơi đổi quà lấy gặp mặt, tình cảm hay nội dung người lớn.</Text>
      <Text style={styles.heading}>3. Nội dung và hành vi</Text>
      <Text style={styles.body}>Nội dung có thể được kiểm duyệt. Người dùng phải tôn trọng quyền riêng tư, bản quyền, an toàn cộng đồng và các quyết định thực thi hợp lệ.</Text>
      <Text style={styles.heading}>4. ❤️ và quà tặng số</Text>
      <Text style={styles.body}>❤️ là giá trị ảo dùng trong MyFan. Số dư ❤️ đã mua không phải tiền gửi, không chuyển trực tiếp thành tiền mặt và không phải khoản chuyển tiền giữa người dùng.</Text>
      <Text style={styles.heading}>5. Đình chỉ và xóa tài khoản</Text>
      <Text style={styles.body}>MyFan có thể giới hạn hoặc đình chỉ tài khoản vi phạm. Người dùng có quyền yêu cầu xóa tài khoản theo quy trình công khai.</Text>
      <Link href="/(onboarding)" style={styles.link}>Quay lại xác nhận 18+</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '800', marginTop: spacing.md },
  body: { fontSize: 14, lineHeight: 22, marginTop: spacing.xs },
  link: { fontSize: 15, fontWeight: '800', marginTop: spacing.xl },
});
