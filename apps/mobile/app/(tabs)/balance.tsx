import { getMyAvailableHeartUnits, formatHeartUnitBalance, giftCatalogQueryKeys } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function Page() {
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
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
      description="❤️ mua để dùng trong MyFan được tách khỏi Thu nhập Creator và không thể rút thành tiền."
    >
      <View style={styles.balanceCard}>
        <Text style={styles.label}>Số dư có thể dùng</Text>
        {balanceQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : balanceQuery.error ? (
          <Text accessibilityRole="alert" style={styles.error}>Không thể tải số dư.</Text>
        ) : (
          <Text style={styles.value}>{formatHeartUnitBalance(balanceQuery.data ?? 0)}</Text>
        )}
        <Pressable accessibilityRole="button" onPress={() => void balanceQuery.refetch()} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Cập nhật số dư</Text>
        </Pressable>
      </View>

      {Platform.OS === 'web' ? (
        <View style={styles.paymentCard}>
          <View style={styles.paymentIcon}><Text style={styles.paymentIconText}>QR</Text></View>
          <View style={styles.paymentCopy}>
            <Text style={styles.paymentTitle}>Nạp ❤️ bằng VietQR</Text>
            <Text style={styles.paymentDescription}>
              Chọn gói ❤️, quét mã VietQR tự động điền số tiền và nội dung chuyển khoản.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/payments/vietqr')}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Tạo mã QR</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Google Play Billing chưa mở</Text>
          <Text style={styles.paymentDescription}>
            Thanh toán VietQR chỉ hiển thị trên mobile web. Android sẽ dùng Google Play Billing sau khi hoàn tất kiểm thử cửa hàng.
          </Text>
        </View>
      )}

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Nguyên tắc ghi nhận</Text>
        <Text style={styles.noticeText}>
          ❤️ chỉ được cộng sau khi server xác minh giao dịch. Ảnh chụp chuyển khoản hoặc thao tác “Tôi đã chuyển khoản” không tự làm tăng số dư.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: { borderRadius: 22, borderWidth: 1, borderColor: '#FBCFE8', backgroundColor: '#FFF1F2', padding: spacing.lg, gap: spacing.sm },
  label: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  value: { color: colors.primary, fontSize: 34, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  refreshButton: { alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, borderColor: '#FBCFE8', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8 },
  refreshText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  paymentCard: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  paymentIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#FCE7F3' },
  paymentIconText: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  paymentCopy: { gap: 6 },
  paymentTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  paymentDescription: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  noticeCard: { borderRadius: 18, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', padding: spacing.md, gap: 5 },
  noticeTitle: { color: '#92400E', fontSize: 14, fontWeight: '900' },
  noticeText: { color: '#92400E', fontSize: 12, lineHeight: 18 },
});
