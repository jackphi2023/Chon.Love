import { luxyColors } from '@myfan/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
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
import { PublicFooter, PublicHeader } from '@/components/public-site-chrome';
import { SignupSecondaryButton } from '@/components/signup-shell';
import {
  resendEmailSignupOtp,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  startGoogleAuthentication,
  verifyEmailSignupOtp,
} from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';
import {
  clearSignupDraft,
  isCompleteEmailOtp,
  normalizeEmailOtp,
  patchSignupDraft,
  readSignupDraft,
  writeSignupDraft,
  type SignupGender,
  type SignupInterest,
} from '@/lib/signup-draft';
import { useAuth } from '@/providers/auth-provider';

type AuthMode = 'join' | 'login';
type JoinStep = 'preferences' | 'account' | 'otp';
type SubmitMode = 'email' | 'otp' | 'google' | 'resend' | null;

const googleAuthEnabled = process.env.EXPO_PUBLIC_FEATURE_GOOGLE_AUTH === 'true';
const AUTH_COMPACT_BREAKPOINT = 768;

export default function AuthHome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const [initialDraft] = useState(() => readSignupDraft());
  const [mode, setMode] = useState<AuthMode>(params.mode === 'login' ? 'login' : 'join');
  const [joinStep, setJoinStep] = useState<JoinStep>(() => {
    if (params.mode === 'login' || !initialDraft) return 'preferences';
    return initialDraft.stage === 'otp' ? 'otp' : 'account';
  });
  const [gender, setGender] = useState<SignupGender | null>(initialDraft?.gender ?? null);
  const [interest, setInterest] = useState<SignupInterest | null>(initialDraft?.interest ?? null);
  const [email, setEmail] = useState(initialDraft?.email ?? '');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [submitMode, setSubmitMode] = useState<SubmitMode>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const compact = width < AUTH_COMPACT_BREAKPOINT;
  const disabled = !auth.isConfigured || submitMode !== null;
  const googleDisabled = disabled || !googleAuthEnabled;

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setOtp('');
    setPassword('');
    if (nextMode === 'join') {
      const draft = readSignupDraft();
      if (draft) {
        setGender(draft.gender);
        setInterest(draft.interest);
        setEmail(draft.email ?? '');
        setJoinStep(draft.stage === 'otp' ? 'otp' : 'account');
      } else {
        setJoinStep('preferences');
      }
    } else {
      setJoinStep('preferences');
    }
    router.setParams({ mode: nextMode });
  }

  function continueFromPreferences() {
    setErrorMessage(null);
    if (!gender || !interest) {
      setErrorMessage('Hãy chọn đầy đủ giới tính của bạn và đối tượng bạn quan tâm.');
      return;
    }
    writeSignupDraft({ gender, interest, email: null, stage: 'account', updatedAt: Date.now() });
    setJoinStep('account');
  }

  async function handleLogin() {
    setErrorMessage(null);
    setSubmitMode('email');
    try {
      const destination = await signInWithEmailPassword(email, password);
      clearSignupDraft();
      router.replace(destination);
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleSignUp() {
    setErrorMessage(null);
    if (!gender || !interest) {
      setJoinStep('preferences');
      setErrorMessage('Hãy chọn đầy đủ giới tính của bạn và đối tượng bạn quan tâm.');
      return;
    }
    setSubmitMode('email');
    try {
      const result = await signUpWithEmailPassword(email, password);
      const normalizedEmail = email.trim().toLowerCase();
      setEmail(normalizedEmail);

      if (result.destination) {
        if (result.destination === '/(tabs)') clearSignupDraft();
        else {
          writeSignupDraft({
            gender,
            interest,
            email: normalizedEmail,
            stage: 'verified',
            updatedAt: Date.now(),
          });
        }
        router.replace(result.destination);
        return;
      }

      if (result.requiresEmailConfirmation) {
        setOtp('');
        writeSignupDraft({
          gender,
          interest,
          email: normalizedEmail,
          stage: 'otp',
          updatedAt: Date.now(),
        });
        setJoinStep('otp');
      }
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleVerifyOtp() {
    setErrorMessage(null);
    setSubmitMode('otp');
    try {
      const destination = await verifyEmailSignupOtp(email, otp);
      if (destination === '/(tabs)') clearSignupDraft();
      else patchSignupDraft({ stage: 'verified', updatedAt: Date.now() });
      router.replace(destination);
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleResendOtp() {
    setErrorMessage(null);
    setSubmitMode('resend');
    try {
      const normalizedEmail = await resendEmailSignupOtp(email);
      setEmail(normalizedEmail);
      patchSignupDraft({ email: normalizedEmail, stage: 'otp', updatedAt: Date.now() });
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleGoogle() {
    if (!googleAuthEnabled) return;
    setErrorMessage(null);
    if (mode === 'join') {
      if (!gender || !interest) {
        setJoinStep('preferences');
        setErrorMessage('Hãy chọn đầy đủ giới tính của bạn và đối tượng bạn quan tâm.');
        return;
      }
      writeSignupDraft({ gender, interest, email: null, stage: 'account', updatedAt: Date.now() });
    }
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
      <PublicHeader
        actionLabel={mode === 'join' ? 'Đăng nhập' : 'Đăng ký'}
        compact={compact}
        onAction={() => switchMode(mode === 'join' ? 'login' : 'join')}
        onHome={() => router.replace('/')}
        prompt={mode === 'join' ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
        variant="solid"
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.authPanel, compact && styles.authPanelCompact]} testID="signup-auth-panel">
          {mode === 'join' ? (
            joinStep === 'preferences' ? (
              <JoinPreferences
                errorMessage={errorMessage}
                gender={gender}
                interest={interest}
                onContinue={continueFromPreferences}
                onGender={setGender}
                onInterest={setInterest}
              />
            ) : joinStep === 'account' ? (
              <AccountForm
                disabled={disabled}
                email={email}
                errorMessage={errorMessage}
                googleDisabled={googleDisabled}
                mode="join"
                onBack={() => {
                  setJoinStep('preferences');
                  setErrorMessage(null);
                  setPassword('');
                }}
                onEmail={setEmail}
                onGoogle={handleGoogle}
                onPassword={setPassword}
                onSubmit={handleSignUp}
                password={password}
                submitMode={submitMode}
              />
            ) : (
              <OtpForm
                disabled={disabled}
                email={email}
                errorMessage={errorMessage}
                onBack={() => {
                  patchSignupDraft({ stage: 'account', updatedAt: Date.now() });
                  setJoinStep('account');
                  setErrorMessage(null);
                  setOtp('');
                  setPassword('');
                }}
                onOtp={(value) => setOtp(normalizeEmailOtp(value))}
                onResend={() => void handleResendOtp()}
                onSubmit={() => void handleVerifyOtp()}
                otp={otp}
                submitMode={submitMode}
              />
            )
          ) : (
            <AccountForm
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
            />
          )}
        </View>

        <PublicFooter
          compact={compact}
          onCommunity={() => router.push('/legal/community-standards')}
          onTerms={() => router.push('/legal/terms')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function JoinPreferences({
  errorMessage,
  gender,
  interest,
  onGender,
  onInterest,
  onContinue,
}: {
  errorMessage: string | null;
  gender: SignupGender | null;
  interest: SignupInterest | null;
  onGender: (value: SignupGender) => void;
  onInterest: (value: SignupInterest) => void;
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

      {errorMessage ? <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

      <Pressable
        accessibilityLabel="Tiếp tục đăng ký"
        accessibilityRole="button"
        onPress={onContinue}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Tiếp tục</Text>
      </Pressable>

      <Text style={styles.ageNote}>Chon.Love dành cho người trưởng thành tìm kiếm những kết nối nghiêm túc. Sau khi tạo tài khoản, bạn sẽ hoàn tất thông tin và các bước xác minh cần thiết trước khi sử dụng đầy đủ.</Text>
    </View>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.choiceRow}>{children}</View>
    </View>
  );
}

function ChoiceButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
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
}: {
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
}) {
  const login = mode === 'login';
  return (
    <View style={styles.accountForm}>
      {onBack ? (
        <Pressable accessibilityLabel="Quay lại bước chọn giới tính và đối tượng quan tâm" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹ Quay lại</Text>
        </Pressable>
      ) : null}

      <Text accessibilityRole="header" style={styles.heading}>{login ? 'Đăng nhập' : 'Đăng ký bằng email'}</Text>
      <Text style={styles.subheading}>{login ? 'Đăng nhập để tiếp tục trên Chon.Love.' : 'Nhập email và tạo mật khẩu tối thiểu 8 ký tự. Sau đó Chon.Love sẽ gửi mã OTP 6 số để xác thực email.'}</Text>

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
          placeholder={login ? 'Nhập mật khẩu' : 'Tối thiểu 8 ký tự'}
          placeholderTextColor={luxyColors.muted}
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {!login ? <Text style={styles.passwordHelp}>Mật khẩu cần ít nhất 8 ký tự.</Text> : null}
      </View>

      {login && onForgotPassword ? (
        <Pressable accessibilityLabel="Quên mật khẩu" accessibilityRole="link" onPress={onForgotPassword} style={styles.forgotButton}>
          <Text style={styles.linkText}>Quên mật khẩu?</Text>
        </Pressable>
      ) : null}

      {errorMessage ? <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

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
        accessibilityLabel="Tiếp tục với Gmail"
        accessibilityRole="button"
        accessibilityState={{ disabled: googleDisabled, busy: submitMode === 'google' }}
        disabled={googleDisabled}
        onPress={onGoogle}
        style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, googleDisabled && styles.disabled]}
      >
        <View accessible={false} style={styles.googleMark}><Text accessibilityElementsHidden style={styles.googleMarkText}>G</Text></View>
        {submitMode === 'google' ? <ActivityIndicator color={luxyColors.ink} /> : <Text style={styles.googleButtonText}>Tiếp tục với Gmail</Text>}
      </Pressable>

      {!login ? (
        <Text style={styles.termsText}>Bằng cách tạo tài khoản, bạn đồng ý với Điều khoản sử dụng và Tiêu chuẩn cộng đồng của Chon.Love.</Text>
      ) : null}
    </View>
  );
}

function OtpForm({
  disabled,
  email,
  errorMessage,
  onBack,
  onOtp,
  onResend,
  onSubmit,
  otp,
  submitMode,
}: {
  disabled: boolean;
  email: string;
  errorMessage: string | null;
  onBack: () => void;
  onOtp: (value: string) => void;
  onResend: () => void;
  onSubmit: () => void;
  otp: string;
  submitMode: SubmitMode;
}) {
  const verifyDisabled = disabled || !isCompleteEmailOtp(otp);
  return (
    <View style={styles.accountForm} testID="signup-email-otp-step">
      <Pressable accessibilityLabel="Thay đổi email hoặc mật khẩu" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Thay đổi email / mật khẩu</Text>
      </Pressable>

      <Text accessibilityRole="header" style={styles.heading}>Xác thực email</Text>
      <Text style={styles.subheading}>Tài khoản đã được tạo với mật khẩu của bạn. Nhập mã OTP 6 số đã được gửi tới {email} để xác thực email và tiếp tục.</Text>

      <View style={styles.formFields}>
        <Text style={styles.fieldLabel}>Mã xác thực</Text>
        <TextInput
          accessibilityLabel="Mã OTP"
          autoComplete="one-time-code"
          autoFocus
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={onOtp}
          onSubmitEditing={onSubmit}
          placeholder="000000"
          placeholderTextColor={luxyColors.softMuted}
          style={[styles.input, styles.otpInput]}
          value={otp}
        />
        <Text style={styles.otpHelp}>Mã gồm 6 chữ số và chỉ sử dụng một lần.</Text>
      </View>

      {errorMessage ? <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

      <SignupSecondaryButton
        busy={submitMode === 'otp'}
        disabled={verifyDisabled}
        label="Tiếp tục"
        onPress={onSubmit}
      />

      <Pressable
        accessibilityLabel="Gửi lại mã OTP"
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: submitMode === 'resend' }}
        disabled={disabled}
        onPress={onResend}
        style={({ pressed }) => [styles.resendButton, pressed && styles.pressed, disabled && styles.disabled]}
      >
        {submitMode === 'resend' ? <ActivityIndicator color={luxyColors.actionRed} /> : <Text style={styles.linkText}>Gửi lại mã OTP</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingTop: 48, backgroundColor: '#FFFFFF' },
  scrollContentCompact: { paddingTop: 28 },
  authPanel: { width: '100%', maxWidth: 456, paddingHorizontal: 8, paddingBottom: 54, paddingVertical: 0 },
  authPanelCompact: { paddingHorizontal: 24, paddingBottom: 38 },
  preferenceForm: { gap: 0 },
  heading: { color: luxyColors.ink, fontSize: 26, lineHeight: 34, fontWeight: '500', textAlign: 'center', marginBottom: 30 },
  subheading: { color: luxyColors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: -18, marginBottom: 22 },
  choiceGroup: { marginBottom: 26 },
  choiceLabel: { color: luxyColors.ink, fontSize: 20, lineHeight: 27, fontWeight: '500', marginBottom: 12 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choiceButton: {
    minHeight: 48,
    flex: 1,
    borderWidth: 1,
    borderColor: '#AEB5BB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  choiceButtonSelected: { borderWidth: 2, borderColor: '#F2B51D', backgroundColor: '#FFF1B8' },
  choiceButtonText: { color: luxyColors.ink, fontSize: 16, fontWeight: '500' },
  choiceButtonTextSelected: { color: '#6F4B00', fontWeight: '700' },
  ageNote: { color: luxyColors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 14 },
  accountForm: { gap: 0 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginBottom: 2, paddingHorizontal: 2 },
  backText: { color: luxyColors.ink, fontSize: 16, fontWeight: '600' },
  formFields: { gap: 8 },
  fieldLabel: { color: luxyColors.ink, fontSize: 15, fontWeight: '700', marginTop: 8 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#AEB5BB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    color: luxyColors.ink,
    fontSize: 16,
  },
  passwordHelp: { color: luxyColors.muted, fontSize: 11, lineHeight: 17 },
  otpInput: { fontSize: 24, fontWeight: '700', letterSpacing: 8, textAlign: 'center' },
  otpHelp: { color: luxyColors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  forgotButton: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center' },
  linkText: { color: luxyColors.actionRed, fontSize: 16, fontWeight: '700' },
  primaryButton: {
    minHeight: 50,
    marginTop: 8,
    backgroundColor: luxyColors.actionRed,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: '#C81C1D',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    width: '100%',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  divider: { flex: 1, height: 1, backgroundColor: '#D9D9D9' },
  dividerText: { color: luxyColors.muted, fontSize: 12 },
  googleButton: {
    minHeight: 50,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#AEB5BB',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  googleMark: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F5F6', alignItems: 'center', justifyContent: 'center' },
  googleMarkText: { color: '#4285F4', fontSize: 16, fontWeight: '800' },
  googleButtonText: { color: luxyColors.ink, fontSize: 16, fontWeight: '600' },
  termsText: { color: luxyColors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 16 },
  error: { color: luxyColors.danger, fontSize: 11, lineHeight: 17, marginBottom: 10, textAlign: 'center' },
  resendButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 8 },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.48 },
});