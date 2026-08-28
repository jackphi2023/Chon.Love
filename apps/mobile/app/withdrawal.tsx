import { chonColors, chonLayout, chonTypography } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChonWithdrawalPanel } from '@/components/chon-withdrawal-panel';

export default function WithdrawalPage() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.scroll} testID="withdrawal-page">
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Quay lại Số dư" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Số dư</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.heading}>Rút tiền</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ChonWithdrawalPanel />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: chonColors.surface, flexGrow: 1, paddingBottom: 96 },
  page: { alignSelf: 'center', maxWidth: 680, paddingHorizontal: chonLayout.contentHorizontalPaddingMobile, paddingTop: 22, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 42 },
  backButton: { justifyContent: 'center', minHeight: 42, minWidth: 78 },
  backText: { color: chonColors.primaryRed, fontSize: 13, fontWeight: '800' },
  heading: { color: chonColors.goldChrome, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '800', textAlign: 'center' },
  headerSpacer: { minWidth: 78 },
});
