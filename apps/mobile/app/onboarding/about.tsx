import { getMyProfile, listMyMedia } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SignupCharacterCount,
  SignupFieldLabel,
  SignupHelpText,
  SignupPrimaryButton,
  SignupShell,
  SignupTextField,
} from '@/components/signup-shell';
import { getMyOnboardingStatus, getReadableOnboardingError, saveSignupHeadlineBio } from '@/lib/onboarding';
import { isUsableSignupProfilePhoto } from '@/lib/signup-photo-contract';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const HEADLINE_MIN_LENGTH = 10;
const HEADLINE_MAX_LENGTH = 50;
const BIO_MIN_LENGTH = 50;
const BIO_MAX_LENGTH = 4000;

export default function OnboardingAbout() {
  const router = useRouter();
  const auth = useAuth();
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const headlineLength = headline.trim().length;
  const bioLength = bio.trim().length;
  const headlineValid = headlineLength === 0 || (headlineLength >= HEADLINE_MIN_LENGTH && headlineLength <= HEADLINE_MAX_LENGTH);
  const bioValid = bioLength >= BIO_MIN_LENGTH && bioLength <= BIO_MAX_LENGTH;
  const canSubmit = headlineValid && bioValid && !isSubmitting;

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

        const [profile, mediaRows] = await Promise.all([getMyProfile(client), listMyMedia(client)]);
        if (!active) return;
        if (profile.province_id == null) {
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

        setHeadline(profile.headline ?? '');
        setBio(profile.bio ?? '');
      } catch (error) {
        if (active) setErrorMessage(getReadableOnboardingError(error));
      } finally {
        if (active) setIsChecking(false);
      }
    })();

    return () => { active = false; };
  }, [auth.isRestoring, auth.userId, router]);

  async function handleContinue() {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await saveSignupHeadlineBio({ headline, bio });
      router.replace('/onboarding/selfie');
    } catch (error) {
      setErrorMessage(getReadableOnboardingError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking || auth.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.muted}>Đang chuẩn bị phần giới thiệu…</Text>
      </View>
    );
  }

  if (accountStatus) {
    const deletionRequested = accountStatus === 'deletion_requested';
    return (
      <SignupShell
        description={deletionRequested ? 'Hồ sơ và tính năng xã hội đang tắt trong thời gian chờ xử lý yêu cầu xóa.' : 'Tài khoản đang bị đình chỉ hoặc vô hiệu hóa.'}
        testID="chon-about-account-status"
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
      description="Giúp thành viên phù hợp hiểu bạn là ai. Tiêu đề có thể để trống; phần giới thiệu bản thân là bắt buộc."
      onBack={() => router.replace('/onboarding/photos')}
      step={7}
      testID="chon-onboarding-about"
      title="Giới thiệu về bạn"
    >
      <SignupFieldLabel>Tiêu đề hồ sơ</SignupFieldLabel>
      <SignupTextField
        accessibilityLabel="Tiêu đề hồ sơ"
        maxLength={HEADLINE_MAX_LENGTH}
        onChangeText={setHeadline}
        placeholder="Ví dụ: Yêu trải nghiệm mới và những cuộc trò chuyện có chiều sâu"
        testID="signup-headline"
        value={headline}
      />
      <View style={styles.counterRow}>
        <SignupHelpText tone={headlineLength > 0 && !headlineValid ? 'danger' : 'muted'}>
          {headlineLength === 0
            ? 'Không bắt buộc. Nếu nhập, hãy dùng từ 10–50 ký tự.'
            : headlineValid
              ? 'Một câu ngắn, tự nhiên và đúng với bạn.'
              : 'Tiêu đề cần từ 10–50 ký tự hoặc để trống.'}
        </SignupHelpText>
        <SignupCharacterCount current={headlineLength} max={HEADLINE_MAX_LENGTH} valid={headlineValid} />
      </View>

      <SignupFieldLabel required>Giới thiệu bản thân</SignupFieldLabel>
      <SignupTextField
        accessibilityLabel="Giới thiệu bản thân"
        maxLength={BIO_MAX_LENGTH}
        multiline
        numberOfLines={12}
        onChangeText={setBio}
        placeholder="Chia sẻ về bạn, lối sống, sở thích, điều bạn trân trọng và những điều khiến bạn trở nên đặc biệt…"
        style={styles.textArea}
        testID="signup-bio"
        value={bio}
      />
      <View style={styles.counterRow}>
        <SignupHelpText tone={bioLength > 0 && !bioValid ? 'danger' : 'muted'}>
          {bioLength < BIO_MIN_LENGTH
            ? `Cần ít nhất ${BIO_MIN_LENGTH} ký tự để hồ sơ đủ thông tin và đáng tin cậy.`
            : 'Tối đa 4000 ký tự. Không nên chia sẻ số điện thoại, địa chỉ riêng hoặc thông tin tài chính.'}
        </SignupHelpText>
        <SignupCharacterCount current={bioLength} max={BIO_MAX_LENGTH} valid={bioValid} />
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Hồ sơ rõ ràng tạo kết nối tốt hơn</Text>
        <Text style={styles.noteText}>
          Hãy viết bằng giọng thật của bạn, tập trung vào con người, giá trị và phong cách sống thay vì chỉ liệt kê thành tích.
        </Text>
      </View>

      {errorMessage ? <SignupHelpText tone="danger">{errorMessage}</SignupHelpText> : null}
      <SignupPrimaryButton
        busy={isSubmitting}
        disabled={!canSubmit}
        label="Tiếp tục xác minh"
        onPress={() => void handleContinue()}
      />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  muted: { color: colors.muted, fontSize: 14 },
  counterRow: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  textArea: { minHeight: 250, textAlignVertical: 'top' },
  noteCard: { backgroundColor: '#FFF9EA', borderColor: '#E8D391', borderRadius: 12, borderWidth: 1, gap: 6, padding: spacing.md },
  noteTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  noteText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  signOutButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 48 },
  signOutText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});