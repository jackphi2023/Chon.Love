import {
  cancelMyAccountDeletion,
  getMyAccountDeletionStatus,
  getReadableSocialError,
  requestMyAccountDeletion,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/screen';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const ACTIVE_DELETION_STATUSES = new Set(['requested', 'scheduled', 'processing', 'blocked_by_legal_hold']);

export default function AccountDeletionPage() {
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'request' | 'cancel' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryKey = ['account-deletion', auth.userId] as const;
  const statusQuery = useQuery({
    queryKey,
    enabled: Boolean(client && auth.userId),
    staleTime: 10_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyAccountDeletionStatus(client);
    },
  });

  const status = statusQuery.data;
  const activeRequest = Boolean(status && ACTIVE_DELETION_STATUSES.has(status.status));
  const canCancel = Boolean(status && ['requested', 'scheduled', 'blocked_by_legal_hold'].includes(status.status));

  async function refreshAccountState() {
    await Promise.all([
      statusQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['profile', 'me', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['discovery'] }),
    ]);
  }

  async function handleRequestDeletion() {
    if (!client || confirmation.trim().toUpperCase() !== 'XÓA') return;
    setBusy('request');
    setMessage(null);
    setErrorMessage(null);
    try {
      await requestMyAccountDeletion(client, reason, createRequestId());
      await refreshAccountState();
      setMessage('Yêu cầu xóa tài khoản đã được ghi nhận. Hồ sơ và tính năng xã hội đã được tắt.');
      setConfirmation('');
    } catch (error) {
      setErrorMessage(getReadableSocialError(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelDeletion() {
    if (!client || !status) return;
    setBusy('cancel');
    setMessage(null);
    setErrorMessage(null);
    try {
      await cancelMyAccountDeletion(client, status.id, createRequestId());
      await refreshAccountState();
      setMessage('Đã hủy yêu cầu xóa tài khoản và khôi phục trạng thái trước đó.');
    } catch (error) {
      setErrorMessage(getReadableSocialError(error));
    } finally {
      setBusy(null);
    }
  }

  if (statusQuery.isLoading || auth.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.bodyText}>Đang tải…</Text>
      </View>
    );
  }

  return (
    <Screen
      title="Xóa tài khoản"
      description="Yêu cầu này xóa dữ liệu tài khoản theo quy trình server; không chỉ đăng xuất hoặc ẩn ứng dụng."
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>‹ Quay lại</Text>
      </Pressable>

      {activeRequest && status ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Yêu cầu đang được xử lý</Text>
          <StatusLine label="Trạng thái" value={statusLabel(status.status)} />
          <StatusLine label="Ngày yêu cầu" value={formatDate(status.requested_at)} />
          <StatusLine label="Dự kiến xử lý" value={formatDate(status.scheduled_delete_at)} />
          <StatusLine label="Giữ pháp lý/tài chính" value={status.legal_hold ? 'Có' : 'Không'} />
          <Text style={styles.bodyText}>
            Trong thời gian chờ, hồ sơ không xuất hiện trong Khám phá và tài khoản không thể dùng tính năng xã hội.
          </Text>
          {status.legal_hold ? (
            <Text style={styles.warningText}>
              Tài khoản đang có nghĩa vụ hoặc giao dịch cần hoàn tất trước khi dữ liệu có thể được xử lý.
            </Text>
          ) : null}
          {canCancel ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={handleCancelDeletion}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>{busy === 'cancel' ? 'Đang xử lý…' : 'Hủy yêu cầu xóa'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Điều gì sẽ xảy ra?</Text>
            <Text style={styles.listText}>• Hồ sơ bị ẩn khỏi Khám phá ngay khi gửi yêu cầu.</Text>
            <Text style={styles.listText}>• Khám phá, tương tác, chat và quyền xem nội dung riêng tư bị tắt.</Text>
            <Text style={styles.listText}>• Dữ liệu được xử lý sau thời gian chờ theo cấu hình hệ thống.</Text>
            <Text style={styles.listText}>• Một số hồ sơ giao dịch hoặc kiểm toán có thể phải giữ theo nghĩa vụ pháp lý.</Text>
          </View>

          <Text style={styles.label}>Lý do tùy chọn</Text>
          <TextInput
            accessibilityLabel="Lý do yêu cầu xóa tài khoản"
            maxLength={500}
            multiline
            onChangeText={setReason}
            placeholder="Bạn có thể chia sẻ lý do để Luxy.Love cải thiện"
            style={styles.textArea}
            value={reason}
          />

          <Text style={styles.label}>Nhập XÓA để xác nhận</Text>
          <TextInput
            accessibilityLabel="Nhập XÓA để xác nhận"
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setConfirmation}
            placeholder="XÓA"
            style={styles.input}
            value={confirmation}
          />

          <Pressable
            accessibilityRole="button"
            disabled={busy !== null || confirmation.trim().toUpperCase() !== 'XÓA'}
            onPress={handleRequestDeletion}
            style={[
              styles.dangerButton,
              (busy !== null || confirmation.trim().toUpperCase() !== 'XÓA') && styles.disabled,
            ]}
          >
            <Text style={styles.dangerButtonText}>{busy === 'request' ? 'Đang gửi…' : 'Gửi yêu cầu xóa tài khoản'}</Text>
          </Pressable>
        </>
      )}

      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      {errorMessage || statusQuery.error ? (
        <Text accessibilityRole="alert" style={styles.error}>{errorMessage ?? 'Không thể tải trạng thái xóa tài khoản.'}</Text>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Đăng xuất</Text>
      </Pressable>
    </Screen>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusLine}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function statusLabel(status: string): string {
  if (status === 'scheduled') return 'Đã lên lịch';
  if (status === 'requested') return 'Đã yêu cầu';
  if (status === 'processing') return 'Đang xử lý';
  if (status === 'blocked_by_legal_hold') return 'Đang chờ xử lý nghĩa vụ';
  if (status === 'cancelled') return 'Đã hủy';
  if (status === 'completed') return 'Đã hoàn tất';
  return status;
}

function formatDate(value: string | null): string {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa xác định';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
  backButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginBottom: spacing.sm },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  statusCard: { borderRadius: 16, borderWidth: 1, borderColor: '#F2B51D', backgroundColor: '#FFFBEB', padding: spacing.md, gap: spacing.sm },
  statusTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  statusLine: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 3 },
  statusLabel: { color: colors.muted, fontSize: 13 },
  statusValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  warningCard: { borderRadius: 16, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', padding: spacing.md, gap: spacing.sm },
  warningTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  warningText: { color: '#92400E', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  listText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  bodyText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  label: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, fontSize: 16 },
  textArea: { minHeight: 90, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, color: colors.text, textAlignVertical: 'top' },
  primaryButton: { minHeight: 48, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primary },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  dangerButton: { minHeight: 50, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.danger },
  dangerButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  success: { color: '#166534', fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  signOutButton: { minHeight: 48, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border },
  signOutText: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
