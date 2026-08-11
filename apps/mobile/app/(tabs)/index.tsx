import { luxyBreakpoints } from '@myfan/ui';
import { useWindowDimensions } from 'react-native';
import LegacyDiscoveryScreen from '@/components/legacy-discovery-screen';
import { LuxySearchDesktop } from '@/components/luxy-search-desktop';

export default function Page() {
  const { width } = useWindowDimensions();
  return width >= luxyBreakpoints.desktop ? <LuxySearchDesktop /> : <LegacyDiscoveryScreen />;
}
