import { Slot } from 'expo-router';
import { ChonAuthenticatedPageChrome } from '@/components/chon-authenticated-page-chrome';

export default function SettingsLayout() {
  return (
    <ChonAuthenticatedPageChrome footer="always" testID="chon-settings-page-chrome">
      <Slot />
    </ChonAuthenticatedPageChrome>
  );
}
