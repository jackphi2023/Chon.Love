import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { luxyColors, luxyRadii, luxySpacing } from '@myfan/ui';
import {
  LuxySettingsPage,
  SettingsAction,
  SettingsNotice,
  SettingsSection,
} from '@/components/luxy-settings-layout';
import {
  getReadableProfileMediaError,
  pickAndPrepareProfileImage,
  type PreparedLocalProfileImage,
} from '@/lib/profile-media';
import { useAuth } from '@/providers/auth-provider';

type CaptureKey = 'selfie' | 'front' | 'back';

export default function VerificationSettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  const [captures, setCaptures] = useState<Partial<Record<CaptureKey, PreparedLocalProfileImage>>>({});
  const [busy, setBusy] = useState<CaptureKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  async function capture(key: CaptureKey, source: 'camera' | 'library') {
    setBusy(key);
    setErrorMessage(null);
    try {
      const prepared = await pickAndPrepareProfileImage(source, 'private');
      if (!prepared) return;
      setCaptures((current) => ({ ...current, [key]: prepared }));
    } catch (error) {
      setErrorMessage(getReadableProfileMediaError(error));
    } finally {
      setBusy(null);
    }
  }

  const readyCount = ['selfie', 'front', 'back'].filter((key) => captures[key as CaptureKey]).length;

  return (
    <LuxySettingsPage
      description="Chuẩn bị selfie và giấy tờ danh tính trong một luồng riêng tư. Ảnh xác thực không được dùng làm ảnh hồ sơ công khai."
      testID="luxy-verification-settings"
      title="Xác thực danh tính"
    >
      <SettingsNotice title="Không gửi PII vào sai backend" tone="warning">
        Backend KYC hiện hữu của hệ thống phục vụ payout creator, không phải xác thực hồ sơ cho mọi thành viên. Vì vậy LX-08 cho phép camera/chọn ảnh và kiểm tra ảnh cục bộ, nhưng chưa tải CCCD/selfie lên server cho đến khi contract xác thực profile LX-20 được mở.
      </SettingsNotice>

      <SettingsSection
        description="Dùng camera của thiết bị. Trên desktop trình duyệt sẽ yêu cầu quyền camera; trên mobile dùng camera hệ thống."
        testID="verification-selfie-section"
        title="1. Selfie trực tiếp"
      >
        <CaptureCard
          actionLabel={busy === 'selfie' ? 'Đang mở camera…' : captures.selfie ? 'Chụp lại selfie' : 'Bật camera & chụp selfie'}
          image={captures.selfie}
          onAction={() => capture('selfie', 'camera')}
          status={captures.selfie ? 'Đã sẵn sàng cục bộ' : 'Chưa chụp'}
        />
      </SettingsSection>

      <SettingsSection
        description="Chọn ảnh rõ nét, đủ bốn góc. Không dùng ảnh CCCD làm avatar hoặc ảnh bảo mật."
        testID="verification-id-section"
        title="2. Căn cước công dân"
      >
        <View style={styles.documentGrid}>
          <CaptureCard
            actionLabel={busy === 'front' ? 'Đang chọn…' : captures.front ? 'Chọn lại mặt trước' : 'Upload mặt trước CCCD'}
            image={captures.front}
            onAction={() => capture('front', 'library')}
            status={captures.front ? 'Đã sẵn sàng cục bộ' : 'Chưa có'}
            title="Mặt trước"
          />
          <CaptureCard
            actionLabel={busy === 'back' ? 'Đang chọn…' : captures.back ? 'Chọn lại mặt sau' : 'Upload mặt sau CCCD'}
            image={captures.back}
            onAction={() => capture('back', 'library')}
            status={captures.back ? 'Đã sẵn sàng cục bộ' : 'Chưa có'}
            title="Mặt sau"
          />
        </View>
      </SettingsSection>

      <SettingsSection
        description="Kênh bổ sung để củng cố độ tin cậy nghề nghiệp mà không thay thế xác thực danh tính."
        title="3. LinkedIn"
      >
        <View style={styles.linkedInRow}>
          <View style={styles.linkedInIcon}><Text style={styles.linkedInIconText}>in</Text></View>
          <View style={styles.linkedInText}>
            <Text style={styles.cardTitle}>Xác minh LinkedIn</Text>
            <Text style={styles.cardDescription}>Kết nối OAuth sẽ được triển khai trong phiên xác minh; không yêu cầu mật khẩu LinkedIn trong Luxy.Love.</Text>
          </View>
          <Text style={styles.pendingText}>LX-20</Text>
        </View>
      </SettingsSection>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Tiến độ chuẩn bị: {readyCount}/3 ảnh</Text>
        <Text style={styles.summaryText}>Bạn có thể kiểm tra/chụp lại trước khi gửi. Dữ liệu cục bộ sẽ mất khi rời hoặc tải lại trang.</Text>
        <SettingsAction disabled label="Gửi xác minh — mở ở LX-20" onPress={() => undefined} testID="verification-submit" />
      </View>

      {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.backRow}>
        <SettingsAction label="Quay lại Cài đặt" onPress={() => router.push('/settings')} secondary />
      </View>
    </LuxySettingsPage>
  );
}

function CaptureCard({
  title,
  status,
  image,
  actionLabel,
  onAction,
}: {
  title?: string;
  status: string;
  image?: PreparedLocalProfileImage;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.captureCard}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      <View style={styles.preview}>
        {image ? (
          <Image accessibilityLabel={title ? `Ảnh ${title}` : 'Ảnh selfie xác thực'} source={{ uri: image.previewUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.previewEmpty}>
            <Text style={styles.previewSymbol}>{title ? '▣' : '◎'}</Text>
            <Text style={styles.previewEmptyText}>Chưa có ảnh</Text>
          </View>
        )}
      </View>
      <Text style={styles.captureStatus}>{status}</Text>
      <SettingsAction label={actionLabel} onPress={onAction} secondary />
    </View>
  );
}

const styles = StyleSheet.create({
  documentGrid: { gap: luxySpacing.md, padding: luxySpacing.lg },
  captureCard: { gap: luxySpacing.sm, padding: luxySpacing.lg },
  cardTitle: { color: luxyColors.text, fontSize: 15.5, fontWeight: '700' },
  cardDescription: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  preview: { aspectRatio: 1.6, backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.sm, overflow: 'hidden', width: '100%' },
  previewImage: { height: '100%', resizeMode: 'cover', width: '100%' },
  previewEmpty: { alignItems: 'center', flex: 1, gap: luxySpacing.xs, justifyContent: 'center' },
  previewSymbol: { color: luxyColors.softMuted, fontSize: 30 },
  previewEmptyText: { color: luxyColors.muted, fontSize: 12.5 },
  captureStatus: { color: luxyColors.muted, fontSize: 12.5 },
  linkedInRow: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.md, minHeight: 88, padding: luxySpacing.lg },
  linkedInIcon: { alignItems: 'center', backgroundColor: '#E8EDF2', borderRadius: luxyRadii.pill, height: 42, justifyContent: 'center', width: 42 },
  linkedInIconText: { color: '#5B6670', fontSize: 14, fontWeight: '800' },
  linkedInText: { flex: 1 },
  pendingText: { color: luxyColors.muted, fontSize: 12 },
  summary: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.md, borderWidth: 1, gap: luxySpacing.md, marginBottom: luxySpacing.xl, padding: luxySpacing.xl },
  summaryTitle: { color: luxyColors.text, fontSize: 16, fontWeight: '700' },
  summaryText: { color: luxyColors.muted, fontSize: 13, lineHeight: 20 },
  error: { color: luxyColors.danger, fontSize: 13.5, marginBottom: luxySpacing.lg },
  backRow: { alignItems: 'flex-start', marginBottom: luxySpacing.xl },
});
