import {
  createChatClientMessageId,
  createGiftIdempotencyKey,
  formatGiftHeartPrice,
  formatHeartUnitBalance,
  getMyLuxyGiftWallet,
  getMyLuxyMembershipSnapshot,
  getReadableGiftError,
  giftCatalogQueryKeys,
  listActiveGiftCatalog,
  sendGiftToMember,
  type GiftCatalogItem,
} from '@myfan/supabase';
import {
  luxyColors,
  luxyRadii,
  luxyShadows,
  luxySpacing,
  luxyTypography,
} from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export function LuxyGiftModal({
  visible,
  recipientId,
  recipientName,
  conversationId = null,
  onClose,
  onSent,
}: {
  visible: boolean;
  recipientId: string;
  recipientName: string;
  conversationId?: string | null;
  onClose: () => void;
  onSent?: () => void;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: giftCatalogQueryKeys.active,
    enabled: visible && Boolean(client),
    queryFn: async () => {
      if (!client) throw new Error('supabase_unavailable');
      return listActiveGiftCatalog(client);
    },
    staleTime: 5 * 60_000,
  });

  const walletQuery = useQuery({
    queryKey: giftCatalogQueryKeys.wallet(auth.userId),
    enabled: visible && Boolean(client && auth.userId),
    queryFn: async () => {
      if (!client) throw new Error('supabase_unavailable');
      return getMyLuxyGiftWallet(client);
    },
    staleTime: 10_000,
  });

  const membershipQuery = useQuery({
    queryKey: ['luxy-membership', auth.userId],
    enabled: visible && Boolean(client && auth.userId),
    queryFn: async () => {
      if (!client) throw new Error('supabase_unavailable');
      return getMyLuxyMembershipSnapshot(client);
    },
    staleTime: 15_000,
  });

  const selectedGift = useMemo(
    () => catalogQuery.data?.find((gift) => gift.id === selectedGiftId) ?? null,
    [catalogQuery.data, selectedGiftId],
  );
  const canGift = Boolean(walletQuery.data?.can_gift && membershipQuery.data?.can_use_hearts);
  const balanceUnits = walletQuery.data?.heart_available_units ?? membershipQuery.data?.heart_balance_units ?? 0;
  const hasEnough = selectedGift ? balanceUnits >= selectedGift.heart_price_units : false;
  const columns = width < 430 ? 4 : width < 720 ? 5 : 6;
  const tileWidth = `${100 / columns}%` as const;

  const sendMutation = useMutation({
    mutationFn: async (gift: GiftCatalogItem) => {
      if (!client) throw new Error('supabase_unavailable');
      return sendGiftToMember(client, {
        recipientId,
        giftId: gift.id,
        quantity: 1,
        idempotencyKey: createGiftIdempotencyKey(),
        ...(conversationId
          ? { conversationId, clientMessageId: createChatClientMessageId() }
          : {}),
      });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      setSelectedGiftId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: giftCatalogQueryKeys.wallet(auth.userId) }),
        queryClient.invalidateQueries({ queryKey: giftCatalogQueryKeys.history(auth.userId, 'sent') }),
        queryClient.invalidateQueries({ queryKey: ['luxy-membership', auth.userId] }),
        ...(conversationId
          ? [queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] })]
          : []),
      ]);
      onSent?.();
      onClose();
    },
    onError: (error) => setErrorMessage(getReadableGiftError(error)),
  });

  const close = () => {
    if (sendMutation.isPending) return;
    setErrorMessage(null);
    setSelectedGiftId(null);
    onClose();
  };

  return (
    <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Đóng danh sách quà" onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.dialog, width < 560 && styles.dialogCompact]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Tặng quà</Text>
              <Text numberOfLines={1} style={styles.subtitle}>Gửi một món quà tự nguyện đến {recipientName}</Text>
            </View>
            <Pressable accessibilityLabel="Đóng" disabled={sendMutation.isPending} onPress={close} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Số dư của bạn</Text>
            <Text style={styles.balanceValue}>{formatHeartUnitBalance(balanceUnits)}</Text>
          </View>

          {!membershipQuery.isLoading && !canGift ? (
            <View style={styles.lockedBox}>
              <Text style={styles.lockedTitle}>Quà dành cho thành viên Cao cấp và Kim cương</Text>
              <Text style={styles.lockedBody}>Quà không mở ảnh riêng tư, không tạo quan hệ và không bắt buộc người nhận phản hồi.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  close();
                  router.push('/settings/membership');
                }}
                style={({ pressed }) => [styles.upgradeButton, pressed && styles.pressed]}
              >
                <Text style={styles.upgradeText}>Xem gói thành viên</Text>
              </Pressable>
            </View>
          ) : null}

          {catalogQuery.isLoading || walletQuery.isLoading || membershipQuery.isLoading ? (
            <View style={styles.loading}><ActivityIndicator /><Text style={styles.loadingText}>Đang tải danh sách quà…</Text></View>
          ) : catalogQuery.isError || walletQuery.isError || membershipQuery.isError ? (
            <View style={styles.loading}>
              <Text style={styles.errorText}>Không tải được quà hoặc số dư.</Text>
              <Pressable onPress={() => void Promise.all([catalogQuery.refetch(), walletQuery.refetch(), membershipQuery.refetch()])}>
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.catalog} style={styles.catalogScroll}>
              <View style={styles.grid}>
                {(catalogQuery.data ?? []).map((gift) => {
                  const selected = gift.id === selectedGiftId;
                  const affordable = balanceUnits >= gift.heart_price_units;
                  return (
                    <View key={gift.id} style={[styles.tileSlot, { width: tileWidth }]}>
                      <Pressable
                        accessibilityLabel={`${gift.name_vi}, ${formatGiftHeartPrice(gift)}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: !canGift || !affordable }}
                        disabled={!canGift || sendMutation.isPending}
                        onPress={() => {
                          setErrorMessage(null);
                          setSelectedGiftId(gift.id);
                        }}
                        style={({ pressed }) => [
                          styles.giftTile,
                          selected && styles.giftSelected,
                          !affordable && styles.giftUnaffordable,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.giftIcon}>{gift.icon_emoji}</Text>
                        <Text numberOfLines={1} style={styles.giftName}>{gift.name_vi}</Text>
                        <Text style={styles.giftPrice}>{formatGiftHeartPrice(gift)}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {selectedGift ? (
            <View style={styles.confirmation}>
              <View style={styles.confirmationCopy}>
                <Text style={styles.confirmationTitle}>{selectedGift.icon_emoji} {selectedGift.name_vi}</Text>
                <Text style={styles.confirmationBody}>
                  Gửi {formatGiftHeartPrice(selectedGift)} đến {recipientName}. Người nhận nhận 70% giá trị quà vào thu nhập chờ 7 ngày.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={!canGift || !hasEnough || sendMutation.isPending}
                onPress={() => sendMutation.mutate(selectedGift)}
                style={({ pressed }) => [styles.sendButton, (!canGift || !hasEnough || sendMutation.isPending) && styles.sendDisabled, pressed && styles.pressed]}
              >
                {sendMutation.isPending ? <ActivityIndicator color={luxyColors.surface} /> : <Text style={styles.sendText}>Gửi quà</Text>}
              </Pressable>
            </View>
          ) : null}

          {selectedGift && !hasEnough ? <Text style={styles.errorText}>Số dư ❤️ chưa đủ cho món quà này.</Text> : null}
          {errorMessage ? <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text> : null}
          <Text style={styles.disclaimer}>Quà là tự nguyện và không đổi lấy cuộc hẹn, phản hồi hay quyền xem ảnh riêng tư.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(8,17,31,0.56)', flex: 1, justifyContent: 'center', padding: luxySpacing.lg },
  dialog: { backgroundColor: luxyColors.surface, borderRadius: luxyRadii.lg, maxHeight: '88%', maxWidth: 640, overflow: 'hidden', width: '100%', ...luxyShadows.modal },
  dialogCompact: { maxHeight: '92%' },
  header: { alignItems: 'flex-start', borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', padding: luxySpacing.xl },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: luxyColors.ink, fontFamily: luxyTypography.families.body, fontSize: 24, fontWeight: '600', lineHeight: 30 },
  subtitle: { color: luxyColors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  closeButton: { alignItems: 'center', height: 36, justifyContent: 'center', marginLeft: luxySpacing.md, width: 36 },
  closeText: { color: luxyColors.ink, fontSize: 30, fontWeight: '300', lineHeight: 32 },
  balanceRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: luxySpacing.xl, paddingVertical: luxySpacing.md },
  balanceLabel: { color: luxyColors.muted, fontSize: 14 },
  balanceValue: { color: luxyColors.ink, fontSize: 16, fontWeight: '700' },
  lockedBox: { backgroundColor: luxyColors.background, borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, padding: luxySpacing.xl },
  lockedTitle: { color: luxyColors.ink, fontSize: 16, fontWeight: '600' },
  lockedBody: { color: luxyColors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  upgradeButton: { alignSelf: 'flex-start', backgroundColor: luxyColors.ink, borderRadius: luxyRadii.sm, marginTop: luxySpacing.md, paddingHorizontal: luxySpacing.lg, paddingVertical: 10 },
  upgradeText: { color: luxyColors.surface, fontSize: 14, fontWeight: '700' },
  loading: { alignItems: 'center', gap: luxySpacing.sm, justifyContent: 'center', minHeight: 180, padding: luxySpacing.xl },
  loadingText: { color: luxyColors.muted, fontSize: 14 },
  catalogScroll: { maxHeight: 430 },
  catalog: { padding: luxySpacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tileSlot: { padding: 4 },
  giftTile: { alignItems: 'center', borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, minHeight: 108, paddingHorizontal: 4, paddingVertical: 10 },
  giftSelected: { backgroundColor: '#FFF7F5', borderColor: luxyColors.brandCoral, borderWidth: 2 },
  giftUnaffordable: { opacity: 0.45 },
  giftIcon: { fontSize: 28, lineHeight: 34 },
  giftName: { color: luxyColors.ink, fontSize: 11, fontWeight: '600', marginTop: 5, maxWidth: '100%' },
  giftPrice: { color: luxyColors.muted, fontSize: 11, marginTop: 3 },
  confirmation: { alignItems: 'center', borderTopColor: luxyColors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: luxySpacing.md, paddingHorizontal: luxySpacing.xl, paddingVertical: luxySpacing.lg },
  confirmationCopy: { flex: 1 },
  confirmationTitle: { color: luxyColors.ink, fontSize: 15, fontWeight: '700' },
  confirmationBody: { color: luxyColors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  sendButton: { alignItems: 'center', backgroundColor: luxyColors.brandCoral, borderRadius: luxyRadii.sm, justifyContent: 'center', minHeight: 42, minWidth: 104, paddingHorizontal: luxySpacing.lg },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: luxyColors.surface, fontSize: 14, fontWeight: '700' },
  errorText: { color: luxyColors.brandCoral, fontSize: 12, lineHeight: 17, paddingHorizontal: luxySpacing.xl, paddingVertical: 6 },
  retryText: { color: luxyColors.brandCoral, fontSize: 14, fontWeight: '700' },
  disclaimer: { borderTopColor: luxyColors.border, borderTopWidth: StyleSheet.hairlineWidth, color: luxyColors.muted, fontSize: 11, lineHeight: 16, paddingHorizontal: luxySpacing.xl, paddingVertical: luxySpacing.md },
  pressed: { opacity: 0.72 },
});
