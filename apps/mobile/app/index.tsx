import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getAuthenticatedDestination } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { useAuth } from '@/providers/auth-provider';

export default function SplashScreen() {
  const router = useRouter();
  const { userId, isRestoring } = useAuth();
  const [message, setMessage] = useState('Đang khởi động MyFan…');

  useEffect(() => {
    if (isRestoring) return;
    if (!userId) {
      router.replace('/(auth)');
      return;
    }
    let active = true;
    setMessage('Đang kiểm tra hồ sơ 18+…');
    void getAuthenticatedDestination()
      .then((destination) => {
        if (active) router.replace(destination);
      })
      .catch((error) => {
        logger.error('Unable to resolve authenticated destination', error);
        if (active) router.replace('/(onboarding)');
      });
    return () => {
      active = false;
    };
  }, [isRestoring, router, userId]);

  return (
    <View style={styles.container}>
      <View style={styles.logo}><Text style={styles.logoText}>M</Text></View>
      <Text style={styles.title}>MyFan</Text>
      <Text style={styles.subtitle}>Social Creator 18+</Text>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  logo: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.primary,
    marginBottom: spacing.sm,
  },
  logoText: { color: colors.surface, fontSize: 38, fontWeight: '900' },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.primary, fontSize: 14, fontWeight: '800', marginBottom: spacing.lg },
  message: { color: colors.muted, fontSize: 14, marginTop: spacing.sm },
});
