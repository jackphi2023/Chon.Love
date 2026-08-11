import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { luxyColors, luxySpacing } from '@myfan/ui';
import {
  LuxySettingsPage,
  SettingsLinkRow,
  SettingsNotice,
  SettingsSection,
} from '@/components/luxy-settings-layout';
import { useAuth } from '@/providers/auth-provider';

export default function SettingsPage() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator accessibilityLabel="Đang tải cài đặt" color={luxyColors.ink} size="large" />
      </View>
    );
  }
  if (!auth.userId) return <Redirect href="/(auth)" />;

  return (
    <LuxySettingsPage
      description="Quản lý hồ sơ, quyền riêng tư, xác thực, gói thành viên và các cài đặt liên quan đến quà tặng từ một nơi."
      testID="luxy-settings-page"
      title="Cài đặt"
    >
      <SettingsNotice title="Quyền riêng tư là mặc định">
        Ảnh bảo mật, ảnh xác thực và giấy tờ danh tính không được dùng làm ảnh công khai. Luxy.Love chỉ mở từng luồng theo đúng quyền và mục đích của người dùng.
      </SettingsNotice>

      <SettingsSection
        description="Thông tin xuất hiện trên hồ sơ và cách người khác tìm thấy bạn."
        testID="settings-profile-section"
        title="Hồ sơ & quyền riêng tư"
      >
        <SettingsLinkRow
          description="Tên hiển thị, tiêu đề, vị trí, thông tin cá nhân, nhu cầu kết nối và hiển thị tìm kiếm."
          onPress={() => router.push('/profile/edit')}
          symbol="◎"
          title="Chỉnh sửa hồ sơ"
        />
        <SettingsLinkRow
          description="Chọn và quản lý ảnh chỉ thuộc vùng riêng tư của bạn; không tự động công khai hoặc mở khóa bằng quà tặng."
          onPress={() => router.push('/settings/private-photos')}
          status="Riêng tư"
          symbol="▣"
          testID="settings-private-photos"
          title="Ảnh bảo mật"
        />
      </SettingsSection>

      <SettingsSection
        description="Các lớp xác minh tăng độ tin cậy mà không công khai giấy tờ cá nhân."
        testID="settings-verification-section"
        title="Xác thực"
      >
        <SettingsLinkRow
          description="Tự chụp selfie bằng camera desktop/mobile, chuẩn bị ảnh CCCD mặt trước/mặt sau và theo dõi trạng thái xác minh."
          onPress={() => router.push('/settings/verification')}
          status="Chưa xác minh"
          symbol="✓"
          testID="settings-verification"
          title="Xác thực danh tính"
        />
      </SettingsSection>

      <SettingsSection
        description="Xem gói hiện tại và các quyền lợi dự kiến của Premium / Diamond."
        testID="settings-membership-section"
        title="Gói dịch vụ"
      >
        <SettingsLinkRow
          description="Free, Premium và Diamond; billing/entitlement chỉ kích hoạt khi membership engine hoàn tất."
          onPress={() => router.push('/settings/membership')}
          status="Free"
          symbol="◇"
          testID="settings-membership"
          title="Gói thành viên"
        />
      </SettingsSection>

      <SettingsSection
        description="Quản lý lịch sử quà, số dư và các nguyên tắc nhận/tặng quà."
        testID="settings-gifts-section"
        title="Quà tặng & số dư"
      >
        <SettingsLinkRow
          description="Trung tâm quà tặng, lịch sử giao dịch và các cài đặt sẽ được lưu khi LX-19 mở gift preferences."
          onPress={() => router.push('/settings/gifts')}
          symbol="♡"
          testID="settings-gifts"
          title="Cài đặt quà tặng"
        />
        <SettingsLinkRow
          description="Theo dõi số dư và các trạng thái liên quan đến giao dịch hiện có."
          onPress={() => router.push('/(tabs)/balance')}
          symbol="₫"
          title="Số dư"
        />
      </SettingsSection>

      <SettingsSection
        description="Các thao tác nhạy cảm liên quan đến tài khoản."
        testID="settings-account-section"
        title="Tài khoản & an toàn"
      >
        <SettingsLinkRow
          description="Xóa tài khoản theo quy trình an toàn và thời gian xử lý hiện hành."
          onPress={() => router.push('/settings/account-deletion')}
          symbol="×"
          title="Xóa tài khoản"
        />
      </SettingsSection>

      <Text style={styles.footnote}>
        Luxy.Love không coi quà tặng là điều kiện để mở ảnh riêng tư, nhắn tin hoặc gặp mặt. Xác thực tài chính không phải một phần của hồ sơ xác minh.
      </Text>
    </LuxySettingsPage>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: luxyColors.background, flex: 1, justifyContent: 'center' },
  footnote: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 19, marginBottom: luxySpacing.xl },
});
