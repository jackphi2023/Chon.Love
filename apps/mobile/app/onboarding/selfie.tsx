import { getMyProfile, type GenderIdentity } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LiveSelfieCamera } from '@/components/live-selfie-camera';
import {
  SignupHelpText,
  SignupSecondaryButton,
  SignupShell,
} from '@/components/signup-shell';
import {
  getMemberPhotoVerificationStatus,
  MEMBER_PHOTO_PENDING_MESSAGE,
  MEMBER_PHOTO_SIMILARITY_THRESHOLD,
  submitMemberPhotoVerification,
  type MemberPhotoVerificationResult,
} from '@/lib/member-photo-verification';
import type { PreparedLocalProfileImage } from '@/lib/profile-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function SelfieVerificationOnboarding() {
  const router = useRouter();
  const auth = useAuth();
  const [selfie, setSelfie] = useState<PreparedLocalProfileImage | null>(null);
  const [declaredGender, setDeclaredGender] = useState<GenderIdentity>('prefer_not_to_say');
  const [result, setResult] = useState<MemberPhotoVerificationResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isRestoring) return;
    if (!auth.userId) {
      router.replace('/(auth)');
      return;
    }
    let active = true;
    const client = getMobileSupabaseClient();
    if (!client) {
      setErrorMessage('Kết nối xác minh chưa được cấu hình.');
      setIsChecking(false);
      return;
    }

    void Promise.all([getMyProfile(client), getMemberPhotoVerificationStatus(client)])
      .then(([profile, status]) => {
        if (!active) return;
        setDeclaredGender(profile.gender);
        setResult(status);
        if (status.state === 'approved') router.replace('/(tabs)');
      })
      .catch(() => {
        if (active) setErrorMessage('Không thể tải trạng thái xác minh ảnh. Hãy thử lại.');
      })
      .finally(() => {
        if (active) setIsChecking(false);
      });

    return () => {
      active = false;
    };
  }, [auth.isRestoring, auth.userId, router]);

  async function handleSubmit() {
    if (!selfie) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const verification = await submitMemberPhotoVerification(selfie, declaredGender);
      setResult(verification);
      if (verification.state === 'approved') router.replace('/(tabs)');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('profile_photo_required')) {
        setErrorMessage('Bạn cần upload ít nhất một ảnh hồ sơ trước khi chụp selfie xác minh.');
      } else {
        setErrorMessage('Không thể hoàn tất xác minh ảnh. Hãy kiểm tra kết nối và thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (auth.isRestoring || isChecking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.muted}>Đang kiểm tra trạng thái xác minh…</Text>
      </View>
    );
  }

  if (result?.state === 'pending_review') {
    return (
      <SignupShell
        description="Bạn chưa thể đăng nhập vào khu vực thành viên hoặc xem hồ sơ người dùng cho đến khi quá trình xem xét hoàn tất."
        step={8}
        testID="chon-selfie-pending"
        title="Tài khoản đang chờ xác minh"
      >
        <View style={styles.warningCard}>
          <Text accessibilityRole="alert" style={styles.warningTitle}>Cần xác minh thủ công</Text>
          <Text style={styles.warningText}>{result.message || MEMBER_PHOTO_PENDING_MESSAGE}</Text>
          {typeof result.maxSimilarity === 'number' ? (
            <Text style={styles.scoreText}>Độ tương đồng tự động: {result.maxSimilarity.toFixed(1)}%</Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </SignupShell>
    );
  }

  if (result?.state === 'hidden') {
    return (
      <SignupShell
        description="Hồ sơ đang bị vô hiệu sau quá trình xác minh. Liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn."
        step={8}
        testID="chon-selfie-hidden"
        title="Tài khoản chưa được kích hoạt"
      >
        <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </SignupShell>
    );
  }

  return (
    <SignupShell
      description="Bước cuối để kích hoạt tài khoản Chon.Love. Selfie phải được chụp trực tiếp bằng camera và sẽ được so với ảnh hồ sơ đã upload."
      onBack={() => router.replace('/onboarding/profile')}
      step={8}
      testID="chon-selfie-verification"
      title="Chụp selfie xác minh"
    >
      <View style={styles.ruleCard}>
        <Text style={styles.ruleTitle}>Điều kiện tự động duyệt</Text>
        <Text style={styles.ruleText}>• Khuôn mặt selfie tương đồng trên {MEMBER_PHOTO_SIMILARITY_THRESHOLD}% với ít nhất một ảnh hồ sơ.</Text>
        <Text style={styles.ruleText}>• Giới tính tự khai báo được khóa theo hồ sơ trong lần xác minh này để tránh thay đổi dữ liệu giữa luồng.</Text>
        <Text style={styles.ruleText}>• Không đạt ngưỡng hoặc ảnh không đủ chất lượng → chuyển Admin review, không tự động khóa vĩnh viễn.</Text>
      </View>

      {selfie ? (
        <View style={styles.previewWrap}>
          <Image accessibilityLabel="Selfie vừa chụp" source={{ uri: selfie.previewUri }} style={styles.selfiePreview} />
          <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => setSelfie(null)} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>Chụp lại</Text>
          </Pressable>
        </View>
      ) : (
        <LiveSelfieCamera
          disabled={isSubmitting}
          onCapture={(image) => {
            setErrorMessage(null);
            setSelfie(image);
          }}
          onError={setErrorMessage}
        />
      )}

      {errorMessage ? <SignupHelpText tone="danger">{errorMessage}</SignupHelpText> : null}
      <SignupSecondaryButton
        busy={isSubmitting}
        disabled={!selfie}
        label="Xác minh và kích hoạt tài khoản"
        onPress={() => void handleSubmit()}
      />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  muted: { color: colors.muted, fontSize: 14 },
  ruleCard: { backgroundColor: '#FFF9EA', borderColor: '#E8D391', borderRadius: 12, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  ruleTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  ruleText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  warningCard: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74', borderRadius: 12, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  warningTitle: { color: '#9A3412', fontSize: 16, fontWeight: '900' },
  warningText: { color: '#7C2D12', fontSize: 14, lineHeight: 22 },
  scoreText: { color: '#9A3412', fontSize: 12, fontWeight: '700' },
  previewWrap: { alignItems: 'center', gap: spacing.sm },
  selfiePreview: { aspectRatio: 1, borderRadius: 14, maxWidth: 420, width: '100%' },
  textButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  textButtonLabel: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  signOutButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 48 },
  signOutText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
