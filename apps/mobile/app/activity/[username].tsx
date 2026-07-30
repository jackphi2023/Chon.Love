import { colors, spacing } from '@myfan/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CreatorActivityList } from '@/components/creator-activity';

function normalizeUsername(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.replace(/^@/, '').trim() ?? '';
}

export default function CreatorActivityProfilePage() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const router = useRouter();
  const username = normalizeUsername(params.username);
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>‹ Quay lại</Text></Pressable>
          <Text style={styles.ageBadge}>18+</Text>
        </View>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Hoạt động</Text>
          <Text style={styles.username}>@{username || 'creator'}</Text>
        </View>
        {username ? <CreatorActivityList username={username} /> : <Text style={styles.error}>Username không hợp lệ.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  ageBadge: { color: colors.primary, fontSize: 13, fontWeight: '900', backgroundColor: '#FCE7F3', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  header: { gap: 3 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  username: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, backgroundColor: '#FEF2F2', borderRadius: 12, padding: spacing.md },
});
