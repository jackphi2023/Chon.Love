import {
  luxyBrand,
  luxyColors,
  luxySpacing,
  luxyTypography,
} from '@myfan/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  signInWithEmailPassword,
  signUpWithEmailPassword,
  startGoogleAuthentication,
} from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';
import { useAuth } from '@/providers/auth-provider';

type AuthMode = 'join' | 'login';
type JoinStep = 'preferences' | 'account';
type Gender = 'male' | 'female';
type Interest = 'female' | 'male' | 'everyone';
type SubmitMode = 'email' | 'google' | null;

const googleAuthEnabled = process.env.EXPO_PUBLIC_FEATURE_GOOGLE_AUTH === 'true';

export default function AuthHome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<AuthMode>(params.mode === 'login' ? 'login' : 'join');
  const [joinStep, setJoinStep] = useState<JoinStep>('preferences');
  const [gender, setGender] = useState<Gender | null>(null);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitMode, setSubmitMode] = useState<SubmitMode>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const compact = width < 768;
  const disabled = !auth.isConfigured || submitMode !== null;
  const googleDisabled = disabled || !googleAuthEnabled;

  useEffect(() => {
    setMode(params.mode === 'login' ? 'login' : 'join');
    setJoinStep('preferences');
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [params.mode]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setJoinStep('preferences');
    setErrorMessage(null);
    setSuccessMessage(null);
    router.setParams({ mode: nextMode });
  }

  async function handleLogin() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitMode('email');
    try {
      const destination = await signInWithEmailPassword(email, password);
      router.replace(destination);
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleSignUp() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitMode('email');
    try {
      const result = await signUpWithEmailPassword(email, password);
      if (result.destination) {
        router.replace(result.destination);
        return;
      }
      if (result.requiresEmailConfirmation) {
        setSuccessMessage('Tài khoản đã được tạo. Hãy kiểm tra email để xác nhận, sau đó đăng nhập để tiếp tục xác minh 18+.');
      }
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleGoogle() {
    if (!googleAuthEnabled) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitMode('google');
    try {
      await startGoogleAuthentication();
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
      setSubmitMode(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} testID="luxy-auth-screen">
      <View style={[styles.header, compact && styles.headerCompact]}>
        <Pressable
          accessibilityLabel="Luxy.Love — về trang chủ"
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.brandButton, pressed && styles.pressed]}
        >
          <Text style={[styles.brand, compact && styles.brandCompact]}>{compact ? luxyBrand.shortName : luxyBrand.productName}</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Text style={[styles.headerPrompt, compact && styles.headerPromptCompact]}>
            {mode === 'join' ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => switchMode(mode === 'join' ? 'login' : 'join')}
            style={({ pressed }) => [styles.headerActionButton, pressed && styles.pressed]}
          >
            <Text style={styles.headerActionText}>{mode === 'join' ? 'Đăng nhập' : 'Tham gia'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.authPanel, compact && styles.authPanelCompact]}>
          <Text style={styles.panelBrand}>{luxyBrand.productName}</Text>

          {mode === 'join' ? (
            joinStep === 'preferences' ? (
              <JoinPreferences
                gender={gender}
                interest={interest}
                onGender={setGender}
                onInterest={setInterest}
                onContinue={() => {
                  setErrorMessage(null);
                  if (!gender || !interest) {
                    setErrorMessage('Hãy chọn đầy đủ giới tính của bạn và đối tượng bạn quan tâm.');
                    return;
                  }
                  setJoinStep('account');
                }}
              />
            ) : (
              <AccountForm
                compact={compact}
                disabled={disabled}
                email={email}
                errorMessage={errorMessage}
                googleDisabled={googleDisabled}
                mode="join"
                onBack={() => {
                  setJoinStep('preferences');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                onEmail={setEmail}
                onGoogle={handleGoogle}
                onPassword={setPassword}
                onSubmit={handleSignUp}
                password={password}
                submitMode={submitMode}
                successMessage={successMessage}
              />
            )
          ) : (
            <AccountForm
              compact={compact}
              disabled={disabled}
              email={email}
              errorMessage={errorMessage}
              googleDisabled={googleDisabled}
              mode="login"
              onEmail={setEmail}
              onForgotPassword={() => router.push('/auth/forgot-password')}
              onGoogle={handleGoogle}
              onPassword={setPassword}
              onSubmit={handleLogin}
              password={password}
              submitMode={submitMode}
              successMessage={successMessage}
            />
          )}
        </View>

        <AuthFooter compact={compact} />
      </ScrollView>
    </SafeAreaView>
  );
}

function JoinPreferences({
  gender,
  interest,
  onGender,
  onInterest,
  onContinue,
}: {
  gender: Gender | null;
  interest: Interest | null;
  onGender: (value: Gender) => void;
  onInterest: (value: Interest) => void;
  onContinue: () => void;
}) {
  return (
    <View style={styles.preferenceForm}>
      <Text accessibilityRole="header" style={styles.heading}>Đăng ký</Text>
      <ChoiceGroup label="Tôi là...">
        <ChoiceButton label="Nam" selected={gender === 'male'} onPress={() => onGender('male')} />
        <ChoiceButton label="Nữ" selected={gender === 'female'} onPress={() => onGender('female')} />
      </ChoiceGroup>

      <ChoiceGroup label="Quan tâm đến...">
        <ChoiceButton label="Nữ" selected={interest === 'female'} onPress={() => onInterest('female')} />
        <ChoiceButton label="Nam" selected={interest === 'male'} onPress={() => onInterest('male')} />
        <ChoiceButton label="Tất cả" selected={interest === 'everyone'} onPress={() => onInterest('everyone')} />
      </ChoiceGroup>

      <Pressable
        accessibilityLabel="Tiếp tục đăng ký"
        accessibilityRole="button"
        onPress={onContinue}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Tiếp tục</Text>
      </Pressable>
      <Text style={styles.ageNote}>Luxy.Love chỉ dành cho người từ đủ 18 tuổi. Xác minh tuổi là bước bắt buộc sau khi tạo tài khoản.</Text>
    </View>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceRow}>{children}</View>
    </View>
  );
}

function ChoiceButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceButton, selected && styles.choiceButtonSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.choiceButtonText, selected && styles.choiceButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function AccountForm({
  compact,
  disabled,
  email,
  errorMessage,
  googleDisabled,
  mode,
  onBack,
  onEmail,
  onForgotPassword,
  onGoogle,
  onPassword,
  onSubmit,
  password,
  submitMode,
  successMessage,
}: {
  compact: boolean;
  disabled: boolean;
  email: string;
  errorMessage: string | null;
  googleDisabled: boolean;
  mode: AuthMode;
  onBack?: () => void;
  onEmail: (value: string) => void;
  onForgotPassword?: () => void;
  onGoogle: () => void;
  onPassword: (value: string) => void;
  onSubmit: () => void;
  password: string;
  submitMode: SubmitMode;
  successMessage: string | null;
}) {
  const login = mode === 'login';
  return (
    <View style={styles.accountForm}>
      {onBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹ Quay lại</Text>
        </Pressable>
      ) : null}
      <Text accessibilityRole="header" style={[styles.heading, compact && styles.headingCompact]}>{login ? 'Đăng nhập' : 'Tạo tài khoản'}</Text>
      <Text style={styles.subheading}>{login ? 'Chào mừng bạn trở lại Luxy.Love.' : 'Tạo thông tin đăng nhập để tiếp tục hồ sơ của bạn.'}</Text>

      <View style={styles.formFields}>
        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={onEmail}
          placeholder="email@example.com"
          placeholderTextColor={luxyColors.muted}
          style={styles.input}
          value={email}
        />
        <Text style={styles.fieldLabel}>Mật khẩu</Text>
        <TextInput
          accessibilityLabel="Mật khẩu"
          autoCapitalize="none"
          autoComplete={login ? 'current-password' : 'new-password'}
          onChangeText={onPassword}
          onSubmitEditing={onSubmit}
          placeholder={login ? 'Nhập mật khẩu' : 'Tối thiểu 10 ký tự'}
          placeholderTextColor={luxyColors.muted}
          secureTextEntry
          style={styles.input}
          value={password}
        />
      </View>

      {login && onForgotPassword ? (
        <Pressable accessibilityLabel="Quên mật khẩu" accessibilityRole="link" onPress={onForgotPassword} style={styles.forgotButton}>
          <Text style={styles.linkText}>Quên mật khẩu?</Text>
        </Pressable>
      ) : null}

      {errorMessage ? <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
      {successMessage ? <Text accessibilityLiveRegion="polite" style={styles.success}>{successMessage}</Text> : null}

      <Pressable
        accessibilityLabel={login ? 'Đăng nhập bằng email' : 'Tạo tài khoản bằng email'}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: submitMode === 'email' }}
        disabled={disabled}
        onPress={onSubmit}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, disabled && styles.disabled]}
      >
        {submitMode === 'email' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{login ? 'Đăng nhập' : 'Tạo tài khoản'}</Text>}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>hoặc</Text>
        <View style={styles.divider} />
      </View>

      <Pressable
        accessibilityLabel="Tiếp tục với Google"
        accessibilityRole="button"
        accessibilityState={{ disabled: googleDisabled, busy: submitMode === 'google' }}
        disabled={googleDisabled}
        onPress={onGoogle}
        style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, googleDisabled && styles.disabled]}
      >
        <View style={styles.googleMark}><Text style={styles.googleMarkText}>G</Text></View>
        {submitMode === 'google' ? <ActivityIndicator color={luxyColors.ink} /> : <Text style={styles.googleButtonText}>Tiếp tục với Google</Text>}
      </Pressable>

      {!googleAuthEnabled ? <Text style={styles.oauthNote}>Google đang tạm tắt cho đến khi provider được bật trong Supabase.</Text> : null}
      {!authConfiguredMessage(disabled, submitMode) ? null : <Text style={styles.oauthNote}>Cần cấu hình Supabase để bật xác thực.</Text>}

      {!login ? (
        <Text style={styles.termsText}>
          Bằng cách tạo tài khoản, bạn đồng ý tiếp tục tới bước xác minh 18+ và chấp nhận Điều khoản cùng Tiêu chuẩn cộng đồng trước khi sử dụng Luxy.Love.
        </Text>
      ) : null}
    </View>
  );
}

function authConfiguredMessage(disabled: boolean, submitMode: SubmitMode): boolean {
  return disabled && submitMode === null;
}

function AuthFooter({ compact }: { compact: boolean }) {
  return (
    <View style={[styles.footer, compact && styles.footerCompact]}>
      <Text style={styles.footerLanguage}>Tiếng Việt</Text>
      <View style={styles.footerLinks}>
        <Text style={styles.footerLink}>Quyền riêng tư</Text>
        <Text style={styles.footerLink}>Điều khoản</Text>
        <Text style={styles.footerLink}>Hẹn hò an toàn</Text>
        <Text style={styles.footerLink}>Hỗ trợ</Text>
      </View>
      <Text style={styles.footerNotice}>Thành viên Luxy không mặc nhiên được coi là đã qua kiểm tra lý lịch. Các dấu xác thực chỉ phản ánh đúng loại xác thực đã hoàn tất.</Text>
      <Text style={styles.footerCopyright}>© 2026 Luxy.Love. Bảo lưu mọi quyền.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F7F7' },
  header: { minHeight: 72, paddingHorizontal: 40, backgroundColor: luxyColors.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCompact: { minHeight: 62, paddingHorizontal: 18 },
  brandButton: { minHeight: 44, justifyContent: 'center' },
  brand: { color: '#FFFFFF', fontFamily: luxyTypography.families.brand, fontSize: 30, letterSpacing: -1.2 },
  brandCompact: { fontSize: 26 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerPrompt: { color: '#DDE3E8', fontSize: 14 },
  headerPromptCompact: { display: 'none' },
  headerActionButton: { minHeight: 44, minWidth: 92, paddingHorizontal: 16, borderWidth: 1, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  scrollContent: { flexGrow: 1, minHeight: '100%', alignItems: 'center', paddingTop: 56 },
  scrollContentCompact: { paddingTop: 24 },
  authPanel: { width: '100%', maxWidth: 520, backgroundColor: '#FFFFFF', paddingHorizontal: 48, paddingVertical: 42, borderWidth: 1, borderColor: '#E3E3E3' },
  authPanelCompact: { maxWidth: 520, width: '100%', borderLeftWidth: 0, borderRightWidth: 0, paddingHorizontal: 24, paddingVertical: 32 },
  panelBrand: { color: luxyColors.brandCoral, fontFamily: luxyTypography.families.brand, fontSize: 34, letterSpacing: -1.3, textAlign: 'center', marginBottom: 24 },
  preferenceForm: { gap: 24 },
  heading: { color: luxyColors.ink, fontSize: 30, lineHeight: 38, fontWeight: '600', textAlign: 'center' },
  headingCompact: { fontSize: 28 },
  subheading: { color: luxyColors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  choiceGroup: { gap: 10 },
  choiceLabel: { color: luxyColors.ink, fontSize: 16, fontWeight: '600' },
  choiceRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  choiceButton: { minHeight: 50, flexGrow: 1, minWidth: 120, borderWidth: 1, borderColor: '#C7CDD2', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  choiceButtonSelected: { borderColor: luxyColors.actionRed, backgroundColor: '#FFF4F3' },
  choiceButtonText: { color: luxyColors.ink, fontSize: 15, fontWeight: '600' },
  choiceButtonTextSelected: { color: luxyColors.actionRed },
  ageNote: { color: luxyColors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  accountForm: { gap: 0 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginBottom: 4 },
  backText: { color: luxyColors.ink, fontSize: 14, fontWeight: '600' },
  formFields: { marginTop: 26, gap: 8 },
  fieldLabel: { color: luxyColors.ink, fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#BFC5CA', backgroundColor: '#FFFFFF', paddingHorizontal: 14, color: luxyColors.ink, fontSize: 16 },
  forgotButton: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center' },
  linkText: { color: luxyColors.actionRed, fontSize: 13, fontWeight: '600' },
  primaryButton: { minHeight: 52, marginTop: 18, backgroundColor: luxyColors.actionRed, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  divider: { flex: 1, height: 1, backgroundColor: '#D9D9D9' },
  dividerText: { color: luxyColors.muted, fontSize: 13 },
  googleButton: { minHeight: 52, marginTop: 18, borderWidth: 1, borderColor: '#C7CDD2', backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  googleMark: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F5F6', alignItems: 'center', justifyContent: 'center' },
  googleMarkText: { color: '#4285F4', fontSize: 17, fontWeight: '800' },
  googleButtonText: { color: luxyColors.ink, fontSize: 15, fontWeight: '600' },
  oauthNote: { color: luxyColors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 },
  termsText: { color: luxyColors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
  error: { color: luxyColors.danger, fontSize: 13, lineHeight: 19, marginTop: 12, textAlign: 'center' },
  success: { color: '#17653A', fontSize: 13, lineHeight: 19, marginTop: 12, textAlign: 'center' },
  footer: { width: '100%', maxWidth: 1040, alignItems: 'center', paddingHorizontal: 24, paddingTop: 38, paddingBottom: 30, gap: 12 },
  footerCompact: { paddingTop: 28, paddingBottom: 24 },
  footerLanguage: { color: luxyColors.ink, fontSize: 13, fontWeight: '600' },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  footerLink: { color: luxyColors.muted, fontSize: 12 },
  footerNotice: { color: luxyColors.muted, fontSize: 10, lineHeight: 15, maxWidth: 760, textAlign: 'center', textTransform: 'uppercase' },
  footerCopyright: { color: luxyColors.muted, fontSize: 11 },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.48 },
});
