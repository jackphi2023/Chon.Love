import { colors, spacing } from '@myfan/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  completeAuthentication,
  getAuthenticatedDestination,
  getSafeAuthCallbackDestination,
} from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string | string[];
    next?: string | string[];
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
      setErrorMessage('Liên kết xác thực không có mã hợp lệ.');
      return;
    }
    const safeNext = getSafeAuthCallbackDestination(first(params.next));
    let active = true;
    void completeAuthentication(code)
      .then(async () => safeNext ?? getAuthenticatedDestination())
      .then((destination) => {
        if (active) router.replace(destination);
      })
      .catch((error) => {
        if (active) setErrorMessage(getReadableAuthError(error));
      });
    return () => {
      active = false;
    };
  }, [params.code, params.error, params.error_description, params.next, router]);

  return (
    <View style={styles.container} accessibilityRole="alert">
      {errorMessage ? (
        <>
          <Text style={styles.title}>Chưa thể xác thực</Text>
          <Text style={styles.error}>{errorMessage}</Text>
          <Text style={styles.help} onPress={() => router.replace('/(auth)')}>Quay lại đăng nhập</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.title}>Đang hoàn tất xác thực…</Text>
          <Text style={styles.help}>Vui lòng không đóng trang này.</Text>
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
