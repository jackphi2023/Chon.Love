import { luxyColors } from '@myfan/ui';
import { Redirect, Slot, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ChonAuthenticatedPageChrome } from '@/components/chon-authenticated-page-chrome';
import { useAuth } from '@/providers/auth-provider';

export default function SettingsLayout() {
  const auth = useAuth();
  const pathname = usePathname();

  if (auth.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator accessibilityLabel="Đang tải" accessibilityRole="progressbar" color={luxyColors.ink} size="large" />
      </View>
    );
  }
  if (!auth.userId) return <Redirect href="/(auth)" />;

  return (
    <ChonAuthenticatedPageChrome footer={pathname === '/settings/membership' ? 'none' : 'always'} testID="chon-settings-page-chrome">
      <Slot />
    </ChonAuthenticatedPageChrome>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: luxyColors.background, flex: 1, justifyContent: 'center' },
});
