import { spacing } from '@myfan/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/screen';

export default function CommunityStandardsScreen() {
  return (
    <Screen
      title="Tiêu chuẩn cộng đồng"
      description="Phiên bản 30/07/2026 · Nội dung công khai và Album Fan đều phải tuân thủ."
    >
      <Text style={styles.heading}>An toàn trẻ em</Text>
      <Text style={styles.body}>Cấm tuyệt đối nội dung, hành vi dụ dỗ, bóc lột hoặc tình dục hóa người dưới 18 tuổi. MyFan chỉ dành cho người trưởng thành.</Text>
      <Text style={styles.heading}>Nội dung tình dục và đổi chác</Text>
      <Text style={styles.body}>Không cho phép khỏa thân, nội dung tình dục, dịch vụ tình dục, sugar dating hoặc đổi quà/❤️ lấy gặp mặt, quan hệ, thông tin liên hệ riêng hay nội dung người lớn.</Text>
      <Text style={styles.heading}>Quấy rối và gian lận</Text>
      <Text style={styles.body}>Cấm đe dọa, theo dõi, cưỡng ép, lừa đảo, mạo danh, phát tán hình ảnh riêng tư không đồng thuận và thao túng tài chính.</Text>
      <Text style={styles.heading}>Nội dung do người dùng tạo</Text>
      <Text style={styles.body}>Ảnh mới có thể ở trạng thái chờ kiểm duyệt. Người dùng có thể báo cáo và chặn; MyFan có thể gỡ nội dung hoặc áp dụng biện pháp với tài khoản vi phạm.</Text>
      <Text style={styles.heading}>Vị trí và liên hệ</Text>
      <Text style={styles.body}>Không công khai tọa độ chính xác. V1 chỉ mở chat sau khi lời mời kết bạn được chấp nhận.</Text>
      <Link href="/(onboarding)" style={styles.link}>Quay lại xác nhận 18+</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '800', marginTop: spacing.md },
  body: { fontSize: 14, lineHeight: 22, marginTop: spacing.xs },
  link: { fontSize: 15, fontWeight: '800', marginTop: spacing.xl },
});
