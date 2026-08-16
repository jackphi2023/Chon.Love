import { Redirect } from 'expo-router';

// Activity creation was a MyFan-era surface and is not part of Chon.Love Web V1.
export default function RetiredActivityCreateRoute() {
  return <Redirect href="/(tabs)" />;
}
