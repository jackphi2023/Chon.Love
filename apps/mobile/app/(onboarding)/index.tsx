import { colors, spacing } from '@myfan/ui';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { DateOfBirthSelector } from '@/components/date-of-birth-selector';
import {
  SignupFieldLabel,
  SignupHelpText,
  SignupPrimaryButton,
  SignupSecondaryButton,
  SignupShell,
} from '@/components/signup-shell';
import { completeMinimumOnboarding, getMyOnboardingStatus, getReadableOnboardingError } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';

export default function OnboardingHome() {
  const router = useRouter();
  const auth = useAuth();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCommunityStandards, setAcceptedCommunityStandards] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isRestoring) return;
    if (!auth.userId) { router.replace('/(auth)'); return; }
    let active = true;
    void getMyOnboardingStatus()
      .then((status) => {
        if (!active || !status) return;
        if (status.account_status !== 'active') {
          setAccountStatus(status.account_status);
          return;
        }
        if (!status.age_verified || !status.policies_accepted) return;
        if (status.profile_status === 'active') {
          router.replace('/(tabs)');
        } else if (status.profile_status === 'incomplete') {
          router.replace('/onboarding/profile');
        } else {
          // pending_review/deactivated/suspended are resolved by the selfie
          // status screen; none of them may enter member routes directly.
          router.replace('/onboarding/selfie');
        }
      })
      .catch((error) => { if (active) setErrorMessage(getReadableOnboardingError(error)); })
      .finally(() => { if (active) setIsChecking(false); });
    return () => { active = false; };
  }, [auth.isRestoring, auth.userId, router]);

  async function handleSubmit() {
    setErrorMessage(null); setIsSubmitting(true);
    try {
      await completeMinimumOnboarding({ dateOfBirth, confirmedAdult, acceptedTerms, acceptedCommunityStandards });
      router.replace('/onboarding/profile');
    } catch (error) {
      setErrorMessage(getReadableOnboardingError(error));
    } finally { setIsSubmitting(false); }
  }

  if (isChecking || auth.isRestoring) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.loadingText}>Đang kiểm tra điều kiện tài khoản…</Text></View>;
  }

  if (accountStatus) {
    const deletionRequested = accountStatus === 'deletion_requested';
    return (
      <SignupShell
        description={deletionRequested ? 'Hồ sơ và tính năng xã hội đang tắt. Bạn có thể xem trạng thái hoặc hủy yêu cầu nếu vẫn còn trong thời gian cho phép.' : 'Tài khoản đang bị đình chỉ hoặc vô hiệu hóa. Gửi lại onboarding không thể tự mở khóa tài khoản.'}
        testID="chon-account-status-screen"
        title={deletionRequested ? 'Tài khoản đang chờ xóa' : 'Tài khoản chưa thể truy cập'}
      >
        {deletionRequested ? (
          <SignupPrimaryButton label="Xem hoặc hủy yêu cầu xóa" onPress={() => router.push('/settings/account-deletion')} />
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </SignupShell>
    );
  }

  return (
    <SignupShell
      description="Ngày sinh là dữ liệu riêng tư, không hiển thị trên hồ sơ công khai."
      step={3}
      testID="chon-onboarding-minimum"
      title="Xác nhận thông tin cá nhân"
    >
      <SignupFieldLabel required>Ngày sinh</SignupFieldLabel>
      <DateOfBirthSelector onChange={setDateOfBirth} />
      <SignupHelpText>Chạm vào từng ô và cuộn để chọn Ngày – Tháng – Năm. Thông tin này giúp Chon.Love xác nhận điều kiện sử dụng và luôn được giữ riêng tư.</SignupHelpText>

      <View style={styles.policyBlock}>
        <PolicyCheck checked={confirmedAdult} label="Tôi xác nhận thông tin ngày sinh là chính xác và tôi đủ điều kiện sử dụng Chon.Love." onPress={() => setConfirmedAdult((value) => !value)} />
        <PolicyCheck checked={acceptedTerms} label="Tôi đã đọc và chấp nhận Điều khoản sử dụng hiện hành." onPress={() => setAcceptedTerms((value) => !value)} />
        <Link href="/legal/terms" style={styles.link}>Xem Điều khoản sử dụng</Link>
        <PolicyCheck checked={acceptedCommunityStandards} label="Tôi đã đọc và chấp nhận Tiêu chuẩn cộng đồng hiện hành." onPress={() => setAcceptedCommunityStandards((value) => !value)} />
        <Link href="/legal/community-standards" style={styles.link}>Xem Tiêu chuẩn cộng đồng</Link>
      </View>

      {errorMessage ? <SignupHelpText tone="danger">{errorMessage}</SignupHelpText> : null}
      <SignupSecondaryButton busy={isSubmitting} label="Tiếp tục tạo hồ sơ" onPress={() => void handleSubmit()} />
    </SignupShell>
  );
}

function PolicyCheck({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkRow}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}><Text style={styles.checkmark}>{checked ? '✓' : ''}</Text></View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
  loadingText: { color: colors.muted, fontSize: 15 },
  policyBlock: { gap: 2, marginTop: 4 },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkmark: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  checkLabel: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 21 },
  link: { color: colors.accent, fontSize: 12, fontWeight: '700', marginLeft: 30, marginBottom: 4 },
  signOutButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 48, marginTop: 8 },
  signOutText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
