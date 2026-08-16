import { Redirect } from 'expo-router';

// Chon.Love Web V1 does not expose Activity profiles. Preserve this route only
// as a safe redirect for historical bookmarks; no legacy Activity code runs.
export default function RetiredActivityProfileRoute() {
  return <Redirect href="/(tabs)" />;
}
