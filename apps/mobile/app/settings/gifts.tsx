import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { luxyColors, luxyRadii, luxySpacing } from '@myfan/ui';
import {
  LuxySettingsPage,
  SettingsAction,
  SettingsLinkRow,
  SettingsNotice,
  SettingsSection,
} from '@/components/luxy-settings-layout';
import { useAuth } from '@/providers/auth-provider';

export default function GiftSettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  return (
    <LuxySettingsPage
      description="Quản lý các luồng liên quan đến quà tặng và số dư mà không trộn quà với quyền riêng tư của hồ sơ."
      testID="luxy-gift-settings"
      title="Cài đặt quà tặng"
    >
      <SettingsNotice title="Nguyên tắc bắt buộc">
        Quà tặng là một giao dịch độc lập. Tặng quà không mở ảnh bảo mật, không tự cấp quyền nhắn tin và không tạo cam kết gặp mặt.
      </SettingsNotice>

      <SettingsSection title="Quản lý quà & số dư" testID="gift-links-section">
        <SettingsLinkRow
          description="Xem quà đã gửi/nhận và các trạng thái hiện có của gift ledger."
          onPress={() => router.push('/(tabs)/gifts')}
          symbol="♡"
          title="Lịch sử quà tặng"
        />
        <SettingsLinkRow
          description="Xem số dư hiện tại và các trạng thái giao dịch liên quan."
          onPress={() => router.push('/(tabs)/balance')}
          symbol="₫"
          title="Số dư"
        />
        <SettingsLinkRow
          description="Đi tới luồng thanh toán VietQR hiện có trên web khi cần nạp/mua theo sản phẩm được cho phép."
          onPress={() => router.push('/payments/vietqr')}
          symbol="QR"
          title="Thanh toán VietQR"
        />
      </SettingsSection>

      <SettingsSection
        description="Các preference này cần persistence + policy ở LX-19; LX-08 chỉ khóa rõ contract UI, không giả lưu local."
        title="Tùy chọn nhận quà"
      >
        <View style={styles.pendingPreferences}>
          <PreferencePreview title="Cho phép nhận quà" description="Sẽ có toggle server-side, áp dụng trước khi tạo giao dịch mới." />
          <PreferencePreview title="Thông báo khi nhận quà" description="Sẽ đi cùng notification preference và push/email policy." />
          <PreferencePreview title="Ẩn hoạt động quà khỏi profile" description="Nếu được triển khai, chỉ ảnh hưởng presentation; không sửa gift ledger bất biến." />
        </View>
      </SettingsSection>

      <View style={styles.policyCard}>
        <Text style={styles.policyTitle}>Ranh giới profile</Text>
        <Text style={styles.policyText}>• Favorites/yêu thích không phải quà tặng.</Text>
        <Text style={styles.policyText}>• Private-photo request là request/accept/decline riêng.</Text>
        <Text style={styles.policyText}>• Gift ledger không được dùng để suy luận quyền truy cập profile.</Text>
      </View>

      <View style={styles.backRow}>
        <SettingsAction label="Quay lại Cài đặt" onPress={() => router.push('/settings')} secondary />
      </View>
    </LuxySettingsPage>
  );
}

function PreferencePreview({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceText}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <View accessibilityLabel="Chưa kích hoạt" style={styles.fakeSwitch}>
        <View style={styles.fakeSwitchKnob} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pendingPreferences: { paddingHorizontal: luxySpacing.lg },
  preferenceRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: luxySpacing.lg, minHeight: 84, paddingVertical: luxySpacing.md },
  preferenceText: { flex: 1 },
  preferenceTitle: { color: luxyColors.text, fontSize: 14.5, fontWeight: '600' },
  preferenceDescription: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  fakeSwitch: { backgroundColor: '#D9DDE1', borderRadius: luxyRadii.pill, height: 28, opacity: 0.7, padding: 3, width: 50 },
  fakeSwitchKnob: { backgroundColor: luxyColors.surface, borderRadius: luxyRadii.pill, height: 22, width: 22 },
  policyCard: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.md, borderWidth: 1, gap: 6, marginBottom: luxySpacing.xl, padding: luxySpacing.lg },
  policyTitle: { color: luxyColors.text, fontSize: 15.5, fontWeight: '700', marginBottom: 3 },
  policyText: { color: luxyColors.muted, fontSize: 13, lineHeight: 19 },
  backRow: { alignItems: 'flex-start', marginBottom: luxySpacing.xl },
});
