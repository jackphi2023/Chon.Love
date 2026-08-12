import {
  formatLuxyHeartBalance,
  getLuxyMembershipPlanOptions,
  getMyLuxyMembershipPrivacy,
  getMyLuxyMembershipSnapshot,
  updateMyLuxyMembershipPrivacy,
  type LuxyMembershipTier,
} from '@myfan/supabase';
import { luxyColors, luxyRadii, luxySpacing } from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';
import {
  LuxySettingsPage,
  SettingsAction,
  SettingsNotice,
} from '@/components/luxy-settings-layout';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const PLAN_COPY: Record<Exclude<LuxyMembershipTier, 'free'>, { name: string; summary: string }> = {
  premium: {
    name: 'Cao cấp / Premium',
    summary: 'Nhắn tin, yêu thích và tìm kiếm đầy đủ; ưu tiên hiển thị cao hơn Free; có thể ẩn trạng thái online.',
  },
  diamond: {
    name: 'Kim cương / Diamond',
    summary: 'Ưu tiên đầu danh sách, toàn bộ quyền Premium, có số dư ❤️ từ 80% tiền gói và có thể ẩn khỏi danh sách thành viên.',
  },
};

function money(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

function expiryLabel(value: string | null): string {
  if (!value) return 'Không có ngày hết hạn';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không xác định' : date.toLocaleString('vi-VN');
}

export default function MembershipSettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();

  const membershipQuery = useQuery({
    queryKey: ['luxy-membership', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyLuxyMembershipSnapshot(client);
    },
  });

  const plansQuery = useQuery({
    queryKey: ['luxy-membership-plan-options'],
    enabled: Boolean(client && auth.userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getLuxyMembershipPlanOptions(client);
    },
  });

  const privacyQuery = useQuery({
    queryKey: ['luxy-membership-privacy', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyLuxyMembershipPrivacy(client);
    },
  });

  const privacyMutation = useMutation({
    mutationFn: async (next: { hideOnline: boolean; hideFromListing: boolean }) => {
      if (!client) throw new Error('supabase_not_configured');
      return updateMyLuxyMembershipPrivacy(client, next);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['luxy-membership-privacy', auth.userId] }),
        queryClient.invalidateQueries({ queryKey: ['luxy-member-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['luxy-interests'] }),
        queryClient.invalidateQueries({ queryKey: ['luxy-mailbox'] }),
      ]);
    },
  });

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  const membership = membershipQuery.data;
  const privacy = privacyQuery.data;
  const currentTier = membership?.tier ?? 'free';
  const currentName = currentTier === 'free' ? 'Free' : PLAN_COPY[currentTier].name;
  const currentHideOnline = privacy?.hide_online ?? false;
  const currentHideListing = privacy?.hide_from_listing ?? false;

  function setPrivacy(next: { hideOnline?: boolean; hideFromListing?: boolean }) {
    privacyMutation.mutate({
      hideOnline: next.hideOnline ?? currentHideOnline,
      hideFromListing: next.hideFromListing ?? currentHideListing,
    });
  }

  return (
    <LuxySettingsPage
      description="LX-17 khóa engine Free / Premium / Diamond, quyền theo thời hạn và quyền riêng tư. Checkout VietQR/Upgrade UI đầy đủ được hoàn thiện ở LX-18."
      testID="luxy-membership-settings"
      title="Gói dịch vụ"
    >
      <SettingsNotice title="Gói đang có hiệu lực" tone={currentTier === 'free' ? 'neutral' : 'success'}>
        {currentName}. {currentTier === 'free'
          ? 'Bạn chưa có gói trả phí đang hiệu lực.'
          : `Hết hạn: ${expiryLabel(membership?.expires_at ?? null)}. Khi hết hạn, hệ thống tự đánh giá lại thành Free và đóng các quyền của gói.`}
      </SettingsNotice>

      {currentTier === 'diamond' ? (
        <SettingsNotice title="Số dư ❤️ Diamond" tone="neutral">
          {formatLuxyHeartBalance(membership?.heart_balance_units ?? 0)}. Số ❤️ phát sinh từ gói dùng để tặng quà trong Luxy.Love và không phải số dư tiền mặt.
        </SettingsNotice>
      ) : null}

      <View style={styles.planGrid}>
        {(['premium', 'diamond'] as const).map((tier) => {
          const one = plansQuery.data?.find((option) => option.tier === tier && option.period_count === 1);
          const three = plansQuery.data?.find((option) => option.tier === tier && option.period_count === 3);
          const current = currentTier === tier;
          return (
            <View key={tier} style={[styles.planCard, current && styles.planCardCurrent]}>
              <View style={styles.planTop}>
                <Text style={styles.planName}>{PLAN_COPY[tier].name}</Text>
                {current ? <Text style={styles.currentBadge}>Đang hiệu lực</Text> : null}
              </View>
              <Text style={styles.planPrice}>{one ? `${money(one.monthly_price_vnd)} / tháng` : tier === 'premium' ? '1.000.000 đ / tháng' : '5.000.000 đ / tháng'}</Text>
              <Text style={styles.planNote}>{PLAN_COPY[tier].summary}</Text>
              <View style={styles.termRows}>
                <Text style={styles.termText}>1 kỳ: {one ? money(one.amount_due_vnd) : '—'}</Text>
                <Text style={styles.termText}>3 kỳ: {three ? `${money(three.amount_due_vnd)} · giảm 20%` : '—'}</Text>
                {tier === 'diamond' ? (
                  <Text style={styles.heartText}>❤️ quy đổi: {one?.heart_credit_display ?? 80} ❤️ / 1 kỳ · {three?.heart_credit_display ?? 192} ❤️ / 3 kỳ</Text>
                ) : null}
              </View>
              <Text style={styles.adminNote}>Thanh toán chỉ tạo yêu cầu. Quyền thành viên chỉ được kích hoạt sau khi Admin đối soát và xác nhận đúng số tiền.</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.privacyCard} testID="luxy-membership-privacy">
        <Text style={styles.sectionTitle}>Quyền riêng tư theo gói</Text>
        <PrivacyRow
          disabled={!privacy?.can_hide_online || privacyMutation.isPending}
          label="Ẩn trạng thái online"
          note="Premium và Diamond có thể tắt hiển thị online trên hồ sơ, Yêu thích và Tin nhắn."
          onValueChange={(value) => setPrivacy({ hideOnline: value })}
          value={currentHideOnline}
        />
        <PrivacyRow
          disabled={!privacy?.can_hide_from_listing || privacyMutation.isPending}
          label="Ẩn khỏi danh sách thành viên"
          note="Chỉ Diamond. Hồ sơ vẫn có thể được mở trực tiếp theo quyền hiện có nhưng không xuất hiện trong Search/danh sách."
          onValueChange={(value) => setPrivacy({ hideFromListing: value })}
          value={currentHideListing}
        />
        {privacyMutation.isError ? <Text accessibilityRole="alert" style={styles.error}>Không thể cập nhật quyền riêng tư. Vui lòng thử lại.</Text> : null}
      </View>

      <View style={styles.backRow}>
        <SettingsAction label="Quay lại Cài đặt" onPress={() => router.push('/settings')} secondary />
      </View>
    </LuxySettingsPage>
  );
}

function PrivacyRow({
  label,
  note,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  note: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.privacyRow}>
      <View style={styles.privacyCopy}>
        <Text style={[styles.privacyLabel, disabled && styles.disabledText]}>{label}</Text>
        <Text style={styles.privacyNote}>{note}</Text>
      </View>
      <Switch accessibilityLabel={label} disabled={disabled} onValueChange={onValueChange} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  planGrid: { gap: luxySpacing.md, marginBottom: luxySpacing.xl },
  planCard: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.md, borderWidth: 1, gap: luxySpacing.md, padding: luxySpacing.xl },
  planCardCurrent: { borderColor: luxyColors.ink, borderWidth: 1.5 },
  planTop: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.md, justifyContent: 'space-between' },
  planName: { color: luxyColors.text, fontSize: 20, fontWeight: '700' },
  currentBadge: { backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.pill, color: luxyColors.ink, fontSize: 11.5, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  planPrice: { color: luxyColors.text, fontSize: 17, fontWeight: '600' },
  planNote: { color: luxyColors.muted, fontSize: 13.5, lineHeight: 20 },
  termRows: { gap: 5 },
  termText: { color: luxyColors.text, fontSize: 13, fontWeight: '600' },
  heartText: { color: luxyColors.text, fontSize: 12.5, lineHeight: 19 },
  adminNote: { color: luxyColors.muted, fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  privacyCard: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.md, borderWidth: 1, gap: 4, marginBottom: luxySpacing.xl, padding: luxySpacing.xl },
  sectionTitle: { color: luxyColors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  privacyRow: { alignItems: 'center', borderTopColor: luxyColors.border, borderTopWidth: 1, flexDirection: 'row', gap: 16, justifyContent: 'space-between', minHeight: 76, paddingVertical: 10 },
  privacyCopy: { flex: 1 },
  privacyLabel: { color: luxyColors.text, fontSize: 14, fontWeight: '600' },
  privacyNote: { color: luxyColors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  disabledText: { color: luxyColors.softMuted },
  error: { color: luxyColors.danger, fontSize: 12, marginTop: 8 },
  backRow: { alignItems: 'flex-start', marginBottom: luxySpacing.xl },
});