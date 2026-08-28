import { chonColors, chonShadows, luxyRadii } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChonBalanceScreen } from '@/screens/chon-balance-screen';

export default function BalancePage() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <ChonBalanceScreen />
      <Pressable
        accessibilityLabel="Rút tiền từ quà tặng"
        accessibilityRole="button"
        onPress={() => router.push('/withdrawal')}
        style={({ pressed }) => [styles.withdrawButton, pressed && styles.pressed]}
        testID="balance-withdrawal-entry"
      >
        <Text style={styles.withdrawButtonText}>Rút tiền</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  withdrawButton: {
    alignItems: 'center',
    backgroundColor: chonColors.goldChrome,
    borderColor: chonColors.goldChrome,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    bottom: 82,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 20,
    position: 'absolute',
    right: 18,
    ...chonShadows.hover,
  },
  withdrawButtonText: { color: chonColors.text, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
