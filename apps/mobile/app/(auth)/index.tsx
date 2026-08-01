import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/screen';
import { signInWithEmailPassword, startGoogleAuthentication } from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';
import { useAuth } from '@/providers/auth-provider';

type SubmitMode = 'email' | 'google' | null;

const googleAuthEnabled = process.env.EXPO_PUBLIC_FEATURE_GOOGLE_AUTH === 'true';

export default function AuthHome() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitMode, setSubmitMode] = useState<SubmitMode>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleEmailPress() {
    setErrorMessage(null);
    setSubmitMode('email');
    try {
      const destination = await signInWithEmailPassword(email, password);
      router.replace(destination);
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleGooglePress() {
    if (!googleAuthEnabled) return;
    setErrorMessage(null);
    setSubmitMode('google');
    try {
      await startGoogleAuthentication();
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
      setSubmitMode(null);
    }
  }

  const disabled = !auth.isConfigured || submitMode !== null;
  const googleDisabled = disabled || !googleAuthEnabled;

  return (
    <Screen
      title="Chào mừng đến MyFan"
      description="Đăng nhập bằng email và mật khẩu hoặc tiếp tục với Google. Age gate 18+ luôn là bước bắt buộc."
    >
      <Text style={styles.eyebrow}>SOCIAL CREATOR 18+</Text>
      <Text style={styles.heading}>Đăng nhập Beta</Text>
      <Text style={styles.copy}>
        Tài khoản Beta dùng thông tin được cấp riêng. MyFan không hiển thị hoặc lưu mật khẩu trong giao diện và source code.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          accessibilityHint="Nhập địa chỉ email đã đăng ký với MyFan"
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="email@example.com"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={email}
        />
        <Text style={styles.label}>Mật khẩu</Text>
        <TextInput
          accessibilityHint="Nhập mật khẩu của tài khoản MyFan"
          accessibilityLabel="Mật khẩu"
          autoCapitalize="none"
          autoComplete="current-password"
          onChangeText={setPassword}
          onSubmitEditing={handleEmailPress}
          placeholder="Nhập mật khẩu"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable
          accessibilityHint="Đăng nhập và tiếp tục đến khu vực được phép"
          accessibilityLabel="Đăng nhập bằng email"
          accessibilityRole="button"
          accessibilityState={{ disabled, busy: submitMode === 'email' }}
          disabled={disabled}
          onPress={handleEmailPress}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, disabled && styles.disabled]}
        >
          {submitMode === 'email' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Đăng nhập bằng email</Text>
          )}
        </Pressable>

        <Pressable accessibilityHint="Mở quy trình đặt lại mật khẩu" accessibilityLabel="Quên mật khẩu" accessibilityRole="link" onPress={() => router.push('/auth/forgot-password')} style={styles.linkButton}>
          <Text style={styles.link}>Quên mật khẩu?</Text>
        </Pressable>
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>hoặc</Text>
        <View style={styles.divider} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tiếp tục với Google"
        accessibilityHint={googleAuthEnabled ? 'Mở quy trình đăng nhập Google an toàn' : 'Đăng nhập Google đang tạm tắt'}
        accessibilityState={{ disabled: googleDisabled, busy: submitMode === 'google' }}
        disabled={googleDisabled}
        onPress={handleGooglePress}
        style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, googleDisabled && styles.disabled]}
      >
        <View style={styles.googleMark}><Text style={styles.googleMarkText}>G</Text></View>
        {submitMode === 'google' ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.googleButtonText}>Tiếp tục với Google</Text>
        )}
      </Pressable>

      {!googleAuthEnabled ? (
        <Text style={styles.notice}>
          Đăng nhập Google đang tạm tắt cho đến khi Google OAuth được bật trong Supabase. Bạn vẫn có thể đăng nhập bằng email và mật khẩu.
        </Text>
      ) : null}
      {!auth.isConfigured ? (
        <Text style={styles.notice}>Cần thiết lập Supabase publishable key để bật đăng nhập.</Text>
      ) : null}
      {errorMessage ? <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.securityCard}>
        <Text style={styles.securityTitle}>Bảo vệ phiên đăng nhập</Text>
        <Text style={styles.securityCopy}>
          Đăng xuất mặc định thu hồi toàn bộ refresh session của tài khoản. Access token đã cấp chỉ còn hiệu lực đến thời điểm hết hạn ngắn của JWT.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: '#7557D9', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: '900', marginTop: spacing.sm },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  form: { marginTop: spacing.xl, gap: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: spacing.xs },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 54,
    marginTop: spacing.sm,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: 13 },
  googleButton: {
    minHeight: 56,
    marginTop: spacing.md,
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
