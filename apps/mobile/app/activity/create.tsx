import { Redirect } from 'expo-router';

// WEB-R01: Activity creation is not part of Luxy Web V1.
export default function DeferredActivityCreateRoute() {
  return <Redirect href="/(tabs)" />;
}
