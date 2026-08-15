import { Text } from 'react-native';
import { PublicLegalShell, publicLegalTextStyles as styles } from '@/components/public-legal-shell';

export default function CommunityStandardsScreen() {
  return (
    <PublicLegalShell
      description="Phiên bản 15/08/2026 · Áp dụng cho hồ sơ, ảnh, tin nhắn, quà tặng và hành vi trên Chọn.love."
      title="Tiêu chuẩn cộng đồng"
    >
      <Text style={styles.heading}>Thành viên thật và xác thực</Text>
      <Text style={styles.body}>Không dùng ảnh hoặc thông tin của người khác để giả danh. Hồ sơ và hình ảnh có thể được yêu cầu xác minh hoặc chờ kiểm duyệt nhằm duy trì một cộng đồng kết nối chân thực.</Text>

      <Text style={styles.heading}>An toàn người dưới 18 tuổi</Text>
      <Text style={styles.body}>Cấm tuyệt đối nội dung, hành vi dụ dỗ, bóc lột hoặc tình dục hóa người dưới 18 tuổi. Chọn.love chỉ dành cho người trưởng thành từ đủ 18 tuổi.</Text>

      <Text style={styles.heading}>Tôn trọng và đồng thuận</Text>
      <Text style={styles.body}>Cấm đe dọa, theo dõi, cưỡng ép, quấy rối, mạo danh, phát tán hình ảnh riêng tư không đồng thuận hoặc tìm cách vượt qua thao tác chặn và các lớp kiểm soát quyền riêng tư.</Text>

      <Text style={styles.heading}>Không giao dịch để đổi lấy sự đồng hành</Text>
      <Text style={styles.body}>Không được đổi tiền, quà hay lợi ích vật chất lấy gặp mặt, tình cảm, quan hệ, sự đồng hành, thông tin liên hệ riêng hoặc nội dung người lớn. Quà tặng trên nền tảng luôn là tự nguyện và không tạo nghĩa vụ cho người nhận.</Text>

      <Text style={styles.heading}>Gian lận và thao túng tài chính</Text>
      <Text style={styles.body}>Cấm lừa đảo, yêu cầu chuyển tiền, dẫn dụ đầu tư, vay mượn hoặc các hình thức thao túng tài chính thông qua mối quan hệ trên nền tảng.</Text>

      <Text style={styles.heading}>Quyền riêng tư và báo cáo</Text>
      <Text style={styles.body}>Không công khai tọa độ chính xác hoặc cố tình vượt quyền xem ảnh riêng tư. Thành viên có thể báo cáo và chặn; Chọn.love có thể áp dụng biện pháp với tài khoản vi phạm.</Text>

      <Text style={styles.note}>Một cộng đồng chất lượng bắt đầu từ thành viên thật, tôn trọng lẫn nhau và những kết nối được xây dựng trên sự tự nguyện.</Text>
    </PublicLegalShell>
  );
}
