import { Redirect } from 'expo-router';

// Chon.Love Web V1 does not expose Activity. Historical backend data stays
// untouched for migration safety, while this legacy bookmark is fail-closed.
export default function RetiredActivityTabRoute() {
  return <Redirect href="/(tabs)" />;
}
