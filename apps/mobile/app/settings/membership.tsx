import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { luxyColors, luxyRadii, luxySpacing } from '@myfan/ui';
import {
  LuxySettingsPage,
  SettingsAction,
  SettingsNotice,
} from '@/components/luxy-settings-layout';
import { useAuth } from '@/providers/auth-provider';

const plans = [
  {
    key: 'free',
    name: 'Free',
    price: '0 đ',
    note: 'Xem hồ sơ và sử dụng Yêu thích. Không gửi tin nhắn và không gửi yêu cầu xem ảnh riêng tư.',
    current: true,
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '1.000.000 đ / tháng',
    note: 'Mở quyền nhắn tin và gửi yêu cầu xem ảnh riêng tư. Quyền xem ảnh vẫn cần chủ hồ sơ chấp thuận.',
    current: false,
  },
  {
    key: 'diamond',
    name: 'Diamond',
    price: '5.000.000 đ / tháng',
    note: 'Bao gồm toàn bộ quyền tương tác Premium và hạng thành viên Diamond cao nhất. Ảnh riêng tư vẫn do chủ hồ sơ kiểm soát.',
    current: false,
  },
] as const;

export default function MembershipSettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  return (
    <LuxySettingsPage
      description="So sánh Free, Premium và Diamond. Billing và entitlement mua gói chưa được kích hoạt trước LX-17/LX-18 để tránh thu phí khi membership engine chưa hoàn chỉnh."
      testID="luxy-membership-settings"
      title="Gói dịch vụ"
    >
      <SettingsNotice title="Trạng thái hiện tại" tone="warning">
        Tài khoản đang được hiển thị ở trạng thái Free trong UI này. Premium và Diamond đã có business entitlement cho Message/Private Photo; thanh toán thực tế chỉ mở sau LX-17/LX-18.
      </SettingsNotice>

      <View style={styles.planGrid}>
        {plans.map((plan) => (
          <View key={plan.key} style={[styles.planCard, plan.current && styles.planCardCurrent]}>
            <View style={styles.planTop}>
              <Text style={styles.planName}>{plan.name}</Text>
              {plan.current ? <Text style={styles.currentBadge}>Gói hiện tại</Text> : null}
            </View>
            <Text style={styles.planPrice}>{plan.price}</Text>
            <Text style={styles.planNote}>{plan.note}</Text>
            <SettingsAction
              disabled={!plan.current}
              label={plan.current ? 'Đang sử dụng' : 'Mở sau LX-18'}
              onPress={() => undefined}
              secondary={plan.current}
            />
          </View>
        ))}
      </View>

      <View style={styles.backRow}>
        <SettingsAction label="Quay lại Cài đặt" onPress={() => router.push('/settings')} secondary />
      </View>
    </LuxySettingsPage>
  );
}

const styles = StyleSheet.create({
  planGrid: { gap: luxySpacing.md, marginBottom: luxySpacing.xl },
  planCard: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.md, borderWidth: 1, gap: luxySpacing.md, padding: luxySpacing.xl },
  planCardCurrent: { borderColor: luxyColors.ink, borderWidth: 1.5 },
  planTop: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.md, justifyContent: 'space-between' },
  planName: { color: luxyColors.text, fontSize: 20, fontWeight: '700' },
  currentBadge: { backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.pill, color: luxyColors.ink, fontSize: 11.5, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  planPrice: { color: luxyColors.text, fontSize: 17, fontWeight: '600' },
  planNote: { color: luxyColors.muted, fontSize: 13.5, lineHeight: 20 },
  backRow: { alignItems: 'flex-start', marginBottom: luxySpacing.xl },
});
