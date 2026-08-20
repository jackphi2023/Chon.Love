import { getMyProfile, listActiveProvinces, type ProvinceOption } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import type { SignupExactLocationInput } from '@myfan/validation';

export default function OnboardingLocation() {
  const router = useRouter();
  const auth = useAuth();
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [exactLocation, setExactLocation] = useState<SignupExactLocationInput | null>(null);
  const [captureResult, setCaptureResult] = useState<SignupLocationCaptureResult | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const provinceOptions = useMemo(() => [
    { value: '', label: 'Chọn tỉnh/thành phố' },
    ...provinces.map((province) => ({ value: String(province.id), label: province.name })),
  ], [provinces]);

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
          router.replace('/(tabs)');
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
      } catch (error) {
        if (active) setErrorMessage(getReadableOnboardingError(error));
      } finally {
        if (active) setIsChecking(false);
      }
    })();

    return () => { active = false; };
  }, [auth.isRestoring, auth.userId, router]);

  async function handleCurrentLocation() {
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const result = await captureSignupCurrentLocation();
      setCaptureResult(result);
      if (result.status === 'captured') setExactLocation(result.location);
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleContinue() {
    const parsedProvinceId = Number(provinceId);
    if (!Number.isInteger(parsedProvinceId) || parsedProvinceId <= 0) {
      setErrorMessage('Vui lòng chọn tỉnh/thành phố.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await saveSignupLocation({
        provinceId: parsedProvinceId,
        location: exactLocation,
      });
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
        <Text style={styles.loadingText}>Đang chuẩn bị vị trí…</Text>
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
        <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </SignupShell>
    );
  }

  const captureMessage = captureResult ? getSignupLocationCaptureMessage(captureResult) : null;
  const captureTone = captureResult?.status === 'captured'
    ? 'success'
    : captureResult
      ? 'danger'
      : 'muted';

  return (
    <SignupShell
      description="Chọn tỉnh/thành phố để hiển thị trên hồ sơ. Bạn có thể cho phép vị trí hiện tại để Chon.Love tính khoảng cách gần/xa chính xác hơn."
      onBack={() => router.replace('/(onboarding)')}
      step={4}
      testID="chon-onboarding-location"
      title="Vị trí của bạn"
    >
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Vị trí chính xác luôn được giữ riêng tư</Text>
        <Text style={styles.privacyText}>
          Thành viên khác chỉ thấy tỉnh/thành phố và khoảng cách tương đối. Tọa độ GPS không hiển thị trên hồ sơ công khai.
        </Text>
      </View>

      <SignupFieldLabel required>Tỉnh / thành phố</SignupFieldLabel>
      <SignupSelect
        accessibilityLabel="Tỉnh hoặc thành phố"
        onChange={setProvinceId}
        options={provinceOptions}
        testID="signup-location-province"
        value={provinceId}
      />
      <SignupHelpText>Danh sách sử dụng 34 tỉnh/thành phố đang hoạt động trong dữ liệu Chon.Love.</SignupHelpText>

      <SignupFieldLabel>Vị trí hiện tại</SignupFieldLabel>
      <SignupSecondaryButton
        busy={isCapturing}
        disabled={isSubmitting}
        label={exactLocation ? 'Cập nhật vị trí hiện tại' : 'Sử dụng vị trí hiện tại'}
        onPress={() => void handleCurrentLocation()}
      />
      {captureMessage ? <SignupHelpText tone={captureTone}>{captureMessage}</SignupHelpText> : (
        <SignupHelpText>Không bắt buộc. Nếu không cấp quyền GPS, bạn vẫn có thể tiếp tục bằng tỉnh/thành phố đã chọn.</SignupHelpText>
      )}

      {exactLocation ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setExactLocation(null);
            setCaptureResult(null);
          }}
          style={({ pressed }) => [styles.provinceOnlyButton, pressed && styles.pressed]}
        >
          <Text style={styles.provinceOnlyText}>Chỉ dùng tỉnh/thành phố cho lần lưu này</Text>
        </Pressable>
      ) : null}

      <View style={styles.divider} />
      <SignupHelpText>
        Bạn có thể thay đổi tỉnh/thành phố hoặc tắt quyền dùng vị trí gần đây trong phần chỉnh sửa/cài đặt hồ sơ sau này.
      </SignupHelpText>

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
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: { color: colors.muted, fontSize: 15 },
  privacyCard: {
    backgroundColor: '#FFF8E1',
    borderColor: '#F2B51D',
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  privacyTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  privacyText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  provinceOnlyButton: { alignSelf: 'flex-start', paddingVertical: 3 },
  provinceOnlyText: { color: '#B42318', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: 3 },
  signOutButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  signOutText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});