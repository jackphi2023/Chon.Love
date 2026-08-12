import { Redirect } from 'expo-router';

// LX-20 product override: Activity is intentionally deferred so the V1 surface
// stays aligned with the current Seeking reference. Legacy Activity backend/data
// remains intact for a future session but is not reachable from Luxy navigation.
export default function ActivityTabPage() {
  return <Redirect href="/(tabs)" />;
}
