import {
  formatGiftAvailabilityDate,
  formatGiftLogTimestamp,
  formatHeartUnitBalance,
  getMyLuxyGiftWallet,
  giftCatalogQueryKeys,
  listMyLuxyGifts,
  type LuxyGiftHistoryDirection,
} from '@myfan/supabase';
import { luxyColors, luxyRadii, luxySpacing } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function LuxyGiftsAndIncomePage() {
  const client = getMobileSupabaseClient();
  const auth = useAuth();
  const [direction, setDirection] = useState<LuxyGiftHistoryDirection>('received');

  const walletQuery = useQuery({
    queryKey: giftCatalogQueryKeys.wallet(auth.userId),
    enabled: Boolean(client && auth.userId),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error('supabase_unavailable');
      return getMyLuxyGiftWallet(client);
    },
  });

  const historyQuery = useQuery({
    queryKey: giftCatalogQueryKeys.history(auth.userId, direction),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_unavailable');
      return listMyLuxyGifts(client, direction, { limit: 30, offset: 0 });
    },
  });

  const wallet = walletQuery.data;
  return (
    <ScrollView contentContainerStyle={styles.pageContent} style={styles.page} testID="luxy-gifts-income-page">
      <View style={styles.frame}>
        <Text accessibilityRole="header" style={styles.title}>Quà & Thu nhập</Text>
        <Text style={styles.lead}>
          Quà là lời cảm ơn tự nguyện giữa các thành viên. Quà không mở ảnh riêng tư, không tạo quan hệ và không bắt buộc phản hồi.
        </Text>

        {walletQuery.isLoading ? (
          <View style={styles.loading}><ActivityIndicator /><Text style={styles.muted}>Đang tải số dư…</Text></View>
        ) : walletQuery.isError || !wallet ? (
          <View style={styles.notice}>
            <Text style={styles.error}>Không tải được thông tin quà và thu nhập.</Text>
            <Pressable onPress={() => void walletQuery.refetch()}><Text style={styles.retry}>Thử lại</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <Summary label="Số dư để tặng" value={formatHeartUnitBalance(wallet.heart_available_units)} />
              <Summary label={`Thu nhập chờ ${wallet.reward_hold_days} ngày`} value={formatHeartUnitBalance(wallet.reward_pending_units)} />
              <Summary label="Có thể rút" value={formatHeartUnitBalance(wallet.reward_available_units)} />
              <Summary label="Đang giữ cho lệnh rút" value={formatHeartUnitBalance(wallet.reward_held_units)} />
            </View>

            <View style={styles.policyBlock}>
              <Text style={styles.policyTitle}>Cơ chế thu nhập</Text>
              <Text style={styles.policyText}>
                Người nhận được {(wallet.recipient_share_bps / 100).toLocaleString('vi-VN')}% giá trị quà. Khoản này ở trạng thái chờ đúng {wallet.reward_hold_days} ngày trước khi chuyển sang số dư có thể rút.
              </Text>
              <Text style={styles.policyText}>
                Rút tiền chỉ khả dụng khi KYC đã duyệt, tài khoản ngân hàng đã xác minh, không có hold tài chính và đạt mức tối thiểu {formatHeartUnitBalance(wallet.minimum_withdrawal_units)}. Payout Beta vẫn cần quy trình Admin; không tự động chuyển tiền.
              </Text>
              <View style={styles.statusRow}>
                <Status label="KYC" ok={wallet.kyc_approved} />
                <Status label="Ngân hàng" ok={wallet.verified_bank_available} />
                <Status label="Đủ điều kiện rút" ok={wallet.withdrawal_ready} />
              </View>
              {!wallet.kyc_approved || !wallet.verified_bank_available ? (
                <Text style={styles.note}>Luồng xác thực người dùng sẽ tiếp tục được hoàn thiện trong LX-20. LX-19 không tạo đường tắt KYC/ngân hàng.</Text>
              ) : null}
            </View>
          </>
        )}

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Lịch sử quà</Text>
          <View style={styles.tabs}>
            <HistoryTab active={direction === 'received'} label="Đã nhận" onPress={() => setDirection('received')} />
            <HistoryTab active={direction === 'sent'} label="Đã gửi" onPress={() => setDirection('sent')} />
          </View>
        </View>

        {historyQuery.isLoading ? (
          <View style={styles.loading}><ActivityIndicator /><Text style={styles.muted}>Đang tải lịch sử…</Text></View>
        ) : historyQuery.isError ? (
          <View style={styles.notice}><Text style={styles.error}>Không tải được lịch sử quà.</Text><Pressable onPress={() => void historyQuery.refetch()}><Text style={styles.retry}>Thử lại</Text></Pressable></View>
        ) : !(historyQuery.data?.length) ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>{direction === 'received' ? 'Chưa nhận quà' : 'Chưa gửi quà'}</Text><Text style={styles.muted}>Các giao dịch quà được server xác nhận sẽ xuất hiện tại đây.</Text></View>
        ) : (
          <View style={styles.historyList}>
            {historyQuery.data.map((item) => (
              <View key={item.gift_transaction_id} style={styles.historyRow}>
                <View style={styles.giftIconBox}><Text style={styles.giftIcon}>{item.gift_icon_emoji ?? '🎁'}</Text></View>
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>{item.gift_name_vi}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</Text>
                  <Text numberOfLines={1} style={styles.historyMeta}>
                    {direction === 'received' ? 'Từ' : 'Đến'} {item.other_display_name || item.other_username || 'Thành viên Luxy'} · {formatGiftLogTimestamp(item.created_at)}
                  </Text>
                  {direction === 'received' && item.status !== 'reversed' && item.reward_available_at ? (
                    <Text style={styles.availability}>Thu nhập {formatHeartUnitBalance(item.recipient_reward_units)} · khả dụng từ {formatGiftAvailabilityDate(item.reward_available_at)}</Text>
                  ) : null}
                </View>
                <View style={styles.historyAmount}>
                  <Text style={styles.amountText}>{formatHeartUnitBalance(item.gross_heart_units)}</Text>
                  <Text style={[styles.statusText, item.status === 'reversed' && styles.statusReversed]}>{giftStatusLabel(item.status)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <View style={styles.summary}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return <View style={[styles.statusChip, ok && styles.statusChipOk]}><Text style={[styles.statusChipText, ok && styles.statusChipTextOk]}>{ok ? '✓ ' : ''}{label}</Text></View>;
}

function HistoryTab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>;
}

function giftStatusLabel(status: 'completed' | 'partially_reversed' | 'reversed'): string {
  if (status === 'reversed') return 'Đã hoàn/thu hồi';
  if (status === 'partially_reversed') return 'Đã điều chỉnh';
  return 'Hoàn tất';
}

const styles = StyleSheet.create({
  page: { backgroundColor: luxyColors.surface, flex: 1 },
  pageContent: { paddingBottom: 80 },
  frame: { alignSelf: 'center', maxWidth: 980, paddingHorizontal: luxySpacing.lg, paddingTop: 32, width: '100%' },
  title: { color: luxyColors.ink, fontSize: 30, fontWeight: '500', lineHeight: 38 },
  lead: { color: luxyColors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 720 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28 },
  summary: { borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, flexBasis: 210, flexGrow: 1, minWidth: 190, padding: luxySpacing.lg },
  summaryLabel: { color: luxyColors.muted, fontSize: 12, lineHeight: 17 },
  summaryValue: { color: luxyColors.ink, fontSize: 21, fontWeight: '700', marginTop: 5 },
  policyBlock: { backgroundColor: luxyColors.subtleSurface, borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, marginTop: 14, padding: luxySpacing.lg },
  policyTitle: { color: luxyColors.ink, fontSize: 16, fontWeight: '700' },
  policyText: { color: luxyColors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  statusChip: { borderColor: luxyColors.borderStrong, borderRadius: luxyRadii.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  statusChipOk: { borderColor: luxyColors.online },
  statusChipText: { color: luxyColors.muted, fontSize: 12 },
  statusChipTextOk: { color: luxyColors.ink, fontWeight: '600' },
  note: { color: luxyColors.softMuted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  historyHeader: { alignItems: 'flex-end', borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 36 },
  sectionTitle: { color: luxyColors.ink, fontSize: 20, fontWeight: '600', paddingBottom: 12 },
  tabs: { flexDirection: 'row' },
  tab: { borderBottomColor: 'transparent', borderBottomWidth: 2, paddingHorizontal: 14, paddingVertical: 12 },
  tabActive: { borderBottomColor: luxyColors.actionRed },
  tabText: { color: luxyColors.muted, fontSize: 14 },
  tabTextActive: { color: luxyColors.ink, fontWeight: '700' },
  historyList: { borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  historyRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 84, paddingVertical: 12 },
  giftIconBox: { alignItems: 'center', backgroundColor: luxyColors.subtleSurface, borderRadius: luxyRadii.sm, height: 54, justifyContent: 'center', width: 54 },
  giftIcon: { fontSize: 28 },
  historyCopy: { flex: 1, minWidth: 0 },
  historyTitle: { color: luxyColors.ink, fontSize: 15, fontWeight: '600' },
  historyMeta: { color: luxyColors.muted, fontSize: 12, marginTop: 3 },
  availability: { color: luxyColors.softMuted, fontSize: 11, marginTop: 5 },
  historyAmount: { alignItems: 'flex-end', marginLeft: 8 },
  amountText: { color: luxyColors.ink, fontSize: 14, fontWeight: '700' },
  statusText: { color: luxyColors.online, fontSize: 11, marginTop: 4 },
  statusReversed: { color: luxyColors.danger },
  loading: { alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 140 },
  muted: { color: luxyColors.muted, fontSize: 13, lineHeight: 19 },
  notice: { borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, marginTop: 20, padding: luxySpacing.lg },
  error: { color: luxyColors.danger, fontSize: 13 },
  retry: { color: luxyColors.actionRed, fontSize: 13, fontWeight: '700', marginTop: 8 },
  empty: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 170, padding: 32 },
  emptyTitle: { color: luxyColors.ink, fontSize: 16, fontWeight: '600', marginBottom: 5 },
});
