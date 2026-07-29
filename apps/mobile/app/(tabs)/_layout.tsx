import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Khám phá' }} />
      <Tabs.Screen name="friends" options={{ title: 'Bạn bè' }} />
      <Tabs.Screen name="gifts" options={{ title: 'Quà' }} />
      <Tabs.Screen name="balance" options={{ title: '❤️' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hồ sơ' }} />
    </Tabs>
  );
}
