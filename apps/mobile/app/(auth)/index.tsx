import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { startGoogleAuthentication } from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';
import { useAuth } from '@/providers/auth-provider';

export default function AuthHome() {
  const router = useRouter();
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (auth.userId) router.replace('/');
  }, [auth.userId, router]);

  async function handleGooglePress() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await startGoogleAuthentication();
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      title="Chào mừng đến MyFan"
      description="Đăng ký hoặc đăng nhập nhanh bằng tài khoản Google. Luồng Google không yêu cầu OTP của MyFan."
    >
      <Text style={styles.eyebrow}>SOCIAL CREATOR 18+</Text>
      <Text style={styles.heading}>Một chạm để bắt đầu</Text>
      <Text style={styles.copy}>
        Google xác thực danh tính đăng nhập. Người dùng mới sẽ tiếp tục xác nhận ngày sinh, điều khoản và tiêu chuẩn cộng đồng trước khi vào ứng dụng.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tiếp tục với Google"
        disabled={!auth.isConfigured || isSubmitting}
        onPress={handleGooglePress}
        style={({ pressed }) => [
          styles.googleButton,
          pressed && styles.pressed,
          (!auth.isConfigured || isSubmitting) && styles.disabled,
        ]}
      >
        <View style={styles.googleMark}><Text style={styles.googleMarkText}>G</Text></View>
        {isSubmitting ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.googleButtonText}>Tiếp tục với Google</Text>
        )}
      </Pressable>

      {!auth.isConfigured ? (
        <Text style={styles.notice}>Cần thiết lập Supabase publishable key để bật đăng nhập.</Text>
      ) : null}
      {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.securityCard}>
        <Text style={styles.securityTitle}>Không dùng OTP cho Google</Text>
        <Text style={styles.securityCopy}>
          MyFan không gửi mã OTP riêng sau khi Google đăng nhập thành công. Age gate 18+ vẫn là bước bắt buộc và tách biệt.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: '#7557D9', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: '900', marginTop: spacing.sm },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  googleButton: {
    minHeight: 56,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  googleMark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  googleMarkText: { color: '#4285F4', fontSize: 18, fontWeight: '900' },
  googleButtonText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  notice: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: spacing.md },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  securityCard: { marginTop: spacing.xl, borderRadius: 16, padding: spacing.md, backgroundColor: colors.background },
  securityTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  securityCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: spacing.xs },
});
