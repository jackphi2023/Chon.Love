import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/screen';
import { updateCurrentPassword } from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';
import { useAuth } from '@/providers/auth-provider';

export default function ResetPasswordPage() {
  const router = useRouter();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.isRestoring && !auth.userId) router.replace('/(auth)');
  }, [auth.isRestoring, auth.userId, router]);

  async function handleSubmit() {
    setErrorMessage(null);
    if (password !== confirmation) {
      setErrorMessage('Hai lần nhập mật khẩu chưa khớp.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateCurrentPassword(password);
      router.replace('/(auth)');
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (auth.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.copy}>Đang xác minh liên kết khôi phục…</Text>
      </View>
    );
  }

  return (
    <Screen
      title="Đặt mật khẩu mới"
      description="Chọn mật khẩu mới cho tài khoản. Sau khi hoàn tất, tất cả phiên đăng nhập sẽ bị thu hồi."
    >
      <View style={styles.form}>
        <Text style={styles.label}>Mật khẩu mới</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          onChangeText={setPassword}
          placeholder="Ít nhất 10 ký tự"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <Text style={styles.label}>Nhập lại mật khẩu</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          onChangeText={setConfirmation}
          onSubmitEditing={handleSubmit}
          placeholder="Nhập lại mật khẩu mới"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          value={confirmation}
        />
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting || !auth.userId}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            (isSubmitting || !auth.userId) && styles.disabled,
          ]}
        >
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Cập nhật và đăng xuất mọi thiết bị</Text>}
        </Pressable>
      </View>
      {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Yêu cầu mật khẩu</Text>
        <Text style={styles.copy}>
          Dùng ít nhất 10 ký tự. Nên kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt; không tái sử dụng mật khẩu ở dịch vụ khác.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
  form: { gap: spacing.sm },
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
    marginTop: spacing.md,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  noticeCard: { marginTop: spacing.xl, borderRadius: 16, padding: spacing.md, backgroundColor: colors.background },
  noticeTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
