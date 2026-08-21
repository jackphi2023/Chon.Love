import { getMyProfile, listMyMedia } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DateOfBirthSelector } from '@/components/date-of-birth-selector';
import {
  SignupCharacterCount,
  SignupFieldLabel,
  SignupHelpText,
  SignupPrimaryButton,
  SignupSelect,
  SignupShell,
  SignupTextField,
} from '@/components/signup-shell';
import { restoreSignupDraftFromAuthenticatedUser } from '@/lib/auth';
import { getMyOnboardingStatus, getReadableOnboardingError, saveSignupPersonalInfo } from '@/lib/onboarding';
import {
  SIGNUP_CHILDREN_OPTIONS,
  SIGNUP_DRINKING_OPTIONS,
  SIGNUP_EDUCATION_OPTIONS,
  SIGNUP_HEIGHT_OPTIONS,
  SIGNUP_PERSONAL_INFO_DEFAULTS,
  SIGNUP_RELATIONSHIP_OPTIONS,
  SIGNUP_SMOKING_OPTIONS,
  SIGNUP_WEIGHT_OPTIONS,
} from '@/lib/signup-profile-contract';
import { isUsableSignupProfilePhoto } from '@/lib/signup-photo-contract';
import { clearSignupDraft, readSignupDraft } from '@/lib/signup-draft';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Gender = 'male' | 'female';
type Interest = 'female' | 'male' | 'everyone';

export default function OnboardingPersonalInfo() {
  const router = useRouter();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 768;

  const [dateOfBirth, setDateOfBirth] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [interestedIn, setInterestedIn] = useState<Interest | null>(null);
  const [heightCm, setHeightCm] = useState<string>(SIGNUP_PERSONAL_INFO_DEFAULTS.heightCm);
  const [weightKg, setWeightKg] = useState<string>(SIGNUP_PERSONAL_INFO_DEFAULTS.weightKg);
  const [educationLevel, setEducationLevel] = useState<string>(SIGNUP_PERSONAL_INFO_DEFAULTS.educationLevel);
  const [relationshipStatus, setRelationshipStatus] = useState<string>(SIGNUP_PERSONAL_INFO_DEFAULTS.relationshipStatus);
  const [childrenStatus, setChildrenStatus] = useState<string>(SIGNUP_PERSONAL_INFO_DEFAULTS.childrenStatus);
  const [drinkingStatus, setDrinkingStatus] = useState<string>(SIGNUP_PERSONAL_INFO_DEFAULTS.drinkingStatus);
  const [smokingStatus, setSmokingStatus] = useState<string>(SIGNUP_PERSONAL_INFO_DEFAULTS.smokingStatus);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayNameLength = displayName.trim().length;
  const displayNameValid = displayNameLength >= 6 && displayNameLength <= 50;
  const canSubmit = Boolean(dateOfBirth && displayNameValid && gender && interestedIn) && !isSubmitting;

  useEffect(() => {
    if (auth.isRestoring) return;
    if (!auth.userId) {
      router.replace('/(auth)');
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

        const draft = readSignupDraft() ?? await restoreSignupDraftFromAuthenticatedUser();
        const client = getMobileSupabaseClient();
        const profile = client ? await getMyProfile(client) : null;
        const mediaRows = client ? await listMyMedia(client) : [];
        if (!active) return;

        if (status.age_verified && status.policies_accepted) {
          if (profile?.province_id == null) {
            router.replace('/onboarding/location');
            return;
          }
          const lookingForLength = profile.looking_for?.trim().length ?? 0;
          const lifestyleTagCount = profile.lifestyle_tags?.length ?? 0;
          if (lookingForLength < 50 || lookingForLength > 4000 || lifestyleTagCount < 1 || lifestyleTagCount > 7) {
            router.replace('/onboarding/looking-for');
            return;
          }
          if (!mediaRows.some(isUsableSignupProfilePhoto)) {
            router.replace('/onboarding/photos');
            return;
          }
          const headlineLength = profile.headline?.trim().length ?? 0;
          const bioLength = profile.bio?.trim().length ?? 0;
          const headlineValid = headlineLength === 0 || (headlineLength >= 10 && headlineLength <= 50);
          const bioValid = bioLength >= 50 && bioLength <= 4000;
          if (!headlineValid || !bioValid) {
            router.replace('/onboarding/about');
            return;
          }
          router.replace('/onboarding/selfie');
          return;
        }

        const draftGender = draft?.gender;
        const profileGender = profile?.gender === 'male' || profile?.gender === 'female' ? profile.gender : null;
        const draftInterest = draft?.interest;
        const profileInterest = profile?.interested_in === 'male' || profile?.interested_in === 'female' || profile?.interested_in === 'everyone'
          ? profile.interested_in
          : null;

        setGender(draftGender ?? profileGender);
        setInterestedIn(draftInterest ?? profileInterest);
        if (profile?.display_name) setDisplayName(profile.display_name);

        if (profile?.height_cm != null) setHeightCm(String(profile.height_cm));
        if (profile?.weight_kg != null) setWeightKg(String(profile.weight_kg));
        if (profile?.education_level && profile.education_level !== 'prefer_not_to_say') setEducationLevel(profile.education_level);
        if (profile?.relationship_status && profile.relationship_status !== 'prefer_not_to_say') setRelationshipStatus(profile.relationship_status);
        if (profile?.children_status && profile.children_status !== 'prefer_not_to_say') setChildrenStatus(profile.children_status);
        if (profile?.drinking_status && profile.drinking_status !== 'prefer_not_to_say') setDrinkingStatus(profile.drinking_status);
        if (profile?.smoking_status && profile.smoking_status !== 'prefer_not_to_say') setSmokingStatus(profile.smoking_status);

        if (!(draftGender ?? profileGender) || !(draftInterest ?? profileInterest)) {
          setErrorMessage('Không thể khôi phục lựa chọn ở bước đầu. Vui lòng đăng xuất và bắt đầu đăng ký lại.');
        }
      } catch (error) {
        if (active) setErrorMessage(getReadableOnboardingError(error));
      } finally {
        if (active) setIsChecking(false);
      }
    })();

    return () => { active = false; };
  }, [auth.isRestoring, auth.userId, router]);

  async function handleSubmit() {
    if (!gender || !interestedIn) {
      setErrorMessage('Thiếu lựa chọn giới tính / đối tượng kết nối từ bước đầu.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await saveSignupPersonalInfo({
        dateOfBirth,
        displayName,
        gender,
        interestedIn,
        heightCm,
        weightKg,
        educationLevel,
        relationshipStatus,
        childrenStatus,
        drinkingStatus,
        smokingStatus,
      });
      clearSignupDraft();
      router.replace('/onboarding/location');
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
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>Đang chuẩn bị hồ sơ…</Text>
      </View>
    );
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
        <Pressable accessibilityLabel="Đăng xuất" accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </SignupShell>
    );
  }

  return (
    <SignupShell
      onBack={() => router.replace('/(auth)')}
      step={3}
      testID="chon-onboarding-personal-info"
      title="Thông tin cá nhân"
    >
      <SignupFieldLabel required>Ngày sinh</SignupFieldLabel>
      <DateOfBirthSelector onChange={setDateOfBirth} />

      <SignupFieldLabel required>Tên hiển thị</SignupFieldLabel>
      <SignupTextField
        accessibilityLabel="Tên hiển thị"
        autoCapitalize="words"
        maxLength={50}
        onChangeText={setDisplayName}
        placeholder="Tên hiển thị trên hồ sơ"
        testID="signup-display-name"
        value={displayName}
      />
      <SignupCharacterCount current={displayNameLength} max={50} />
      {displayNameLength > 0 && !displayNameValid ? (
        <SignupHelpText tone="danger">Tên hiển thị cần từ 6 đến 50 ký tự.</SignupHelpText>
      ) : null}

      <View style={[styles.grid, compact && styles.gridCompact]}>
        <FieldSelect compact={compact} label="Chiều cao" value={heightCm} options={SIGNUP_HEIGHT_OPTIONS} onChange={setHeightCm} testID="signup-height" />
        <FieldSelect compact={compact} label="Cân nặng" value={weightKg} options={SIGNUP_WEIGHT_OPTIONS} onChange={setWeightKg} testID="signup-weight" />
        <FieldSelect compact={compact} label="Học vấn" value={educationLevel} options={SIGNUP_EDUCATION_OPTIONS} onChange={setEducationLevel} testID="signup-education" />
        <FieldSelect compact={compact} label="Tình trạng mối quan hệ" value={relationshipStatus} options={SIGNUP_RELATIONSHIP_OPTIONS} onChange={setRelationshipStatus} testID="signup-relationship" />
        <FieldSelect compact={compact} label="Con cái" value={childrenStatus} options={SIGNUP_CHILDREN_OPTIONS} onChange={setChildrenStatus} testID="signup-children" />
        <FieldSelect compact={compact} label="Uống rượu bia" value={drinkingStatus} options={SIGNUP_DRINKING_OPTIONS} onChange={setDrinkingStatus} testID="signup-drinking" />
        <FieldSelect compact={compact} label="Hút thuốc lá" value={smokingStatus} options={SIGNUP_SMOKING_OPTIONS} onChange={setSmokingStatus} testID="signup-smoking" />
      </View>

      <Text style={styles.policyCopy}>
        Khi tiếp tục, bạn xác nhận ngày sinh là chính xác, bạn từ đủ 18 tuổi và đồng ý với{' '}
        <Link href="/legal/terms" style={styles.inlineLink}>Điều khoản sử dụng</Link>{' '}và{' '}
        <Link href="/legal/community-standards" style={styles.inlineLink}>Tiêu chuẩn cộng đồng</Link> hiện hành.
      </Text>

      {errorMessage ? <SignupHelpText tone="danger">{errorMessage}</SignupHelpText> : null}
      <SignupPrimaryButton busy={isSubmitting} disabled={!canSubmit} label="Tiếp tục" onPress={() => void handleSubmit()} />
    </SignupShell>
  );
}

function FieldSelect({
  compact,
  label,
  value,
  options,
  onChange,
  testID,
}: {
  compact: boolean;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  testID: string;
}) {
  return (
    <View style={[styles.fieldCell, compact && styles.fieldCellCompact]}>
      <SignupFieldLabel>{label}</SignupFieldLabel>
      <SignupSelect accessibilityLabel={label} onChange={onChange} options={options} testID={testID} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  loadingText: { color: colors.muted, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 },
  gridCompact: { flexDirection: 'column', flexWrap: 'nowrap' },
  fieldCell: { flexBasis: '47%', flexGrow: 1, gap: 7, minWidth: 0 },
  fieldCellCompact: { flexBasis: 'auto', flexGrow: 0, minWidth: 0, width: '100%' },
  policyCopy: { color: colors.muted, fontSize: 11.5, lineHeight: 18, marginTop: 4 },
  inlineLink: { color: colors.accent, fontWeight: '800' },
  signOutButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 48, marginTop: 8 },
  signOutText: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
