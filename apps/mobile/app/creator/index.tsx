import { Redirect } from 'expo-router';

// Chon.Love Web V1 has no Creator product surface. Keep the historical route as
// a safe redirect so old bookmarks cannot reopen retired legacy flows.
export default function RetiredCreatorRoute() {
  return <Redirect href="/(tabs)/profile" />;
}
