import { getMyProfile, listActiveProvinces, type ProvinceOption } from '@myfan/supabase';
import type { SignupExactLocationInput } from '@myfan/validation';
import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SignupFieldLabel,
  SignupHelpText,
  SignupPrimaryButton,
  SignupSecondaryButton,
  SignupSelect,
  SignupShell,
} from '@/components/signup-shell';
import { getMyOnboardingStatus, getReadableOnboardingError, saveSignupLocation } from '@/lib/onboarding';
import {
  captureSignupCurrentLocation,
  getSignupLocationCaptureMessage,
  type SignupLocationCaptureResult,
} from '@/lib/signup-location';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function OnboardingLocation() {
  const router = useRouter();
  const auth = useAuth();
  const autoCaptureAttemptedRef = useRef(false);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [exactLocation, setExactLocation] = useState<SignupExactLocationInput | null>(null);
  const [captureResult, setCaptureResult] = useState<SignupLocationCaptureResult | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [canAutoCapture, setCanAutoCapture] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const provinceOptions = useMemo(() => [
    { value: '', label: 'Chọn tỉnh/thành phố' },
    ...provinces.map((province) => ({ value: String(province.id), label: province.name })),
  ], [provinces]);

  const handleCurrentLocation = useCallback(async () => {
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const result = await captureSignupCurrentLocation();
      setCaptureResult(result);
      if (result.status === 'captured') setExactLocation(result.location);
    } finally {
      setIsCapturing(false);
    }
  }, []);

  useEffect(() => {
    if (auth.isRestoring) return;
    if (!auth.userId) {
      router.replace('/(auth)');
      return;
    }

    const client = getMobileSupabaseClient();
    if (!client) {
      setErrorMessage('Kết nối hồ sơ chưa được cấu hình.');
      setIsChecking(false);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const status = await getMyOnboardingStatus();
        if (!active || !status) return;
        if (status.account_status !== 'active') {
          setAccountStatus(status.account_status);
          return;
        }
        if (status.profile_status === 'active') {
          router.replace('/(tabs)/connect');
          return;
        }
        if (status.profile_status !== 'incomplete') {
          router.replace('/onboarding/selfie');
          return;
        }
        if (!status.age_verified || !status.policies_accepted) {
          router.replace('/(onboarding)');
          return;
        }

        const [profile, provinceRows] = await Promise.all([
          getMyProfile(client),
          listActiveProvinces(client),
        ]);
        if (!active) return;
        setProvinces(provinceRows);
        setProvinceId(profile.province_id == null ? '' : String(profile.province_id));
        setCanAutoCapture(true);
      } catch (error) {
        if (active) setErrorMessage(getReadableOnboardingError(error));
      } finally {
        if (active) setIsChecking(false);
      }
    })();

    return () => { active = false; };
  }, [auth.isRestoring, auth.userId, router]);

  useEffect(() => {
    if (!canAutoCapture || isChecking || auth.isRestoring || !auth.userId || accountStatus) return;
    if (exactLocation || isCapturing || isSubmitting || autoCaptureAttemptedRef.current) return;
    autoCaptureAttemptedRef.current = true;
    void handleCurrentLocation();
  }, [
    accountStatus,
    auth.isRestoring,
    auth.userId,
    canAutoCapture,
    exactLocation,
    handleCurrentLocation,
    isCapturing,
    isChecking,
    isSubmitting,
  ]);

  async function handleContinue() {
    const parsedProvinceId = Number(provinceId);
    if (!Number.isInteger(parsedProvinceId) || parsedProvinceId <= 0) {
      setErrorMessage('Vui lòng chọn tỉnh/thành phố.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await saveSignupLocation({ provinceId: parsedProvinceId, location: exactLocation });
      router.replace('/onboarding/looking-for');
    } catch (error) {
      setErrorMessage(getReadableOnboardingError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking || auth.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>Đang chuẩn bị vị trí…</Text>
      </View>
    );
  }

  if (accountStatus) {
    const deletionRequested = accountStatus === 'deletion_requested';
    return (
      <SignupShell
        description={deletionRequested ? 'Hồ sơ và tính năng xã hội đang tắt trong thời gian chờ xử lý yêu cầu xóa.' : 'Tài khoản đang bị đình chỉ hoặc vô hiệu hóa.'}
        testID="chon-location-account-status"
        title={deletionRequested ? 'Tài khoản đang chờ xóa' : 'Tài khoản chưa thể truy cập'}
      >
        <Pressable accessibilityLabel="Đăng xuất" accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </SignupShell>
    );
  }

  const captureMessage = captureResult ? getSignupLocationCaptureMessage(captureResult) : null;
  const captureTone = captureResult?.status === 'captured' ? 'success' : captureResult ? 'danger' : 'muted';

  return (
    <SignupShell
      onBack={() => router.replace('/(onboarding)')}
      step={4}
      testID="chon-onboarding-location"
      title="Vị trí của bạn"
    >
      <SignupFieldLabel required>Tỉnh / thành phố</SignupFieldLabel>
      <SignupSelect
        accessibilityLabel="Tỉnh hoặc thành phố"
        onChange={setProvinceId}
        options={provinceOptions}
        testID="signup-location-province"
        value={provinceId}
      />

      <SignupFieldLabel>Vị trí hiện tại</SignupFieldLabel>
      <SignupHelpText tone="muted">Chon.Love tự thử lấy vị trí hiện tại một lần để xếp thành viên gần → xa. Trình duyệt hoặc điện thoại vẫn sẽ hỏi quyền vị trí; nếu bạn từ chối, hệ thống tiếp tục dùng tỉnh/thành phố đã chọn.</SignupHelpText>
      <SignupSecondaryButton
        busy={isCapturing}
        disabled={isSubmitting}
        label={exactLocation ? 'Cập nhật vị trí hiện tại' : 'Sử dụng vị trí hiện tại'}
        onPress={() => void handleCurrentLocation()}
      />
      {captureMessage ? <SignupHelpText tone={captureTone}>{captureMessage}</SignupHelpText> : null}

      {errorMessage ? <SignupHelpText tone="danger">{errorMessage}</SignupHelpText> : null}
      <SignupPrimaryButton
        busy={isSubmitting}
        disabled={!provinceId || isCapturing}
        label="Tiếp tục"
        onPress={() => void handleContinue()}
      />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  loadingText: { color: colors.muted, fontSize: 15 },
  signOutButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 48 },
  signOutText: { color: colors.text, fontSize: 16, fontWeight: '700' },
});