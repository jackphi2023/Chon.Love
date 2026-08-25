import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { chonColors } from '@myfan/ui';
import { ChonBrandIcon } from '@/components/chon-brand-icon';
import { ChonMenuIcon } from '@/components/chon-menu-icon';
import {
  ChonSettingsPage,
  SettingsLinkRow,
  SettingsSection,
} from '@/components/chon-settings-layout';
import { ChonMembershipPrivacySettings } from '@/components/chon-membership-privacy-settings';
import { useAuth } from '@/providers/auth-provider';

export default function SettingsPage() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator accessibilityLabel="Đang tải cài đặt" color={chonColors.primaryRed} size="large" />
      </View>
    );
  }
  if (!auth.userId) return <Redirect href="/(auth)" />;

  return (
    <ChonSettingsPage
      description="Quản lý hồ sơ, quyền riêng tư, xác thực, gói thành viên và tài khoản."
      testID="chon-settings-page"
      title="Cài đặt"
    >
      <ChonMembershipPrivacySettings />

      <SettingsSection
        description="Thông tin xuất hiện trên hồ sơ và các ảnh bạn chủ động giữ riêng tư."
        testID="settings-profile-section"
        title="Hồ sơ"
      >
        <SettingsLinkRow
          description="Tên hiển thị, tiêu đề, vị trí, thông tin cá nhân và mong muốn tìm kiếm."
          icon={<ChonMenuIcon color={chonColors.goldStrong} name="profile" size={18} />}
          onPress={() => router.push('/profile/edit')}
          title="Chỉnh sửa hồ sơ"
        />
        <SettingsLinkRow
          description="Quản lý ảnh bạn chọn giữ riêng tư. Quyền xem phụ thuộc gói thành viên hiện tại."
          icon={<ChonBrandIcon name="profile" size={19} />}
          onPress={() => router.push('/settings/private-photos')}
          status="Riêng tư"
          testID="settings-private-photos"
          title="Ảnh riêng tư"
        />
      </SettingsSection>

      <SettingsSection
        description="Các lớp xác minh tăng độ tin cậy mà không công khai giấy tờ cá nhân."
        testID="settings-verification-section"
        title="Xác thực"
      >
        <SettingsLinkRow
          description="Selfie live, CCCD mặt trước/mặt sau và LinkedIn. Chỉ trạng thái xác thực được công khai."
          icon={<ChonBrandIcon name="profile" size={19} />}
          onPress={() => router.push('/settings/verification')}
          testID="settings-verification"
          title="Xác thực hồ sơ"
        />
      </SettingsSection>

      <SettingsSection
        description="Xem gói hiện tại và quyền lợi của Premium / Diamond."
        testID="settings-membership-section"
        title="Gói dịch vụ"
      >
        <SettingsLinkRow
          description="Xem Free, Premium và Diamond; nâng cấp khi bạn cần thêm quyền kết nối hoặc quyền riêng tư."
          icon={<ChonMenuIcon color={chonColors.goldStrong} name="settings" size={18} />}
          onPress={() => router.push('/settings/membership')}
          status="Xem gói"
          testID="settings-membership"
          title="Gói thành viên"
        />
      </SettingsSection>

      <SettingsSection
        description="Theo dõi quà tặng, số dư và các giao dịch hiện có."
        testID="settings-gifts-section"
        title="Quà tặng & số dư"
      >
        <SettingsLinkRow
          description="Xem lịch sử và nguyên tắc quà tặng. Quà không mở khóa ảnh riêng tư hoặc tạo nghĩa vụ phản hồi."
          icon={<ChonMenuIcon color={chonColors.goldStrong} name="gift" size={18} />}
          onPress={() => router.push('/settings/gifts')}
          testID="settings-gifts"
          title="Cài đặt quà tặng"
        />
        <SettingsLinkRow
          description="Theo dõi số dư và trạng thái các giao dịch hiện có."
          icon={<ChonMenuIcon color={chonColors.goldStrong} name="balance" size={18} />}
          onPress={() => router.push('/(tabs)/balance')}
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
          icon={<ChonMenuIcon color={chonColors.goldStrong} name="logout" size={18} />}
          onPress={() => router.push('/settings/account-deletion')}
          title="Xóa tài khoản"
        />
      </SettingsSection>
    </ChonSettingsPage>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: chonColors.surface, flex: 1, justifyContent: 'center' },
});
