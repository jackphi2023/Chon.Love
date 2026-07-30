import { colors, spacing } from '@myfan/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { completeGoogleAuthentication, getAuthenticatedDestination } from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';

export default function GoogleAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const providerError = first(params.error_description) ?? first(params.error);
    if (providerError) {
      setErrorMessage(getReadableAuthError(new Error(providerError)));
      return;
    }
    const code = first(params.code);
    if (!code) {
      setErrorMessage('Google không trả về mã đăng nhập hợp lệ.');
      return;
    }
    let active = true;
    void completeGoogleAuthentication(code)
      .then(() => getAuthenticatedDestination())
      .then((destination) => {
        if (active) router.replace(destination);
      })
      .catch((error) => {
        if (active) setErrorMessage(getReadableAuthError(error));
      });
    return () => {
      active = false;
    };
  }, [params.code, params.error, params.error_description, router]);

  return (
    <View style={styles.container} accessibilityRole="alert">
      {errorMessage ? (
        <>
          <Text style={styles.title}>Chưa thể đăng nhập</Text>
          <Text style={styles.error}>{errorMessage}</Text>
          <Text style={styles.help} onPress={() => router.replace('/(auth)')}>Quay lại đăng nhập</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.title}>Đang hoàn tất đăng nhập Google…</Text>
          <Text style={styles.help}>MyFan không yêu cầu thêm OTP.</Text>
        </>
      )}
    </View>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  error: { color: colors.danger, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  help: { color: colors.primary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
