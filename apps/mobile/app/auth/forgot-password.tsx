import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ChonAuthAlert,
  ChonAuthField,
  ChonAuthHeading,
  ChonAuthLink,
  ChonAuthNotice,
  ChonAuthPrimaryButton,
  ChonAuthShell,
  chonAuthStyles,
} from '@/components/chon-auth-shell';
import { requestPasswordReset } from '@/lib/auth';
import { getReadableAuthError } from '@/lib/auth-routing';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const normalizedEmail = email.trim();

  async function handleSubmit() {
    if (!normalizedEmail || isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setSent(true);
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
      prompt="Đã nhớ mật khẩu?"
      testID="chon-forgot-password-screen"
    >
      <View style={chonAuthStyles.form}>
        <ChonAuthHeading
          description="Nhập email tài khoản. Nếu email hợp lệ, Chon.Love sẽ gửi liên kết để bạn đặt mật khẩu mới."
          title="Khôi phục mật khẩu"
        />

        {sent ? (
          <>
            <ChonAuthNotice success title="Kiểm tra hộp thư">
              Yêu cầu đã được tiếp nhận. Vì lý do bảo mật, Chon.Love luôn hiển thị thông báo này dù email có tồn tại hay không.
            </ChonAuthNotice>
            <ChonAuthPrimaryButton label="Quay lại đăng nhập" onPress={backToLogin} testID="forgot-password-back-login" />
          </>
        ) : (
          <>
            <ChonAuthField
              accessibilityLabel="Email khôi phục mật khẩu"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              onSubmitEditing={() => void handleSubmit()}
              placeholder="email@example.com"
              returnKeyType="send"
              value={email}
            />
            <ChonAuthAlert message={errorMessage} />
            <ChonAuthPrimaryButton
              busy={isSubmitting}
              disabled={!normalizedEmail}
              label="Gửi liên kết khôi phục"
              onPress={() => void handleSubmit()}
              testID="forgot-password-submit"
            />
            <ChonAuthLink label="Quay lại đăng nhập" onPress={backToLogin} />
          </>
        )}

        <ChonAuthNotice title="Lưu ý bảo mật">
          Liên kết chỉ dùng một lần và có thời hạn. Chon.Love không cho biết email có tồn tại hay không. Sau khi đặt mật khẩu mới, các phiên đăng nhập hiện tại sẽ bị thu hồi.
        </ChonAuthNotice>
      </View>
    </ChonAuthShell>
  );
}
