import {
  luxyBrand,
  luxyColors,
  luxyTypography,
} from '@myfan/ui';
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
          accessibilityLabel="Chon.Love — về trang chủ"
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.brandButton, pressed && styles.pressed]}
        >
          <Text style={[styles.brand, compact && styles.brandCompact]}>{luxyBrand.productName}</Text>
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
          {mode === 'join' ? (
            joinStep === 'preferences' ? (
              <JoinPreferences
                errorMessage={errorMessage}
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
  errorMessage,
  gender,
  interest,
  onGender,
  onInterest,
  onContinue,
}: {
  errorMessage: string | null;
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

      {errorMessage ? <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

      <Pressable
        accessibilityLabel="Tiếp tục đăng ký"
        accessibilityRole="button"
        onPress={onContinue}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Tiếp tục</Text>
      </Pressable>

      <Text style={styles.ageNote}>Chỉ dành cho người từ đủ 18 tuổi. Sau khi tạo tài khoản, Chon.Love sẽ yêu cầu xác minh tuổi trước khi sử dụng đầy đủ.</Text>
    </View>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
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

      <Text accessibilityRole="header" style={styles.heading}>{login ? 'Đăng nhập' : 'Đăng ký'}</Text>
      <Text style={styles.subheading}>{login ? 'Đăng nhập để tiếp tục trên Chon.Love.' : 'Tạo thông tin đăng nhập cho tài khoản Chon.Love của bạn.'}</Text>

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

      {!login ? (
        <Text style={styles.termsText}>Bằng cách tạo tài khoản, bạn đồng ý tiếp tục tới bước xác minh 18+ và chấp nhận Điều khoản cùng Tiêu chuẩn cộng đồng trước khi sử dụng Chon.Love.</Text>
      ) : null}
    </View>
  );
}

function AuthFooter({ compact }: { compact: boolean }) {
  return (
    <View style={[styles.footer, compact && styles.footerCompact]}>
      <Text style={styles.footerLanguage}>Tiếng Việt</Text>
      <View style={styles.footerLinks}>
        <Text style={styles.footerLink}>Blog</Text>
        <Text style={styles.footerLink}>Quyền riêng tư</Text>
        <Text style={styles.footerLink}>Điều khoản</Text>
        <Text style={styles.footerLink}>Hẹn hò an toàn</Text>
        <Text style={styles.footerLink}>Hỗ trợ</Text>
      </View>
      <Text style={styles.footerNotice}>Thành viên Chon.Love không mặc nhiên được coi là đã qua kiểm tra lý lịch. Các dấu xác thực chỉ phản ánh đúng loại xác thực đã hoàn tất.</Text>
      <Text style={styles.footerCopyright}>© 2026 Chon.Love. Bảo lưu mọi quyền.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    minHeight: 64,
    paddingHorizontal: 34,
    backgroundColor: luxyColors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCompact: { minHeight: 60, paddingHorizontal: 16 },
  brandButton: { minHeight: 44, justifyContent: 'center' },
  brand: { color: '#FFFFFF', fontFamily: luxyTypography.families.brand, fontSize: 28, letterSpacing: -1.1 },
  brandCompact: { fontSize: 24 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerPrompt: { color: '#DDE3E8', fontSize: 14 },
  headerPromptCompact: { display: 'none' },
  headerActionButton: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingTop: 48, backgroundColor: '#FFFFFF' },
  scrollContentCompact: { paddingTop: 28 },
  authPanel: { width: '100%', maxWidth: 456, paddingHorizontal: 8, paddingVertical: 0 },
  authPanelCompact: { paddingHorizontal: 24 },
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
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  choiceButtonSelected: { borderWidth: 2, borderColor: luxyColors.actionRed, backgroundColor: '#FFF8F7' },
  choiceButtonText: { color: luxyColors.ink, fontSize: 15, fontWeight: '500' },
  choiceButtonTextSelected: { color: luxyColors.actionRed, fontWeight: '600' },
  ageNote: { color: luxyColors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 14 },
  accountForm: { gap: 0 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginBottom: 2 },
  backText: { color: luxyColors.ink, fontSize: 13, fontWeight: '600' },
  formFields: { gap: 8 },
  fieldLabel: { color: luxyColors.ink, fontSize: 14, fontWeight: '500', marginTop: 8 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#AEB5BB',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    color: luxyColors.ink,
    fontSize: 16,
  },
  forgotButton: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center' },
  linkText: { color: luxyColors.actionRed, fontSize: 13, fontWeight: '600' },
  primaryButton: {
    minHeight: 50,
    marginTop: 8,
    backgroundColor: luxyColors.actionRed,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  divider: { flex: 1, height: 1, backgroundColor: '#D9D9D9' },
  dividerText: { color: luxyColors.muted, fontSize: 12 },
  googleButton: {
    minHeight: 50,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#AEB5BB',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleMark: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F5F6', alignItems: 'center', justifyContent: 'center' },
  googleMarkText: { color: '#4285F4', fontSize: 16, fontWeight: '800' },
  googleButtonText: { color: luxyColors.ink, fontSize: 14, fontWeight: '600' },
  termsText: { color: luxyColors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 16 },
  error: { color: luxyColors.danger, fontSize: 12, lineHeight: 18, marginBottom: 10, textAlign: 'center' },
  success: { color: '#17653A', fontSize: 12, lineHeight: 18, marginBottom: 10, textAlign: 'center' },
  footer: {
    width: '100%',
    maxWidth: 920,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 28,
    gap: 12,
  },
  footerCompact: { paddingTop: 38, paddingBottom: 24 },
  footerLanguage: { color: luxyColors.ink, fontSize: 12, fontWeight: '600' },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  footerLink: { color: luxyColors.muted, fontSize: 11 },
  footerNotice: { color: luxyColors.muted, fontSize: 9, lineHeight: 14, maxWidth: 720, textAlign: 'center', textTransform: 'uppercase' },
  footerCopyright: { color: luxyColors.muted, fontSize: 10 },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.48 },
});
