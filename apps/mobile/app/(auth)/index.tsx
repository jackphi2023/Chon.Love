import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Placeholder, Screen } from '@/components/screen';

export default function AuthHome() {
  return (
    <Screen title="MyFan" description="Mạng xã hội Social Creator chỉ dành cho người dùng từ 18 tuổi trở lên.">
      <Placeholder text="Đăng ký, đăng nhập và khôi phục tài khoản sẽ được triển khai ở Giai đoạn C." />
      <Link href="/(onboarding)" asChild>
        <Text accessibilityRole="link">Xem onboarding skeleton</Text>
      </Link>
    </Screen>
  );
}
