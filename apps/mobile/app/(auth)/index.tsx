import { colors, spacing } from '@myfan/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { useAuth } from '@/providers/auth-provider';

export default function AuthHome() {
  const auth = useAuth();
  return (
    <Screen
      title="MyFan"
      description="Mạng xã hội Social Creator chỉ dành cho người dùng từ 18 tuổi trở lên."
    >
      <Text style={styles.eyebrow}>APP + MOBILE WEB</Text>
      <Text style={styles.heading}>Cùng một giao diện và cùng một nghiệp vụ an toàn</Text>
      <Text style={styles.copy}>
        Kết nối cộng đồng, theo dõi Creator và ủng hộ bằng quà tặng số. Danh mục xã hội chỉ hiển thị ❤️; VNĐ chỉ xuất hiện ở luồng nạp và rút tiền sau này.
      </Text>
      <View style={styles.statusRow}>
        <View style={styles.statusCard}><Text style={styles.statusValue}>18+</Text><Text style={styles.statusLabel}>Age gate bắt buộc</Text></View>
        <View style={styles.statusCard}><Text style={styles.statusValue}>70%</Text><Text style={styles.statusLabel}>Creator reward</Text></View>
        <View style={styles.statusCard}><Text style={styles.statusValue}>RLS</Text><Text style={styles.statusLabel}>Bảo vệ dữ liệu</Text></View>
      </View>
      <Text style={styles.environment}>
        Supabase: {auth.isConfigured ? 'đã cấu hình' : 'chưa có publishable key'} · Session: {auth.isRestoring ? 'đang khôi phục' : auth.userId ? 'đã đăng nhập' : 'chưa đăng nhập'}
      </Text>
      <Link href="/(onboarding)" asChild>
        <Text accessibilityRole="link" style={styles.link}>Xem luồng onboarding 18+ →</Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: '#7557D9', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: colors.text, fontSize: 22, lineHeight: 30, fontWeight: '800', marginTop: spacing.sm },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  statusCard: { minWidth: 96, flexGrow: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.md, backgroundColor: colors.background },
  statusValue: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  statusLabel: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  environment: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: spacing.lg },
  link: { color: colors.primary, fontSize: 16, fontWeight: '700', marginTop: spacing.md },
});
