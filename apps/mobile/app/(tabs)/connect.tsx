import { luxyBreakpoints } from '@myfan/ui';
import { useWindowDimensions } from 'react-native';
import { LuxySearchDesktop } from '@/components/luxy-search-desktop';
import { LuxySearchMobile } from '@/components/luxy-search-mobile';

export default function ConnectScreen() {
  const { width } = useWindowDimensions();
  return width >= luxyBreakpoints.desktop ? <LuxySearchDesktop /> : <LuxySearchMobile />;
}
