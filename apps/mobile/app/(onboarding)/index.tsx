import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Placeholder, Screen } from '@/components/screen';

export default function OnboardingHome() {
  return (
    <Screen title="Onboarding 18+" description="DOB, xác nhận 18+, Terms và Community Standards là điều kiện bắt buộc.">
      <Placeholder text="Không người dùng dưới 18 tuổi nào được truy cập Social features." />
      <Link href="/(tabs)" asChild>
        <Text accessibilityRole="link">Mở app skeleton</Text>
      </Link>
    </Screen>
  );
}
