import { getMyProfile, listMyMedia, type GenderIdentity } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LiveSelfieCamera } from '@/components/live-selfie-camera';
import {
  SignupHelpText,
  SignupPrimaryButton,
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
import { isUsableSignupProfilePhoto } from '@/lib/signup-photo-contract';
import { clearSignupDraft } from '@/lib/signup-draft';
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
  const [isLeaving, setIsLeaving] = useState(false);
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

    void Promise.all([getMyProfile(client), listMyMedia(client), getMemberPhotoVerificationStatus(client)])
      .then(([profile, mediaRows, status]) => {
        if (!active) return;
        setDeclaredGender(profile.gender);
        setResult(status);

        if (status.state !== 'not_started') return;

        const usablePhotoCount = mediaRows.filter(isUsableSignupProfilePhoto).length;
        if (usablePhotoCount < 1) {
          router.replace('/onboarding/photos');
          return;
        }

        const headlineLength = profile.headline?.trim().length ?? 0;
        const bioLength = profile.bio?.trim().length ?? 0;
        const headlineValid = headlineLength === 0 || (headlineLength >= 10 && headlineLength <= 50);
        if (!headlineValid || bioLength < 50 || bioLength > 4000) {
          router.replace('/onboarding/about');
        }
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
      setSelfie(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('profile_photo_required')) {
        setErrorMessage('Bạn cần tải lên ít nhất một ảnh hồ sơ trước khi chụp selfie xác minh.');
      } else if (message.includes('signup_profile_details_required')) {
        setErrorMessage('Vui lòng hoàn thành phần Giới thiệu về bạn trước khi xác minh selfie.');
      } else {
        setErrorMessage('Không thể hoàn tất xác minh ảnh. Hãy kiểm tra kết nối và thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function completeSignup() {
    clearSignupDraft();
    router.replace('/(tabs)');
  }

  async function leaveToHomepage() {
    if (isLeaving) return;
    setIsLeaving(true);
    clearSignupDraft();
    try {
      await auth.signOut();
      router.replace('/');
    } finally {
      setIsLeaving(false);
    }
  }

  if (auth.isRestoring || isChecking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text accessibilityLiveRegion="polite" style={styles.muted}>Đang kiểm tra trạng thái xác minh…</Text>
      </View>
    );
  }

  if (result?.state === 'approved') {
    return (
      <SignupShell
        description="Ảnh selfie đã được xác minh. Hồ sơ của bạn đã được kích hoạt và sẵn sàng xuất hiện trong cộng đồng Chon.Love."
        step={8}
        testID="chon-selfie-approved"
        title="Xác minh thành công"
      >
        <View accessibilityLiveRegion="polite" style={styles.successCard}>
          <View accessible={false} style={styles.successIcon}><Text accessibilityElementsHidden style={styles.successIconText}>✓</Text></View>
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Chào mừng bạn đến Chon.Love</Text>
            <Text style={styles.successText}>
              Chọn Hoàn tất để đến Kết nối. Danh sách mặc định ưu tiên thành viên gần → xa khi vị trí hiện tại của bạn còn hiệu lực; nếu bạn chỉ chọn tỉnh/thành, hệ thống vẫn hiển thị thành viên phù hợp mà không công khai tọa độ.
            </Text>
          </View>
        </View>
        <SignupPrimaryButton label="Hoàn tất" onPress={completeSignup} />
      </SignupShell>
    );
  }

  if (result?.state === 'pending_review') {
    return (
      <SignupShell
        description="Hồ sơ tạm thời chưa được kích hoạt trong khi Chon.Love kiểm tra ảnh xác minh."
        step={8}
        testID="chon-selfie-pending"
        title="Chúng tôi sẽ kiểm tra để xác nhận"
      >
        <View style={styles.warningCard}>
          <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.warningTitle}>Cần xác minh thủ công</Text>
          <Text style={styles.warningText}>{result.message || MEMBER_PHOTO_PENDING_MESSAGE}</Text>
          {typeof result.maxSimilarity === 'number' ? (
            <Text style={styles.scoreText}>Độ tương đồng tự động: {result.maxSimilarity.toFixed(1)}%</Text>
          ) : null}
        </View>
        <SignupPrimaryButton
          busy={isLeaving}
          label="Về trang chủ"
          onPress={() => void leaveToHomepage()}
        />
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
        <SignupPrimaryButton
          busy={isLeaving}
          label="Về trang chủ"
          onPress={() => void leaveToHomepage()}
        />
      </SignupShell>
    );
  }

  return (
    <SignupShell
      description="Bước cuối để kích hoạt tài khoản Chon.Love. Selfie phải được chụp trực tiếp bằng camera và sẽ được so với ảnh hồ sơ đã tải lên."
      onBack={() => router.replace('/onboarding/about')}
      step={8}
      testID="chon-selfie-verification"
      title="Chụp selfie xác minh"
    >
      <View style={styles.ruleCard}>
        <Text style={styles.ruleTitle}>Điều kiện tự động duyệt</Text>
        <Text style={styles.ruleText}>• Khuôn mặt selfie tương đồng trên {MEMBER_PHOTO_SIMILARITY_THRESHOLD}% với ít nhất một ảnh hồ sơ.</Text>
        <Text style={styles.ruleText}>• Hệ thống không suy đoán giới tính từ khuôn mặt; chỉ khóa giá trị giới tính bạn đã tự khai báo để tránh thay đổi dữ liệu giữa luồng.</Text>
        <Text style={styles.ruleText}>• Không đạt ngưỡng hoặc ảnh không đủ chất lượng → chuyển sang kiểm tra thủ công, không tự động khóa vĩnh viễn.</Text>
      </View>

      {selfie ? (
        <View style={styles.previewWrap}>
          <Image accessibilityLabel="Selfie vừa chụp" source={{ uri: selfie.previewUri }} style={styles.selfiePreview} />
          <Pressable
            accessibilityLabel="Chụp lại selfie"
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={() => setSelfie(null)}
            style={styles.textButton}
          >
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
  successCard: { alignItems: 'center', backgroundColor: '#F0FDF4', borderColor: '#86EFAC', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  successIcon: { alignItems: 'center', backgroundColor: '#15803D', borderRadius: 999, height: 48, justifyContent: 'center', width: 48 },
  successIconText: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  successCopy: { flex: 1, gap: 5 },
  successTitle: { color: '#166534', fontSize: 16, fontWeight: '900' },
  successText: { color: '#166534', fontSize: 12.5, lineHeight: 20 },
  warningCard: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74', borderRadius: 12, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  warningTitle: { color: '#9A3412', fontSize: 16, fontWeight: '900' },
  warningText: { color: '#7C2D12', fontSize: 14, lineHeight: 22 },
  scoreText: { color: '#9A3412', fontSize: 12, fontWeight: '700' },
  previewWrap: { alignItems: 'center', gap: spacing.sm },
  selfiePreview: { aspectRatio: 1, borderRadius: 14, maxWidth: 420, width: '100%' },
  textButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  textButtonLabel: { color: colors.accent, fontSize: 16, fontWeight: '800' },
});