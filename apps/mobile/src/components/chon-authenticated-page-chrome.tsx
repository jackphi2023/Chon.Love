import { chonBreakpoints, luxyColors } from '@myfan/ui';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ChonSiteFooter } from '@/components/chon-site-footer';
import { LuxyDesktopNavigation } from '@/components/luxy-desktop-navigation';
import { LuxyShellNavigation } from '@/components/luxy-shell-navigation';

export type ChonAuthenticatedFooterMode = 'none' | 'desktop' | 'always';

export function ChonAuthenticatedPageChrome({
  children,
  footer = 'none',
  testID = 'chon-authenticated-page-chrome',
}: PropsWithChildren<{
  footer?: ChonAuthenticatedFooterMode;
  testID?: string;
}>) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= chonBreakpoints.desktop;
  const showFooter = footer === 'always' || (footer === 'desktop' && desktop);

  return (
    <View style={styles.shell} testID={testID}>
      <View testID="chon-authenticated-navigation">
        {desktop ? <LuxyDesktopNavigation /> : <LuxyShellNavigation />}
      </View>
      <View style={styles.content}>{children}</View>
      {showFooter ? (
        <ChonSiteFooter
          compact={!desktop}
          onCommunity={() => router.push('/legal/community-standards')}
          onTerms={() => router.push('/legal/terms')}
          testID="chon-authenticated-footer"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: luxyColors.background, flex: 1, minHeight: 0 },
  content: { backgroundColor: luxyColors.background, flex: 1, minHeight: 0 },
});
