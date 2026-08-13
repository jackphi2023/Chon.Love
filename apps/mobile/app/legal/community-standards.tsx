import { spacing } from '@myfan/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/screen';

export default function CommunityStandardsScreen() {
  return (
    <Screen title="Tiêu chuẩn cộng đồng" description="Phiên bản 13/08/2026 · Áp dụng cho hồ sơ, ảnh, tin nhắn và hành vi trên Luxy.Love.">
      <Text style={styles.heading}>An toàn người dưới 18 tuổi</Text>
      <Text style={styles.body}>Cấm tuyệt đối nội dung, hành vi dụ dỗ, bóc lột hoặc tình dục hóa người dưới 18 tuổi. Luxy.Love chỉ dành cho người trưởng thành.</Text>
      <Text style={styles.heading}>Nội dung tình dục và mua bán quan hệ</Text>
      <Text style={styles.body}>Không cho phép khỏa thân, nội dung tình dục, dịch vụ tình dục hoặc đổi tiền, quà hay lợi ích vật chất lấy gặp mặt, quan hệ, thông tin liên hệ riêng hay nội dung người lớn.</Text>
      <Text style={styles.heading}>Quấy rối và gian lận</Text>
      <Text style={styles.body}>Cấm đe dọa, theo dõi, cưỡng ép, lừa đảo, mạo danh, phát tán hình ảnh riêng tư không đồng thuận và thao túng tài chính.</Text>
      <Text style={styles.heading}>Hồ sơ và hình ảnh xác thực</Text>
      <Text style={styles.body}>Không dùng ảnh của người khác để giả danh. Ảnh mới có thể chờ kiểm duyệt; người dùng có thể báo cáo và chặn, và Luxy.Love có thể áp dụng biện pháp với tài khoản vi phạm.</Text>
      <Text style={styles.heading}>Vị trí và quyền riêng tư</Text>
      <Text style={styles.body}>Không công khai tọa độ chính xác và không tìm cách vượt qua quyền xem ảnh riêng tư, block hoặc các lớp kiểm soát truy cập khác.</Text>
      <Link href="/(onboarding)" style={styles.link}>Quay lại xác nhận 18+</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '800', marginTop: spacing.md },
  body: { fontSize: 14, lineHeight: 22, marginTop: spacing.xs },
  link: { fontSize: 15, fontWeight: '800', marginTop: spacing.xl },
});
