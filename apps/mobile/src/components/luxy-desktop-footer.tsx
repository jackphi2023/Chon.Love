import { useRouter } from 'expo-router';
import { ChonSiteFooter } from '@/components/chon-site-footer';

/**
 * Compatibility wrapper for older authenticated layouts.
 * New page chrome should use ChonSiteFooter directly.
 */
export function LuxyDesktopFooter() {
  const router = useRouter();
  return (
    <ChonSiteFooter
      compact={false}
      onCommunity={() => router.push('/legal/community-standards')}
      onTerms={() => router.push('/legal/terms')}
      testID="chon-desktop-footer"
    />
  );
}
