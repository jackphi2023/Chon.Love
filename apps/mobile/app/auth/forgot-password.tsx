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
import { requestPasswordReset } from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      title="Khôi phục mật khẩu"
      description="Nhập email tài khoản. Nếu email hợp lệ, Luxy.Love sẽ gửi liên kết đặt lại mật khẩu."
    >
      {sent ? (
        <View style={styles.card}>
          <Text style={styles.title}>Kiểm tra hộp thư</Text>
          <Text style={styles.copy}>
            Yêu cầu đã được tiếp nhận. Vì lý do bảo mật, Luxy.Love luôn hiển thị thông báo này dù email có tồn tại hay không.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Quay lại đăng nhập</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            onSubmitEditing={handleSubmit}
            placeholder="email@example.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={email}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isSubmitting && styles.disabled]}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Gửi liên kết khôi phục</Text>}
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.replace('/(auth)')}>
            <Text style={styles.link}>Quay lại đăng nhập</Text>
          </Pressable>
        </View>
      )}
      {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Lưu ý bảo mật</Text>
        <Text style={styles.noticeCopy}>
          Liên kết chỉ dùng một lần và có thời hạn. Sau khi đặt mật khẩu mới, Luxy.Love sẽ thu hồi toàn bộ phiên đăng nhập để bạn đăng nhập lại.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontWeight: '800' },
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
    minHeight: 52,
    marginTop: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800', textAlign: 'center', paddingVertical: spacing.sm },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  card: { gap: spacing.md },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  noticeCard: { marginTop: spacing.xl, borderRadius: 16, padding: spacing.md, backgroundColor: colors.background },
  noticeTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  noticeCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: spacing.xs },
});
