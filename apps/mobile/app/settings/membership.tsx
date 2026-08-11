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
    note: 'Tìm kiếm cơ bản, xem hồ sơ và các quyền miễn phí theo entitlement hiện hành.',
    current: true,
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '1.000.000 đ / tháng',
    note: 'Gói thành viên trả phí tiêu chuẩn. Quyền lợi chính xác sẽ được khóa bằng membership engine LX-17.',
    current: false,
  },
  {
    key: 'diamond',
    name: 'Diamond',
    price: '5.000.000 đ / tháng',
    note: 'Gói cao nhất cho trải nghiệm ưu tiên. Không dùng gói thành viên để mở khóa ảnh riêng tư bằng quà tặng.',
    current: false,
  },
] as const;

export default function MembershipSettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  return (
    <LuxySettingsPage
      description="Xem cấu trúc gói Luxy.Love. Billing và entitlement chưa được kích hoạt ở LX-08 để tránh thu phí khi membership engine chưa hoàn chỉnh."
      testID="luxy-membership-settings"
      title="Gói dịch vụ"
    >
      <SettingsNotice title="Trạng thái hiện tại" tone="warning">
        Tài khoản đang được hiển thị ở trạng thái Free trong UI này. Premium và Diamond là cấu hình sản phẩm mục tiêu; nút thanh toán chỉ mở sau LX-17/LX-18.
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
