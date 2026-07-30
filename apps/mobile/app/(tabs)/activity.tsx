import { phaseCFeatureFlags } from '@myfan/config';
import { getMyProfile } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CreatorActivityList } from '@/components/creator-activity';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function ActivityTabPage() {
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const [creatorUsername, setCreatorUsername] = useState('');
  const profileQuery = useQuery({
    queryKey: ['profile', 'me', auth.userId],
    enabled: Boolean(client && auth.userId),
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyProfile(client);
    },
  });

  const profile = profileQuery.data;
  function openCreatorActivity() {
    const username = creatorUsername.replace(/^@/, '').trim();
    if (!username) return;
    router.push({ pathname: '/activity/[username]', params: { username } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>Hoạt động</Text>
            <Text style={styles.description}>Bảng tin Creator theo phong cách gọn, ưu tiên nội dung, một ảnh hoặc một link video an toàn.</Text>
          </View>
          <Text style={styles.ageBadge}>18+</Text>
        </View>

        <View style={styles.lookupCard}>
          <Text style={styles.lookupTitle}>Xem Hoạt động Creator</Text>
          <Text style={styles.lookupNote}>Nhập username để mở bảng tin công khai đã kiểm duyệt.</Text>
          <View style={styles.lookupRow}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setCreatorUsername}
              onSubmitEditing={openCreatorActivity}
              placeholder="@username"
              returnKeyType="go"
              style={styles.lookupInput}
              value={creatorUsername}
            />
            <Pressable accessibilityRole="button" onPress={openCreatorActivity} style={styles.lookupButton}>
              <Text style={styles.lookupButtonText}>Mở</Text>
            </Pressable>
          </View>
        </View>

        {profileQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {profileQuery.error ? <Text accessibilityRole="alert" style={styles.error}>Không thể tải hồ sơ để mở Hoạt động.</Text> : null}

        {profile?.is_creator && phaseCFeatureFlags.creator_activity ? (
          <>
            <View style={styles.creatorBar}>
              <View style={styles.creatorCopy}>
                <Text style={styles.creatorTitle}>Hoạt động của bạn</Text>
                <Text style={styles.creatorNote}>Chỉ bài đã duyệt mới public; bài đang kiểm duyệt vẫn hiện cho chính bạn.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/activity/create')} style={styles.createButton}>
                <Text style={styles.createButtonText}>＋ Đăng</Text>
              </Pressable>
            </View>
            {profile.username ? <CreatorActivityList username={profile.username} /> : <Text style={styles.empty}>Hãy tạo username trước khi đăng Hoạt động.</Text>}
          </>
        ) : profile ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Hoạt động dành cho Creator</Text>
            <Text style={styles.infoText}>Tài khoản người hâm mộ có thể xem Hoạt động trên hồ sơ Creator. Chỉ Creator đã duyệt mới có thể đăng bài.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  ageBadge: { color: colors.primary, fontSize: 13, fontWeight: '900', backgroundColor: '#FCE7F3', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  lookupCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  lookupTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  lookupNote: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  lookupRow: { flexDirection: 'row', gap: spacing.sm },
  lookupInput: { flex: 1, minHeight: 44, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md, backgroundColor: '#F9FAFB' },
  lookupButton: { minWidth: 66, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  lookupButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  creatorBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: spacing.md },
  creatorCopy: { flex: 1, gap: 3 },
  creatorTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  creatorNote: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  createButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.primary, paddingHorizontal: spacing.md },
  createButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  infoCard: { borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 18, backgroundColor: '#F0F9FF', padding: spacing.lg, gap: spacing.sm },
  infoTitle: { color: '#0369A1', fontSize: 18, fontWeight: '900' },
  infoText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  empty: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, backgroundColor: '#FEF2F2', borderRadius: 12, padding: spacing.md },
});
