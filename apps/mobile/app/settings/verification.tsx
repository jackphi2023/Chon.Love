import {
  getMyMemberVerificationStatus,
  getReadableMemberVerificationError,
  memberVerificationStatusLabel,
  submitMyLinkedInVerification,
  submitMyMemberIdentityVerification,
  uploadMemberIdentityDocument,
} from '@myfan/supabase';
import { luxyColors, luxyRadii, luxySpacing } from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  LuxySettingsPage,
  SettingsAction,
  SettingsNotice,
  SettingsSection,
} from '@/components/luxy-settings-layout';
import {
  getReadableProfileMediaError,
  pickAndPrepareProfileImage,
  type PreparedLocalProfileImage,
} from '@/lib/profile-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type CaptureKey = 'front' | 'back';

export default function VerificationSettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [captures, setCaptures] = useState<Partial<Record<CaptureKey, PreparedLocalProfileImage>>>({});
  const [busy, setBusy] = useState<CaptureKey | null>(null);
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['member-verification', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyMemberVerificationStatus(client);
    },
  });

  const identityMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      if (!captures.front || !captures.back) throw new Error('identity_front_and_back_required');
      await uploadMemberIdentityDocument(client, 'front', captures.front);
      await uploadMemberIdentityDocument(client, 'back', captures.back);
      return submitMyMemberIdentityVerification(client);
    },
    onSuccess: async () => {
      setSuccessMessage('CCCD đã được gửi riêng tư và đang chờ xác minh.');
      setCaptures({});
      await queryClient.invalidateQueries({ queryKey: ['member-verification', auth.userId] });
    },
    onError: (error) => setErrorMessage(getReadableMemberVerificationError(error)),
  });

  const linkedInMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return submitMyLinkedInVerification(client, linkedInUrl);
    },
    onSuccess: async () => {
      setSuccessMessage('LinkedIn đã được gửi và đang chờ xác minh.');
      await queryClient.invalidateQueries({ queryKey: ['member-verification', auth.userId] });
    },
    onError: (error) => setErrorMessage(getReadableMemberVerificationError(error)),
  });

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  async function capture(key: CaptureKey) {
    setBusy(key);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const prepared = await pickAndPrepareProfileImage('library', 'private');
      if (!prepared) return;
      setCaptures((current) => ({ ...current, [key]: prepared }));
    } catch (error) {
      setErrorMessage(getReadableProfileMediaError(error));
    } finally {
      setBusy(null);
    }
  }

  function submitIdentity() {
    setErrorMessage(null);
    setSuccessMessage(null);
    identityMutation.mutate();
  }

  function submitLinkedIn() {
    setErrorMessage(null);
    setSuccessMessage(null);
    linkedInMutation.mutate();
  }

  const status = statusQuery.data;
  const selfieApproved = status?.selfie_status === 'approved';

  return (
    <LuxySettingsPage
      description="Xác thực theo ba lớp: selfie, CCCD và LinkedIn. Chỉ badge kết quả được công khai; ảnh giấy tờ và dữ liệu xác thực luôn ở vùng riêng tư."
      testID="luxy-verification-settings"
      title="Xác thực"
    >
      <SettingsNotice title="Tách biệt với payout KYC">
        Xác thực hồ sơ Luxy dùng contract riêng. CCCD ở đây không tự tạo tài khoản ngân hàng, không cấp quyền rút tiền và không công khai họ tên hay số giấy tờ trên profile.
      </SettingsNotice>

      {statusQuery.isLoading ? <ActivityIndicator color={luxyColors.ink} /> : null}

      <SettingsSection
        description="Selfie live được so với ảnh hồ sơ. Ngưỡng tự động duyệt hiện tại là trên 60%; trường hợp không đạt chuyển Admin review."
        testID="verification-selfie-section"
        title="1. Selfie"
      >
        <View style={styles.statusRow}>
          <View style={styles.statusCopy}>
            <Text style={styles.cardTitle}>Xác thực ảnh cá nhân</Text>
            <Text style={styles.cardDescription}>
              {selfieApproved
                ? 'Selfie đã được xác minh với ảnh hồ sơ.'
                : status?.selfie_status === 'pending'
                  ? 'Selfie đang chờ Admin xem xét.'
                  : 'Selfie bắt buộc trong luồng đăng ký mới. Tài khoản Beta cũ có thể chưa có badge xác minh.'}
            </Text>
            {typeof status?.selfie_similarity === 'number' ? (
              <Text style={styles.score}>Độ tương đồng: {status.selfie_similarity.toFixed(1)}%</Text>
            ) : null}
          </View>
          <StatusPill label={memberVerificationStatusLabel(status?.selfie_status ?? 'not_started')} approved={selfieApproved} />
        </View>
        {!selfieApproved && status?.selfie_status !== 'pending' ? (
          <View style={styles.sectionAction}>
            <SettingsAction label="Mở chụp selfie" onPress={() => router.push('/onboarding/selfie')} secondary />
          </View>
        ) : null}
      </SettingsSection>

      <SettingsSection
        description="Upload đủ mặt trước và mặt sau. File đi vào bucket riêng, không dùng media profile và không có public URL."
        testID="verification-id-section"
        title="2. Căn cước công dân"
      >
        <View style={styles.statusHeader}>
          <Text style={styles.cardTitle}>Trạng thái CCCD</Text>
          <StatusPill label={memberVerificationStatusLabel(status?.identity_status ?? 'not_started')} approved={status?.identity_status === 'approved'} />
        </View>
        <View style={styles.documentGrid}>
          <CaptureCard
            actionLabel={busy === 'front' ? 'Đang chọn…' : captures.front ? 'Chọn lại mặt trước' : 'Upload mặt trước CCCD'}
            image={captures.front}
            onAction={() => void capture('front')}
            status={captures.front ? 'Đã sẵn sàng để gửi' : 'Chưa có'}
            title="Mặt trước"
          />
          <CaptureCard
            actionLabel={busy === 'back' ? 'Đang chọn…' : captures.back ? 'Chọn lại mặt sau' : 'Upload mặt sau CCCD'}
            image={captures.back}
            onAction={() => void capture('back')}
            status={captures.back ? 'Đã sẵn sàng để gửi' : 'Chưa có'}
            title="Mặt sau"
          />
        </View>
        <View style={styles.sectionAction}>
          <SettingsAction
            disabled={!captures.front || !captures.back || identityMutation.isPending}
            label={identityMutation.isPending ? 'Đang gửi CCCD…' : 'Gửi CCCD để xác minh'}
            onPress={submitIdentity}
            testID="verification-identity-submit"
          />
        </View>
      </SettingsSection>

      <SettingsSection
        description="LinkedIn là lớp tín nhiệm nghề nghiệp bổ sung. Luxy chỉ nhận URL hồ sơ; không hỏi hoặc lưu mật khẩu LinkedIn."
        testID="verification-linkedin-section"
        title="3. LinkedIn"
      >
        <View style={styles.linkedInRow}>
          <View style={styles.linkedInIcon}><Text style={styles.linkedInIconText}>in</Text></View>
          <View style={styles.linkedInText}>
            <Text style={styles.cardTitle}>Hồ sơ LinkedIn</Text>
            <Text style={styles.cardDescription}>Ví dụ: https://www.linkedin.com/in/username</Text>
          </View>
          <StatusPill label={memberVerificationStatusLabel(status?.linkedin_status ?? 'not_started')} approved={status?.linkedin_status === 'approved'} />
        </View>
        <View style={styles.linkedInForm}>
          <TextInput
            accessibilityLabel="URL hồ sơ LinkedIn"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setLinkedInUrl}
            placeholder="https://www.linkedin.com/in/..."
            placeholderTextColor={luxyColors.softMuted}
            style={styles.input}
            value={linkedInUrl}
          />
          <SettingsAction
            disabled={!linkedInUrl.trim() || linkedInMutation.isPending}
            label={linkedInMutation.isPending ? 'Đang gửi…' : 'Gửi LinkedIn để xác minh'}
            onPress={submitLinkedIn}
            testID="verification-linkedin-submit"
          />
        </View>
      </SettingsSection>

      <View style={styles.badgeSummary}>
        <Text style={styles.summaryTitle}>Badge công khai</Text>
        <Text style={styles.summaryText}>✓ Ảnh cá nhân: {selfieApproved ? 'Đã xác minh' : 'Chưa xác minh'}</Text>
        <Text style={styles.summaryText}>✓ Danh tính: {status?.identity_status === 'approved' ? 'Đã xác minh' : 'Chưa xác minh'}</Text>
        <Text style={styles.summaryText}>✓ LinkedIn: {status?.linkedin_status === 'approved' ? 'Đã xác minh' : 'Chưa xác minh'}</Text>
      </View>

      {successMessage ? <Text accessibilityRole="alert" style={styles.success}>{successMessage}</Text> : null}
      {errorMessage || statusQuery.error ? (
        <Text accessibilityRole="alert" style={styles.error}>{errorMessage ?? getReadableMemberVerificationError(statusQuery.error)}</Text>
      ) : null}

      <View style={styles.backRow}>
        <SettingsAction label="Quay lại Cài đặt" onPress={() => router.push('/settings')} secondary />
      </View>
    </LuxySettingsPage>
  );
}

function StatusPill({ label, approved }: { label: string; approved: boolean }) {
  return <View style={[styles.statusPill, approved && styles.statusPillApproved]}><Text style={[styles.statusPillText, approved && styles.statusPillTextApproved]}>{label}</Text></View>;
}

function CaptureCard({
  title,
  status,
  image,
  actionLabel,
  onAction,
}: {
  title: string;
  status: string;
  image?: PreparedLocalProfileImage | undefined;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.captureCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.preview}>
        {image ? (
          <Image accessibilityLabel={`Ảnh ${title}`} source={{ uri: image.previewUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.previewEmpty}>
            <Text style={styles.previewSymbol}>▣</Text>
            <Text style={styles.previewEmptyText}>Chưa có ảnh</Text>
          </View>
        )}
      </View>
      <Text style={styles.captureStatus}>{status}</Text>
      <SettingsAction label={actionLabel} onPress={onAction} secondary />
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.md, padding: luxySpacing.lg },
  statusCopy: { flex: 1 },
  statusHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: luxySpacing.lg, paddingTop: luxySpacing.lg },
  statusPill: { backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  statusPillApproved: { backgroundColor: '#ECFDF5' },
  statusPillText: { color: luxyColors.muted, fontSize: 11.5, fontWeight: '700' },
  statusPillTextApproved: { color: '#166534' },
  score: { color: luxyColors.muted, fontSize: 12, marginTop: 5 },
  sectionAction: { paddingBottom: luxySpacing.lg, paddingHorizontal: luxySpacing.lg },
  documentGrid: { gap: luxySpacing.md, padding: luxySpacing.lg },
  captureCard: { gap: luxySpacing.sm },
  cardTitle: { color: luxyColors.text, fontSize: 15.5, fontWeight: '700' },
  cardDescription: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  preview: { aspectRatio: 1.6, backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.sm, overflow: 'hidden', width: '100%' },
  previewImage: { height: '100%', resizeMode: 'cover', width: '100%' },
  previewEmpty: { alignItems: 'center', flex: 1, gap: luxySpacing.xs, justifyContent: 'center' },
  previewSymbol: { color: luxyColors.softMuted, fontSize: 30 },
  previewEmptyText: { color: luxyColors.muted, fontSize: 12.5 },
  captureStatus: { color: luxyColors.muted, fontSize: 12.5 },
  linkedInRow: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.md, minHeight: 88, padding: luxySpacing.lg },
  linkedInIcon: { alignItems: 'center', backgroundColor: '#E8EDF2', borderRadius: luxyRadii.pill, height: 42, justifyContent: 'center', width: 42 },
  linkedInIconText: { color: '#5B6670', fontSize: 14, fontWeight: '800' },
  linkedInText: { flex: 1 },
  linkedInForm: { gap: luxySpacing.sm, paddingBottom: luxySpacing.lg, paddingHorizontal: luxySpacing.lg },
  input: { borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, color: luxyColors.text, minHeight: 48, paddingHorizontal: 13 },
  badgeSummary: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.md, borderWidth: 1, gap: 7, marginBottom: luxySpacing.xl, padding: luxySpacing.xl },
  summaryTitle: { color: luxyColors.text, fontSize: 16, fontWeight: '700' },
  summaryText: { color: luxyColors.muted, fontSize: 13, lineHeight: 20 },
  success: { color: '#166534', fontSize: 13.5, marginBottom: luxySpacing.lg },
  error: { color: luxyColors.danger, fontSize: 13.5, marginBottom: luxySpacing.lg },
  backRow: { alignItems: 'flex-start', marginBottom: luxySpacing.xl },
});
