import { Redirect } from 'expo-router';

// WEB-R01: Activity is deferred/superseded for Luxy Web V1.
// Keep the route as a safe redirect so old bookmarks cannot reopen the legacy surface.
export default function DeferredActivityProfileRoute() {
  return <Redirect href="/(tabs)" />;
}
