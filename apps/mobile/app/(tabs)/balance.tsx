import { formatHeartUnitBalance, getMyAvailableHeartUnits, giftCatalogQueryKeys } from '@myfan/supabase';
import { colors, luxyBreakpoints, luxyColors, luxyRadii, spacing } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Screen } from '@/components/screen';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function Page() {
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const { width } = useWindowDimensions();
  const desktop = width >= luxyBreakpoints.desktop;
  const balanceQuery = useQuery({
    queryKey: giftCatalogQueryKeys.balance(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyAvailableHeartUnits(client);
    },
  });

  return (
    <Screen
      title="Số dư ❤️"
      description="Quản lý số ❤️ dùng cho quà tặng. Số dư quà tặng tách biệt với các khoản chi trả và không thể rút trực tiếp thành tiền."
    >
      <View style={[styles.topGrid, desktop && styles.topGridDesktop]}>
        <View style={[styles.balanceCard, desktop && styles.balanceCardDesktop]}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.heartIcon}>♥</Text>
            <Text style={styles.label}>SỐ DƯ CÓ THỂ DÙNG</Text>
          </View>
          {balanceQuery.isLoading ? (
            <ActivityIndicator color={luxyColors.actionRed} size="large" />
          ) : balanceQuery.error ? (
            <Text accessibilityRole="alert" style={styles.error}>Không thể tải số dư.</Text>
          ) : (
            <Text style={styles.value}>{formatHeartUnitBalance(balanceQuery.data ?? 0)}</Text>
          )}
          <Text style={styles.balanceHint}>Dùng để gửi quà cho thành viên khác khi tính năng quà được mở.</Text>
          <Pressable accessibilityRole="button" onPress={() => void balanceQuery.refetch()} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
            <Text style={styles.refreshText}>↻ Cập nhật số dư</Text>
          </Pressable>
        </View>

        {Platform.OS === 'web' ? (
          <View style={[styles.paymentCard, desktop && styles.paymentCardDesktop]}>
            <View style={styles.paymentIcon}><Text style={styles.paymentIconText}>QR</Text></View>
            <View style={styles.paymentCopy}>
              <Text style={styles.paymentTitle}>Nạp ❤️ bằng VietQR</Text>
              <Text style={styles.paymentDescription}>
                Chọn gói ❤️, quét mã VietQR tự động điền số tiền và nội dung chuyển khoản. Số dư chỉ tăng sau khi server xác minh giao dịch.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/payments/vietqr')}
              style={({ pressed }) => [styles.primaryButton, desktop && styles.primaryButtonDesktop, pressed && styles.primaryButtonPressed]}
            >
              <Text style={styles.primaryButtonText}>Tạo mã QR</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.paymentCard, desktop && styles.paymentCardDesktop]}>
            <Text style={styles.paymentTitle}>Google Play Billing chưa mở</Text>
            <Text style={styles.paymentDescription}>
              Thanh toán VietQR chỉ hiển thị trên web. Android sẽ dùng Google Play Billing sau khi hoàn tất kiểm thử cửa hàng.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.noticeCard}>
        <View style={styles.noticeIcon}><Text style={styles.noticeIconText}>i</Text></View>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Nguyên tắc ghi nhận an toàn</Text>
          <Text style={styles.noticeText}>
            ❤️ chỉ được cộng sau khi server xác minh giao dịch. Ảnh chụp chuyển khoản hoặc thao tác “Tôi đã chuyển khoản” không tự làm tăng số dư.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topGrid: { gap: spacing.md },
  topGridDesktop: { alignItems: 'stretch', flexDirection: 'row', gap: 20 },
  balanceCard: {
    backgroundColor: luxyColors.brandRedSurface,
    borderColor: '#F6B8B8',
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  balanceCardDesktop: { flex: 0.9, minHeight: 260, padding: 28 },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  heartIcon: { color: luxyColors.brandGoldStrong, fontSize: 17, fontWeight: '800' },
  label: { color: luxyColors.actionRed, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  value: { color: luxyColors.charcoal, fontSize: 38, fontWeight: '900', marginTop: 4 },
  balanceHint: { color: luxyColors.muted, fontSize: 13, lineHeight: 20, maxWidth: 360 },
  error: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  refreshButton: {
    alignSelf: 'flex-start',
    backgroundColor: luxyColors.surface,
    borderColor: '#F6B8B8',
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  refreshText: { color: luxyColors.actionRed, fontSize: 12.5, fontWeight: '800' },
  paymentCard: {
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  paymentCardDesktop: { flex: 1.1, minHeight: 260, padding: 28 },
  paymentIcon: {
    alignItems: 'center',
    backgroundColor: luxyColors.brandWarmSurface,
    borderColor: luxyColors.brandGold,
    borderRadius: 15,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  paymentIconText: { color: luxyColors.brandGoldStrong, fontSize: 16, fontWeight: '900' },
  paymentCopy: { gap: 6 },
  paymentTitle: { color: luxyColors.charcoal, fontSize: 20, fontWeight: '800' },
  paymentDescription: { color: luxyColors.muted, fontSize: 13.5, lineHeight: 21, maxWidth: 560 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.actionRed,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonDesktop: { alignSelf: 'flex-start', minWidth: 168, paddingHorizontal: 24 },
  primaryButtonPressed: { backgroundColor: '#A81415', opacity: 0.92 },
  primaryButtonText: { color: luxyColors.surface, fontSize: 14, fontWeight: '800' },
  noticeCard: {
    alignItems: 'flex-start',
    backgroundColor: '#F4F9FF',
    borderColor: '#B9D8F4',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  noticeIcon: {
    alignItems: 'center',
    borderColor: luxyColors.brandBlue,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  noticeIconText: { color: luxyColors.brandBlue, fontSize: 13, fontWeight: '900' },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { color: luxyColors.brandBlue, fontSize: 14, fontWeight: '800' },
  noticeText: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 19 },
  pressed: { opacity: 0.76 },
});
