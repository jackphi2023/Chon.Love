import { phaseCFeatureFlags } from '@myfan/config';
import {
  activityQueryKeys,
  getCreatorActivityAccess,
  getCreatorActivityVisibilityDescription,
  getCreatorActivityVisibilityLabel,
  getMyProfile,
  getReadableActivityError,
  setMyCreatorActivityVisibility,
  type CreatorActivityVisibility,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CreatorActivityList } from '@/components/creator-activity';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const PRIVACY_OPTIONS: CreatorActivityVisibility[] = ['public', 'friends', 'fans'];

export default function ActivityTabPage() {
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [creatorUsername, setCreatorUsername] = useState('');
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['profile', 'me', auth.userId],
    enabled: Boolean(client && auth.userId),
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyProfile(client);
    },
  });
  const profile = profileQuery.data;
  const accessQuery = useQuery({
    queryKey: activityQueryKeys.access(profile?.username ?? ''),
    enabled: Boolean(client && profile?.is_creator && profile.username),
    staleTime: 20_000,
    queryFn: async () => {
      if (!client || !profile?.username) throw new Error('supabase_not_configured');
      return getCreatorActivityAccess(client, profile.username);
    },
  });

  function openCreatorActivity() {
    const username = creatorUsername.replace(/^@/, '').trim();
    if (!username) return;
    router.push({ pathname: '/activity/[username]', params: { username } });
  }

  async function updateVisibility(visibility: CreatorActivityVisibility) {
    if (!client || !profile?.username || privacyBusy || accessQuery.data?.activity_visibility === visibility) return;
    setPrivacyBusy(true);
    setPrivacyNotice(null);
    try {
      await setMyCreatorActivityVisibility(client, visibility);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: activityQueryKeys.access(profile.username) }),
        queryClient.invalidateQueries({ queryKey: activityQueryKeys.feed(profile.username) }),
        queryClient.invalidateQueries({ queryKey: activityQueryKeys.album(profile.username) }),
        queryClient.invalidateQueries({ queryKey: ['profile-viewer'] }),
      ]);
      setPrivacyNotice(`Đã đặt quyền Hoạt động: ${getCreatorActivityVisibilityLabel(visibility)}.`);
    } catch (error) {
      setPrivacyNotice(getReadableActivityError(error));
    } finally {
      setPrivacyBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>Hoạt động</Text>
            <Text style={styles.description}>Bài viết, video và Album ảnh dùng chung một cài đặt quyền riêng tư của Creator.</Text>
          </View>
          <Text style={styles.ageBadge}>18+</Text>
        </View>

        <View style={styles.lookupCard}>
          <Text style={styles.lookupTitle}>Xem Hoạt động Creator</Text>
          <Text style={styles.lookupNote}>Nhập username. Hệ thống sẽ kiểm tra quyền Công khai, Bạn bè hoặc Fan trước khi trả nội dung.</Text>
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
            <View style={styles.privacyCard}>
              <Text style={styles.privacyTitle}>Ai được xem toàn bộ Hoạt động?</Text>
              <Text style={styles.privacyIntro}>Quyền này áp dụng đồng thời cho text, ảnh, video, link và Album ảnh lấy từ Hoạt động.</Text>
              {accessQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
              <View style={styles.privacyOptions}>
                {PRIVACY_OPTIONS.map((visibility) => {
                  const active = accessQuery.data?.activity_visibility === visibility;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      disabled={privacyBusy}
                      key={visibility}
                      onPress={() => void updateVisibility(visibility)}
                      style={[styles.privacyOption, active && styles.privacyOptionActive]}
                    >
                      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
                      <View style={styles.privacyCopy}>
                        <Text style={[styles.privacyLabel, active && styles.privacyLabelActive]}>{getCreatorActivityVisibilityLabel(visibility)}</Text>
                        <Text style={styles.privacyDescription}>{getCreatorActivityVisibilityDescription(visibility)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.hierarchyNote}>
                <Text style={styles.hierarchyTitle}>Thứ bậc quyền</Text>
                <Text style={styles.hierarchyText}>Người chưa kết bạn → Bạn bè → Fan. Fan được xem cả nội dung dành cho Bạn bè.</Text>
              </View>
              {privacyNotice ? <Text accessibilityRole="alert" style={styles.notice}>{privacyNotice}</Text> : null}
            </View>

            <View style={styles.creatorBar}>
              <View style={styles.creatorCopy}>
                <Text style={styles.creatorTitle}>Hoạt động của bạn</Text>
                <Text style={styles.creatorNote}>Chỉ bài đã duyệt mới hiện cho người khác; bài đang kiểm duyệt vẫn hiện cho chính bạn.</Text>
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
            <Text style={styles.infoText}>Tài khoản người hâm mộ có thể xem Hoạt động theo quyền do Creator lựa chọn. Chỉ Creator đã duyệt mới có thể đăng bài.</Text>
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
  privacyCard: { borderWidth: 1, borderColor: '#F9A8D4', borderRadius: 18, backgroundColor: '#FFF7FB', padding: spacing.md, gap: spacing.sm },
  privacyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  privacyIntro: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  privacyOptions: { gap: spacing.sm },
  privacyOption: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: spacing.md },
  privacyOptionActive: { borderColor: colors.primary, backgroundColor: '#FCE7F3' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  privacyCopy: { flex: 1, gap: 3 },
  privacyLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  privacyLabelActive: { color: colors.primary },
  privacyDescription: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  hierarchyNote: { borderRadius: 12, backgroundColor: '#F0F9FF', padding: spacing.sm, gap: 3 },
  hierarchyTitle: { color: '#0369A1', fontSize: 12, fontWeight: '900' },
  hierarchyText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  notice: { color: '#9A3412', backgroundColor: '#FFF7ED', borderRadius: 10, padding: spacing.sm, fontSize: 12, lineHeight: 17 },
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
