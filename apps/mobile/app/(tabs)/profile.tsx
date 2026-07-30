import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Placeholder, Screen } from '@/components/screen';
import { getReadableAuthError } from '@/lib/auth-routing';
import { useAuth } from '@/providers/auth-provider';

export default function Page() {
  const router = useRouter();
  const auth = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    setErrorMessage(null);
    try {
      await auth.signOut();
      router.replace('/(auth)');
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    }
  }

  return (
    <Screen title="Hồ sơ của tôi" description="Ảnh công khai và Album Fan chỉ hiển thị sau khi được kiểm duyệt.">
      <Text style={styles.email}>{auth.email ?? 'Tài khoản Google'}</Text>
      <Placeholder text="Thông tin hồ sơ chi tiết sẽ được triển khai ở Phiên 15." />
      <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.button}>
        <Text style={styles.buttonText}>Đăng xuất</Text>
      </Pressable>
      {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: { color: colors.muted, fontSize: 14, marginBottom: spacing.md },
  button: { minHeight: 48, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.md },
});
