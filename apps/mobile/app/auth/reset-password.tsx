import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  ChonAuthAlert,
  ChonAuthField,
  ChonAuthHeading,
  ChonAuthLoading,
  ChonAuthNotice,
  ChonAuthPrimaryButton,
  ChonAuthShell,
  chonAuthStyles,
} from '@/components/chon-auth-shell';
import { MIN_PASSWORD_LENGTH, updateCurrentPassword } from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';
import { useAuth } from '@/providers/auth-provider';

export default function ResetPasswordPage() {
  const router = useRouter();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.isRestoring && !auth.userId) router.replace('/(auth)?mode=login');
  }, [auth.isRestoring, auth.userId, router]);

  const confirmationError = useMemo(() => {
    if (!confirmation || !password || confirmation === password) return undefined;
    return 'Hai lần nhập mật khẩu chưa khớp.';
  }, [confirmation, password]);
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit = Boolean(
    auth.userId
    && password.length >= MIN_PASSWORD_LENGTH
    && confirmation.length >= MIN_PASSWORD_LENGTH
    && password === confirmation
    && !isSubmitting,
  );

  async function handleSubmit() {
    setErrorMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (password !== confirmation) {
      setErrorMessage('Hai lần nhập mật khẩu chưa khớp.');
      return;
    }
    if (!auth.userId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updateCurrentPassword(password);
      router.replace('/(auth)?mode=login');
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function backToLogin() {
    router.replace('/(auth)?mode=login');
  }

  return (
    <ChonAuthShell
      actionLabel="Đăng nhập"
      onAction={backToLogin}
      prompt="Quay lại tài khoản?"
      testID="chon-reset-password-screen"
    >
      {auth.isRestoring ? (
        <ChonAuthLoading text="Đang xác minh liên kết khôi phục…" />
      ) : (
        <View style={chonAuthStyles.form}>
          <ChonAuthHeading
            description="Chọn mật khẩu mới cho tài khoản. Sau khi hoàn tất, Chon.Love sẽ thu hồi các phiên đăng nhập hiện tại."
            title="Đặt mật khẩu mới"
          />

          <View style={chonAuthStyles.fieldStack}>
            <ChonAuthField
              accessibilityLabel="Mật khẩu mới"
              autoCapitalize="none"
              autoComplete="new-password"
              error={passwordTooShort ? `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` : undefined}
              help={`Dùng ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`}
              label="Mật khẩu mới"
              onChangeText={setPassword}
              placeholder={`Ít nhất ${MIN_PASSWORD_LENGTH} ký tự`}
              secureTextEntry
              value={password}
            />
            <ChonAuthField
              accessibilityLabel="Nhập lại mật khẩu mới"
              autoCapitalize="none"
              autoComplete="new-password"
              error={confirmationError}
              label="Nhập lại mật khẩu"
              onChangeText={setConfirmation}
              onSubmitEditing={() => void handleSubmit()}
              placeholder="Nhập lại mật khẩu mới"
              secureTextEntry
              value={confirmation}
            />
          </View>

          <ChonAuthAlert message={errorMessage} />
          <ChonAuthPrimaryButton
            busy={isSubmitting}
            disabled={!canSubmit}
            label="Cập nhật mật khẩu"
            onPress={() => void handleSubmit()}
            testID="reset-password-submit"
          />

          <ChonAuthNotice title="Bảo vệ tài khoản">
            Không tái sử dụng mật khẩu ở dịch vụ khác. Sau khi cập nhật thành công, bạn sẽ được đưa về màn đăng nhập và cần đăng nhập lại bằng mật khẩu mới.
          </ChonAuthNotice>
        </View>
      )}
    </ChonAuthShell>
  );
}
