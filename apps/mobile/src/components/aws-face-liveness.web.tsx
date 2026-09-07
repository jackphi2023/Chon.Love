import { FaceLivenessDetectorCore } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react/styles.css';
import { useCallback, useEffect, useState } from 'react';
import {
  completeMemberFaceLivenessSession,
  createMemberFaceLivenessSession,
  type MemberFaceLivenessSession,
} from '@/lib/member-face-liveness';
import type { MemberPhotoVerificationResult } from '@/lib/member-photo-verification';

type AwsFaceLivenessProps = {
  disabled?: boolean;
  onResult: (result: MemberPhotoVerificationResult) => void;
  onError: (message: string) => void;
};

function readableLivenessFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('face_liveness_provider_not_configured')) {
    return 'Dịch vụ xác minh người thật chưa được cấu hình đầy đủ. Hồ sơ sẽ không được tự động kích hoạt cho đến khi dịch vụ hoạt động.';
  }
  if (message.includes('liveness_rate_limited')) {
    return 'Bạn đã thử xác minh nhiều lần liên tiếp. Vui lòng quay lại sau để bảo vệ tài khoản và hạn chế thao tác bất thường.';
  }
  if (message.includes('signup_profile_details_required')) {
    return 'Vui lòng hoàn thành phần Giới thiệu về bạn trước khi xác minh người thật.';
  }
  if (message.includes('401') || message.includes('invalid_access_token')) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi xác minh.';
  }
  return 'Xác minh người thật tạm thời chưa hoàn tất. Vui lòng thử lại với khuôn mặt rõ, đủ sáng và làm theo hướng dẫn trên màn hình.';
}

export function AwsFaceLiveness({ disabled = false, onResult, onError }: AwsFaceLivenessProps) {
  const [session, setSession] = useState<MemberFaceLivenessSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const createSession = useCallback(async () => {
    setLoading(true);
    setSession(null);
    try {
      const next = await createMemberFaceLivenessSession();
      setSession(next);
    } catch (error) {
      onError(readableLivenessFailure(error));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (!disabled) void createSession();
  }, [createSession, disabled]);

  const credentialProvider = useCallback(async () => {
    if (!session) throw new Error('liveness_session_missing');
    return {
      accessKeyId: session.credentials.accessKeyId,
      secretAccessKey: session.credentials.secretAccessKey,
      sessionToken: session.credentials.sessionToken,
      expiration: new Date(session.credentials.expiration),
    };
  }, [session]);

  const handleAnalysisComplete = useCallback(async () => {
    if (!session || completing) return;
    setCompleting(true);
    try {
      const verification = await completeMemberFaceLivenessSession(session.sessionId);
      onResult(verification);
    } catch (error) {
      onError(readableLivenessFailure(error));
      setSession(null);
    } finally {
      setCompleting(false);
    }
  }, [completing, onError, onResult, session]);

  if (disabled || loading) {
    return <div aria-live="polite" style={{ padding: 24, textAlign: 'center' }}>Đang chuẩn bị camera xác minh người thật…</div>;
  }

  if (!session) {
    return (
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center', padding: 20 }}>
        <p style={{ margin: 0, textAlign: 'center' }}>Camera xác minh chưa sẵn sàng.</p>
        <button onClick={() => void createSession()} type="button">Thử lại xác minh</button>
      </div>
    );
  }

  return (
    <div data-testid="aws-face-liveness" style={{ margin: '0 auto', maxWidth: 560, width: '100%' }}>
      <FaceLivenessDetectorCore
        config={{ credentialProvider }}
        onAnalysisComplete={() => void handleAnalysisComplete()}
        onError={(error) => {
          console.error('face_liveness_capture_error', error);
          onError('Camera xác minh chưa hoàn tất. Vui lòng thử lại và làm theo hướng dẫn trên màn hình.');
        }}
        region={session.region}
        sessionId={session.sessionId}
      />
      {completing ? <p aria-live="polite" style={{ textAlign: 'center' }}>Đang kiểm tra kết quả xác minh…</p> : null}
    </div>
  );
}
