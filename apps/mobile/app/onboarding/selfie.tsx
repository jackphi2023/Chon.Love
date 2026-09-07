import { getMyProfile, listMyMedia } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { AwsFaceLiveness } from '@/components/aws-face-liveness';
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
  type MemberPhotoVerificationResult,
} from '@/lib/member-photo-verification';
import { isUsableSignupProfilePhoto } from '@/lib/signup-photo-contract';
import { clearSignupDraft } from '@/lib/signup-draft';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

function readableVerificationFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('profile_photo_required')) return 'Bạn cần tải lên ít nhất một ảnh hồ sơ trước khi xác minh người thật.';
  if (message.includes('signup_profile_details_required')) return 'Vui lòng hoàn thành phần Giới thiệu về bạn trước khi xác minh người thật.';
  if (message.includes('member_photo_verification_invoke_failed:404') || message.includes('FunctionsRelayError')) {
    return 'Dịch vụ xác minh thành viên chưa sẵn sàng. Chon.Love đã ghi nhận lỗi hệ thống; vui lòng thử lại sau khi dịch vụ được cập nhật.';
  }
  if (message.includes('member_photo_verification_invoke_failed:401')) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi xác minh.';
  if (message.includes('face_liveness_required')) return 'Bạn cần hoàn thành xác minh người thật bằng camera trước khi hệ thống so sánh khuôn mặt.';
  if (message.includes('face_liveness_provider_not_configured') || message.includes('face_liveness_service_unavailable')) {
    return 'Dịch vụ xác minh người thật đang tạm thời chưa sẵn sàng. Tài khoản sẽ không được tự động kích hoạt cho đến khi xác minh hoàn tất.';
  }
  return 'Xác minh người thật tạm thời chưa hoàn tất. Vui lòng thử lại; nếu lỗi tiếp tục, Chon.Love sẽ kiểm tra dịch vụ xác minh.';
}

export default function SelfieVerificationOnboarding() {
  const router = useRouter();
  const auth = useAuth();
  const [result, setResult] = useState<MemberPhotoVerificationResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openConnectAfterApproval = useCallback(() => {
    clearSignupDraft();
    router.replace('/(tabs)/connect');

    // The verification Edge Function only returns approved after the activation
    // RPC has succeeded. Keep a bounded web fallback so stale Expo route-group
    // state cannot strand an already-active member on step 8.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.setTimeout(() => {
        if (window.location.pathname === '/onboarding/selfie') window.location.replace('/connect');
      }, 500);
    }
  }, [router]);

  useEffect(() => {
    if (auth.isRestoring) return;
    if (!auth.userId) { router.replace('/(auth)'); return; }
    let active = true;
    const client = getMobileSupabaseClient();
    if (!client) { setErrorMessage('Kết nối xác minh chưa được cấu hình.'); setIsChecking(false); return; }

    void Promise.all([getMyProfile(client), listMyMedia(client), getMemberPhotoVerificationStatus(client)])
      .then(([profile, mediaRows, status]) => {
        if (!active) return;
        setResult(status);
        if (status.state === 'approved') {
          openConnectAfterApproval();
          return;
        }
        if (status.state !== 'not_started') return;
        const usablePhotoCount = mediaRows.filter(isUsableSignupProfilePhoto).length;
        if (usablePhotoCount < 1) { router.replace('/onboarding/photos'); return; }
        const headlineLength = profile.headline?.trim().length ?? 0;
        const bioLength = profile.bio?.trim().length ?? 0;
        const headlineValid = headlineLength === 0 || (headlineLength >= 10 && headlineLength <= 50);
        if (!headlineValid || bioLength < 50 || bioLength > 4000) router.replace('/onboarding/about');
      })
      .catch((error) => { if (active) setErrorMessage(readableVerificationFailure(error)); })
      .finally(() => { if (active) setIsChecking(false); });

    return () => { active = false; };
  }, [auth.isRestoring, auth.userId, openConnectAfterApproval, router]);

  function handleVerificationResult(verification: MemberPhotoVerificationResult) {
    setResult(verification);
    if (verification.state === 'approved') openConnectAfterApproval();
  }

  function retryVerification() {
    setResult(null);
    setErrorMessage(null);
  }

  async function leaveToHomepage() {
    if (isLeaving) return;
    setIsLeaving(true);
    clearSignupDraft();
    try { await auth.signOut(); router.replace('/'); }
    finally { setIsLeaving(false); }
  }

  if (auth.isRestoring || isChecking) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent} size="large" /><Text accessibilityLiveRegion="polite" style={styles.muted}>Đang kiểm tra trạng thái xác minh…</Text></View>;
  }

  if (result?.state === 'approved') {
    return (
      <SignupShell description="Bạn đã được xác minh là người thật và khuôn mặt phù hợp với ảnh hồ sơ. Hồ sơ đã kích hoạt và Chon.Love đang mở trang Kết nối." step={8} testID="chon-selfie-approved" title="Xác minh thành công">
        <View accessibilityLiveRegion="polite" style={styles.successCard}>
          <View accessible={false} style={styles.successIcon}><Text accessibilityElementsHidden style={styles.successIconText}>✓</Text></View>
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Chào mừng bạn đến Chon.Love</Text>
            <Text style={styles.successText}>Tài khoản đã được kích hoạt. Bạn sẽ được chuyển tự động sang Kết nối để xem các thành viên phù hợp.</Text>
          </View>
        </View>
        <SignupPrimaryButton label="Vào Kết nối" onPress={openConnectAfterApproval} />
      </SignupShell>
    );
  }

  if (result?.state === 'pending_review') {
    return (
      <SignupShell description="Hồ sơ tạm thời chưa được kích hoạt trong khi Chon.Love kiểm tra kết quả xác minh." step={8} testID="chon-selfie-pending" title="Chúng tôi sẽ kiểm tra để xác nhận">
        <View style={styles.warningCard}>
          <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.warningTitle}>Cần xác minh thêm</Text>
          <Text style={styles.warningText}>{result.message || MEMBER_PHOTO_PENDING_MESSAGE}</Text>
          {typeof result.maxSimilarity === 'number' ? <Text style={styles.scoreText}>Độ tương đồng tự động: {result.maxSimilarity.toFixed(1)}%</Text> : null}
        </View>
        {result.retryable ? (
          <>
            <SignupPrimaryButton label="Thử xác minh lại" onPress={retryVerification} />
            <SignupSecondaryButton busy={isLeaving} label="Về trang chủ" onPress={() => void leaveToHomepage()} />
          </>
        ) : (
          <SignupPrimaryButton busy={isLeaving} label="Về trang chủ" onPress={() => void leaveToHomepage()} />
        )}
      </SignupShell>
    );
  }

  if (result?.state === 'hidden') {
    return <SignupShell description="Hồ sơ đang bị vô hiệu sau quá trình xác minh. Liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn." step={8} testID="chon-selfie-hidden" title="Tài khoản chưa được kích hoạt"><SignupPrimaryButton busy={isLeaving} label="Về trang chủ" onPress={() => void leaveToHomepage()} /></SignupShell>;
  }

  if (Platform.OS !== 'web') {
    return (
      <SignupShell description="Xác minh người thật hiện được hỗ trợ trên phiên bản web của Chon.Love." onBack={() => router.replace('/onboarding/about')} step={8} testID="chon-liveness-web-required" title="Xác minh người thật">
        <View style={styles.warningCard}>
          <Text accessibilityRole="alert" style={styles.warningTitle}>Vui lòng dùng trình duyệt web</Text>
          <Text style={styles.warningText}>Mở Chon.Love bằng trình duyệt trên điện thoại hoặc máy tính để thực hiện Face Liveness. Tài khoản sẽ giữ trạng thái chờ và không được tự động kích hoạt nếu chưa hoàn tất bước này.</Text>
        </View>
        <SignupPrimaryButton busy={isLeaving} label="Về trang chủ" onPress={() => void leaveToHomepage()} />
      </SignupShell>
    );
  }

  return (
    <SignupShell description="Bước cuối để kích hoạt tài khoản Chon.Love. Hệ thống xác minh bạn là người thật trước khi so sánh khuôn mặt với ảnh hồ sơ đã tải lên." onBack={() => router.replace('/onboarding/about')} step={8} testID="chon-selfie-verification" title="Xác minh người thật">
      <View style={styles.ruleCard}>
        <Text style={styles.ruleTitle}>Điều kiện duyệt thành viên</Text>
        <Text style={styles.ruleText}>• Camera xác minh chuyển động/khuôn mặt để xác nhận bạn là người thật.</Text>
        <Text style={styles.ruleText}>• Sau đó khuôn mặt xác minh phải tương đồng trên {MEMBER_PHOTO_SIMILARITY_THRESHOLD}% với ít nhất một ảnh hồ sơ.</Text>
        <Text style={styles.ruleText}>• Kết quả chưa đủ chắc chắn sẽ chuyển sang kiểm tra thủ công thay vì tự động từ chối.</Text>
      </View>

      <AwsFaceLiveness onError={setErrorMessage} onResult={handleVerificationResult} />

      {errorMessage ? <SignupHelpText tone="danger">{errorMessage}</SignupHelpText> : null}
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
});