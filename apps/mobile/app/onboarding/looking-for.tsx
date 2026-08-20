import { getMyProfile, type ProfileLifestyleTag } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SignupCharacterCount,
  SignupFieldLabel,
  SignupHelpText,
  SignupPrimaryButton,
  SignupShell,
  SignupTag,
  SignupTextField,
} from '@/components/signup-shell';
import { getMyOnboardingStatus, getReadableOnboardingError, saveSignupLookingFor } from '@/lib/onboarding';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type TagOption = { value: ProfileLifestyleTag; label: string };

const LOOKING_FOR_MIN_LENGTH = 50;
const LOOKING_FOR_MAX_LENGTH = 4000;
const SIGNUP_MAX_TAGS = 7;

const TAG_OPTIONS: TagOption[] = [
  { value: 'true_love', label: 'Tình yêu thật sự' },
  { value: 'long_term', label: 'Mối quan hệ lâu dài' },
  { value: 'marriage_minded', label: 'Hướng tới hôn nhân' },
  { value: 'monogamous', label: 'Một vợ một chồng' },
  { value: 'emotional_connection', label: 'Kết nối cảm xúc' },
  { value: 'romantic', label: 'Lãng mạn' },
  { value: 'friendship', label: 'Bạn bè' },
  { value: 'platonic', label: 'Kết nối trong sáng' },
  { value: 'luxury_lifestyle', label: 'Phong cách sống cao cấp' },
  { value: 'refined', label: 'Tinh tế' },
  { value: 'active_lifestyle', label: 'Sống năng động' },
  { value: 'flexible_schedule', label: 'Lịch trình linh hoạt' },
  { value: 'ready_to_travel', label: 'Sẵn sàng du lịch' },
  { value: 'travel_companion', label: 'Bạn đồng hành du lịch' },
  { value: 'vacation', label: 'Kỳ nghỉ' },
  { value: 'fine_dining', label: 'Ẩm thực cao cấp' },
  { value: 'entertainment_events', label: 'Sự kiện / giải trí' },
];

export default function OnboardingLookingFor() {
  const router = useRouter();
  const auth = useAuth();
  const [lookingFor, setLookingFor] = useState('');
  const [selectedTags, setSelectedTags] = useState<ProfileLifestyleTag[]>([]);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedLength = lookingFor.trim().length;
  const textValid = trimmedLength >= LOOKING_FOR_MIN_LENGTH && trimmedLength <= LOOKING_FOR_MAX_LENGTH;
  const tagsValid = selectedTags.length >= 1 && selectedTags.length <= SIGNUP_MAX_TAGS;
  const canSubmit = textValid && tagsValid && !isSubmitting;

  const selectedSummary = useMemo(
    () => `${selectedTags.length}/${SIGNUP_MAX_TAGS} đã chọn`,
    [selectedTags.length],
  );

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

        const profile = await getMyProfile(client);
        if (!active) return;
        if (profile.province_id == null) {
          router.replace('/onboarding/location');
          return;
        }

        setLookingFor(profile.looking_for ?? '');
        setSelectedTags((profile.lifestyle_tags ?? []).slice(0, SIGNUP_MAX_TAGS));
      } catch (error) {
        if (active) setErrorMessage(getReadableOnboardingError(error));
      } finally {
        if (active) setIsChecking(false);
      }
    })();

    return () => { active = false; };
  }, [auth.isRestoring, auth.userId, router]);

  function toggleTag(tag: ProfileLifestyleTag) {
    setErrorMessage(null);
    setSelectedTags((current) => {
      if (current.includes(tag)) return current.filter((item) => item !== tag);
      if (current.length >= SIGNUP_MAX_TAGS) return current;
      return [...current, tag];
    });
  }

  async function handleContinue() {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await saveSignupLookingFor({
        lookingFor,
        lifestyleTags: selectedTags,
      });
      router.replace('/onboarding/profile');
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
        <Text style={styles.loadingText}>Đang chuẩn bị bước tiếp theo…</Text>
      </View>
    );
  }

  if (accountStatus) {
    const deletionRequested = accountStatus === 'deletion_requested';
    return (
      <SignupShell
        description={deletionRequested ? 'Hồ sơ và tính năng xã hội đang tắt trong thời gian chờ xử lý yêu cầu xóa.' : 'Tài khoản đang bị đình chỉ hoặc vô hiệu hóa.'}
        testID="chon-looking-for-account-status"
        title={deletionRequested ? 'Tài khoản đang chờ xóa' : 'Tài khoản chưa thể truy cập'}
      >
        <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </SignupShell>
    );
  }

  return (
    <SignupShell
      description="Chia sẻ kiểu mối quan hệ bạn mong muốn, điều quan trọng với bạn và điều bạn muốn tìm thấy ở một người phù hợp."
      onBack={() => router.replace('/onboarding/location')}
      step={5}
      testID="chon-onboarding-looking-for"
      title="Bạn đang tìm kiếm điều gì?"
    >
      <SignupFieldLabel required>Mô tả điều bạn đang tìm kiếm</SignupFieldLabel>
      <SignupTextField
        accessibilityLabel="Mô tả điều bạn đang tìm kiếm"
        maxLength={LOOKING_FOR_MAX_LENGTH}
        multiline
        numberOfLines={10}
        onChangeText={setLookingFor}
        placeholder="Ví dụ: Tôi mong muốn tìm một mối quan hệ chân thành, tôn trọng, có thể cùng chia sẻ cuộc sống và phát triển lâu dài…"
        style={styles.textArea}
        testID="signup-looking-for-text"
        value={lookingFor}
      />
      <View style={styles.counterRow}>
        <SignupHelpText tone={trimmedLength > 0 && trimmedLength < LOOKING_FOR_MIN_LENGTH ? 'danger' : 'muted'}>
          {trimmedLength < LOOKING_FOR_MIN_LENGTH
            ? `Cần ít nhất ${LOOKING_FOR_MIN_LENGTH} ký tự để thành viên khác hiểu rõ mong muốn của bạn.`
            : 'Hãy viết cụ thể nhưng tránh chia sẻ thông tin nhạy cảm như số điện thoại hoặc địa chỉ riêng.'}
        </SignupHelpText>
        <SignupCharacterCount current={trimmedLength} max={LOOKING_FOR_MAX_LENGTH} valid={textValid} />
      </View>

      <View style={styles.sectionDivider} />

      <SignupFieldLabel required>Mục tiêu / phong cách phù hợp</SignupFieldLabel>
      <View style={styles.tagHeaderRow}>
        <SignupHelpText>Chọn từ 1 đến 7 thẻ phù hợp nhất với điều bạn đang tìm kiếm.</SignupHelpText>
        <Text style={[styles.selectedCount, tagsValid && styles.selectedCountValid]}>{selectedSummary}</Text>
      </View>
      <View style={styles.tagsWrap} testID="signup-looking-for-tags">
        {TAG_OPTIONS.map((option) => {
          const selected = selectedTags.includes(option.value);
          return (
            <SignupTag
              disabled={!selected && selectedTags.length >= SIGNUP_MAX_TAGS}
              key={option.value}
              label={option.label}
              onPress={() => toggleTag(option.value)}
              selected={selected}
            />
          );
        })}
      </View>
      {selectedTags.length >= SIGNUP_MAX_TAGS ? (
        <SignupHelpText tone="success">✓ Bạn đã chọn tối đa 7 thẻ. Bỏ chọn một thẻ nếu muốn thay đổi.</SignupHelpText>
      ) : null}

      {errorMessage ? <SignupHelpText tone="danger">{errorMessage}</SignupHelpText> : null}
      <SignupPrimaryButton
        busy={isSubmitting}
        disabled={!canSubmit}
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
  textArea: { minHeight: 220 },
  counterRow: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  sectionDivider: { backgroundColor: colors.border, height: 1, marginVertical: 4 },
  tagHeaderRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  selectedCount: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  selectedCountValid: { color: '#15803D' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  signOutButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  signOutText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});