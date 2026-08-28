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
  type LuxyGiftSendResult,
} from '@myfan/supabase';
import {
  chonBreakpoints,
  chonColors,
  chonInteraction,
  chonLayout,
  chonShadows,
  chonTypography,
  luxyRadii,
  luxySpacing,
} from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { ChonBrandIcon } from '@/components/chon-brand-icon';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type GiftFlowStep = 'catalog' | 'confirm' | 'result';
type GiftSendAttempt = { gift: GiftCatalogItem; idempotencyKey: string };

export function ChonGiftModal({
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
  const [step, setStep] = useState<GiftFlowStep>('catalog');
  const [attemptKey, setAttemptKey] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<LuxyGiftSendResult | null>(null);
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
  const balanceUnits = sendResult?.sender_balance_units
    ?? walletQuery.data?.heart_available_units
    ?? membershipQuery.data?.heart_balance_units
    ?? 0;
  const preSendBalanceUnits = walletQuery.data?.heart_available_units ?? membershipQuery.data?.heart_balance_units ?? 0;
  const hasEnough = selectedGift ? preSendBalanceUnits >= selectedGift.heart_price_units : false;
  const compact = width < chonBreakpoints.mobile;
  const columns = width < chonBreakpoints.compactPhone ? 4 : 5;
  const tileWidth = `${100 / columns}%` as `${number}%`;

  function resetFlow() {
    setSelectedGiftId(null);
    setStep('catalog');
    setAttemptKey(null);
    setSendResult(null);
    setErrorMessage(null);
  }

  useEffect(() => {
    if (!visible) resetFlow();
  }, [visible]);

  const sendMutation = useMutation({
    mutationFn: async ({ gift, idempotencyKey }: GiftSendAttempt) => {
      if (!client) throw new Error('supabase_unavailable');
      return sendGiftToMember(client, {
        recipientId,
        giftId: gift.id,
        quantity: 1,
        idempotencyKey,
        ...(conversationId
          ? { conversationId, clientMessageId: createChatClientMessageId() }
          : {}),
      });
    },
    onSuccess: async (result) => {
      setErrorMessage(null);
      setSendResult(result);
      setStep('result');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: giftCatalogQueryKeys.wallet(auth.userId) }),
        queryClient.invalidateQueries({ queryKey: giftCatalogQueryKeys.history(auth.userId, 'sent') }),
        queryClient.invalidateQueries({ queryKey: giftCatalogQueryKeys.history(auth.userId, 'received') }),
        queryClient.invalidateQueries({ queryKey: ['luxy-membership', auth.userId] }),
        ...(conversationId
          ? [queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] })]
          : []),
      ]);
      onSent?.();
    },
    onError: (error) => setErrorMessage(getReadableGiftError(error)),
  });

  const close = () => {
    if (sendMutation.isPending) return;
    resetFlow();
    onClose();
  };

  function chooseGift(giftId: string) {
    setErrorMessage(null);
    setSelectedGiftId(giftId);
    setAttemptKey(null);
    setSendResult(null);
  }

  function beginConfirmation() {
    if (!selectedGift || !canGift || !hasEnough) return;
    setErrorMessage(null);
    setAttemptKey(createGiftIdempotencyKey());
    setStep('confirm');
  }

  function confirmSend() {
    if (!selectedGift || !canGift || !hasEnough || sendMutation.isPending) return;
    const idempotencyKey = attemptKey ?? createGiftIdempotencyKey();
    if (!attemptKey) setAttemptKey(idempotencyKey);
    setErrorMessage(null);
    sendMutation.mutate({ gift: selectedGift, idempotencyKey });
  }

  const catalog = catalogQuery.data ?? [];
  const dialogTitle = step === 'result' ? 'Đã gửi quà' : step === 'confirm' ? 'Xác nhận tặng quà' : 'Tặng quà';
  const dialogSubtitle = step === 'result'
    ? `Giao dịch với ${recipientName} đã được server xác nhận.`
    : step === 'confirm'
      ? `Kiểm tra lại món quà trước khi gửi đến ${recipientName}.`
      : `Gửi một món quà tự nguyện đến ${recipientName}`;

  return (
    <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
      <View style={[styles.backdrop, compact && styles.backdropCompact]}>
        <Pressable accessibilityLabel="Đóng danh sách quà" onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.dialog, compact && styles.dialogCompact]} testID="chon-gift-picker">
          <View style={[styles.header, compact && styles.headerCompact]}>
            <ChonBrandIcon name="gift" size={24} />
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={styles.title}>{dialogTitle}</Text>
              <Text numberOfLines={2} style={styles.subtitle}>{dialogSubtitle}</Text>
            </View>
            <Pressable
              accessibilityLabel="Đóng"
              accessibilityRole="button"
              disabled={sendMutation.isPending}
              onPress={close}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={[styles.balanceRow, compact && styles.balanceRowCompact]} testID="chon-gift-picker-balance">
            <Text style={styles.balanceLabel}>Số dư ❤️</Text>
            <Text style={styles.balanceValue}>{formatHeartUnitBalance(balanceUnits)}</Text>
          </View>

          {step === 'result' && sendResult ? (
            <View style={styles.resultPanel} testID="chon-gift-picker-result">
              <View style={styles.resultMark}><Text style={styles.resultMarkText}>✓</Text></View>
              <Text style={styles.resultTitle}>Đã tặng {selectedGift?.name_vi ?? 'quà'} cho {recipientName}</Text>
              <Text style={styles.resultBody}>
                {sendResult.already_processed
                  ? 'Giao dịch này đã được xác nhận trước đó. Hệ thống không trừ thêm ❤️ khi bạn gửi lại yêu cầu.'
                  : `Đã gửi ${formatHeartUnitBalance(sendResult.gross_heart_units)}. Số dư còn lại ${formatHeartUnitBalance(sendResult.sender_balance_units)}.`}
              </Text>
              <Text style={styles.resultNote}>Người nhận nhận phần thu nhập theo chính sách quà hiện hành sau thời gian chờ 7 ngày.</Text>
              <Pressable accessibilityRole="button" onPress={close} style={({ pressed }) => [styles.resultButton, pressed && styles.sendButtonPressed]}>
                <Text style={styles.resultButtonText}>Xong</Text>
              </Pressable>
            </View>
          ) : step === 'confirm' && selectedGift ? (
            <View style={styles.confirmPanel} testID="chon-gift-picker-confirm-step">
              <View style={styles.confirmGiftIcon}><Text style={styles.confirmGiftEmoji}>{selectedGift.icon_emoji}</Text></View>
              <Text style={styles.confirmTitle}>Xác nhận tặng {selectedGift.name_vi}</Text>
              <Text style={styles.confirmBody}>Bạn sẽ gửi {formatGiftHeartPrice(selectedGift)} đến {recipientName}.</Text>
              <View style={styles.confirmFacts}>
                <View style={styles.confirmFactRow}><Text style={styles.confirmFactLabel}>Số dư hiện tại</Text><Text style={styles.confirmFactValue}>{formatHeartUnitBalance(preSendBalanceUnits)}</Text></View>
                <View style={styles.confirmFactRow}><Text style={styles.confirmFactLabel}>Sau khi gửi</Text><Text style={styles.confirmFactValue}>{formatHeartUnitBalance(Math.max(0, preSendBalanceUnits - selectedGift.heart_price_units))}</Text></View>
              </View>
              <Text style={styles.confirmNote}>Người nhận nhận 70% giá trị quà vào thu nhập chờ 7 ngày. Quà không đổi lấy phản hồi, cuộc hẹn hoặc quyền xem ảnh riêng tư.</Text>
              {errorMessage ? <Text accessibilityRole="alert" style={styles.confirmError}>{errorMessage}</Text> : null}
              <View style={[styles.confirmActions, compact && styles.confirmActionsCompact]}>
                <Pressable
                  accessibilityRole="button"
                  disabled={sendMutation.isPending}
                  onPress={() => {
                    setErrorMessage(null);
                    setAttemptKey(null);
                    setStep('catalog');
                  }}
                  style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
                >
                  <Text style={styles.backButtonText}>Quay lại</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={sendMutation.isPending}
                  onPress={confirmSend}
                  style={({ pressed }) => [styles.sendButton, styles.confirmSendButton, sendMutation.isPending && styles.sendDisabled, pressed && styles.sendButtonPressed]}
                  testID="chon-gift-picker-confirm-send"
                >
                  {sendMutation.isPending ? <ActivityIndicator color={chonColors.surface} /> : <Text style={styles.sendText}>Xác nhận tặng</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {!membershipQuery.isLoading && !canGift ? (
                <View style={[styles.lockedBox, compact && styles.lockedBoxCompact]}>
                  <Text style={styles.lockedTitle}>Quà dành cho thành viên Cao cấp và Kim cương</Text>
                  <Text style={styles.lockedBody}>Tặng quà giúp tạo thiện cảm ban đầu và giúp xây dựng một mối quan hệ mới</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      close();
                      router.push('/settings/membership');
                    }}
                    style={({ pressed }) => [styles.upgradeButton, pressed && styles.upgradeButtonPressed]}
                  >
                    <Text style={styles.upgradeText}>Xem gói thành viên</Text>
                  </Pressable>
                </View>
              ) : null}

              {catalogQuery.isLoading || walletQuery.isLoading || membershipQuery.isLoading ? (
                <StatePanel title="Đang tải quà tặng" text="Danh sách quà và số dư sẽ hiển thị ngay khi sẵn sàng." loading />
              ) : catalogQuery.isError || walletQuery.isError || membershipQuery.isError ? (
                <View style={styles.statePanel} testID="chon-gift-picker-error">
                  <Text style={styles.stateTitle}>Không tải được quà hoặc số dư</Text>
                  <Text style={styles.stateText}>Vui lòng thử lại để tải lại thông tin hiện tại.</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void Promise.all([catalogQuery.refetch(), walletQuery.refetch(), membershipQuery.refetch()])}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
                  >
                    <Text style={styles.retryText}>Thử lại</Text>
                  </Pressable>
                </View>
              ) : catalog.length === 0 ? (
                <StatePanel title="Chưa có quà tặng" text="Danh mục quà hiện chưa có món quà đang hoạt động." />
              ) : (
                <ScrollView contentContainerStyle={[styles.catalog, compact && styles.catalogCompact]} showsVerticalScrollIndicator={false} style={styles.catalogScroll}>
                  <Text style={styles.catalogTitle}>Chọn món quà</Text>
                  <Text style={styles.catalogHint}>Giá quà được hiển thị bằng ❤️.</Text>
                  <View style={styles.grid} testID="chon-gift-picker-grid">
                    {catalog.map((gift) => {
                      const selected = gift.id === selectedGiftId;
                      const affordable = preSendBalanceUnits >= gift.heart_price_units;
                      return (
                        <View key={gift.id} style={[styles.tileSlot, { width: tileWidth }]}>
                          <Pressable
                            accessibilityLabel={`${gift.name_vi}, ${formatGiftHeartPrice(gift)}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled: !canGift }}
                            disabled={!canGift || sendMutation.isPending}
                            onPress={() => chooseGift(gift.id)}
                            style={({ pressed }) => [
                              styles.giftTile,
                              compact && styles.giftTileCompact,
                              selected && styles.giftSelected,
                              !affordable && styles.giftUnaffordable,
                              pressed && styles.pressed,
                            ]}
                            testID="chon-gift-picker-item"
                          >
                            <View style={[styles.giftIconRing, selected && styles.giftIconRingSelected]} testID="chon-gift-catalog-icon">
                              <Text style={styles.giftIcon}>{gift.icon_emoji}</Text>
                            </View>
                            <Text numberOfLines={1} style={[styles.giftName, selected && styles.giftTextSelected]}>{gift.name_vi}</Text>
                            <Text style={[styles.giftPrice, selected && styles.giftTextSelected, !affordable && styles.giftPriceUnaffordable]}>{formatGiftHeartPrice(gift)}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {selectedGift ? (
                <View style={[styles.confirmation, compact && styles.confirmationCompact]} testID="chon-gift-picker-selection">
                  <View style={styles.confirmationIcon}><Text style={styles.confirmationGiftIcon}>{selectedGift.icon_emoji}</Text></View>
                  <View style={styles.confirmationCopy}>
                    <Text style={styles.confirmationTitle}>{selectedGift.name_vi}</Text>
                    <Text style={styles.confirmationBody}>Tặng {formatGiftHeartPrice(selectedGift)} cho {recipientName}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!canGift || !hasEnough || sendMutation.isPending}
                    onPress={beginConfirmation}
                    style={({ pressed }) => [styles.sendButton, compact && styles.sendButtonCompact, (!canGift || !hasEnough || sendMutation.isPending) && styles.sendDisabled, pressed && styles.sendButtonPressed]}
                    testID="chon-gift-picker-review"
                  >
                    <Text style={styles.sendText}>Tiếp tục</Text>
                  </Pressable>
                </View>
              ) : null}

              {selectedGift && !hasEnough ? <Text style={styles.errorText}>Số dư ❤️ chưa đủ cho món quà này.</Text> : null}
              {errorMessage ? <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text> : null}
            </>
          )}

          <Text style={styles.disclaimer}>Quà là tự nguyện và không đổi lấy cuộc hẹn, phản hồi hay quyền xem ảnh riêng tư.</Text>
        </View>
      </View>
    </Modal>
  );
}

function StatePanel({ title, text, loading = false }: { title: string; text: string; loading?: boolean }) {
  return (
    <View style={styles.statePanel} testID={loading ? 'chon-gift-picker-loading' : 'chon-gift-picker-empty'}>
      {loading ? <ActivityIndicator color={chonColors.primaryRed} /> : null}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: chonColors.overlay, flex: 1, justifyContent: 'center', padding: luxySpacing.lg },
  backdropCompact: { justifyContent: 'flex-end', padding: 10 },
  dialog: { backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: luxyRadii.lg, borderWidth: 1, maxHeight: '90%', maxWidth: 600, overflow: 'hidden', width: '100%', ...chonShadows.card },
  dialogCompact: { borderRadius: 18, maxHeight: '94%' },
  header: { alignItems: 'center', borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: luxySpacing.md, paddingHorizontal: luxySpacing.xl, paddingVertical: 18 },
  headerCompact: { paddingHorizontal: chonLayout.contentHorizontalPaddingMobile, paddingVertical: 14 },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: chonColors.ink, fontFamily: chonTypography.families.display, fontSize: 20, fontWeight: '600', lineHeight: 26 },
  subtitle: { color: chonColors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  closeButton: { alignItems: 'center', borderRadius: 20, height: chonLayout.minimumTouchTarget, justifyContent: 'center', width: chonLayout.minimumTouchTarget },
  closeText: { color: chonColors.ink, fontSize: 28, fontWeight: '300', lineHeight: 30 },
  balanceRow: { alignItems: 'center', backgroundColor: chonColors.warmSurface, borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: luxySpacing.xl, paddingVertical: 10 },
  balanceRowCompact: { paddingHorizontal: chonLayout.contentHorizontalPaddingMobile },
  balanceLabel: { color: chonColors.text, fontSize: 12, fontWeight: '600' },
  balanceValue: { color: chonColors.ink, fontSize: 15, fontWeight: '700' },
  lockedBox: { backgroundColor: chonColors.warmSurface, borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, padding: luxySpacing.xl },
  lockedBoxCompact: { padding: chonLayout.contentHorizontalPaddingMobile },
  lockedTitle: { color: chonColors.ink, fontSize: 14, fontWeight: '700' },
  lockedBody: { color: chonColors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  upgradeButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: chonColors.surface, borderColor: chonColors.gold, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', marginTop: luxySpacing.md, minHeight: chonLayout.minimumTouchTarget, paddingHorizontal: luxySpacing.lg },
  upgradeButtonPressed: { backgroundColor: chonColors.warmSurfaceStrong, ...chonShadows.hover },
  upgradeText: { color: chonColors.text, fontSize: 12, fontWeight: '700' },
  statePanel: { alignItems: 'center', gap: 7, justifyContent: 'center', minHeight: 210, padding: luxySpacing.xl },
  stateTitle: { color: chonColors.ink, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  stateText: { color: chonColors.muted, fontSize: 12, lineHeight: 18, maxWidth: 340, textAlign: 'center' },
  retryButton: { alignItems: 'center', backgroundColor: chonColors.surface, borderColor: chonColors.gold, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', marginTop: 6, minHeight: chonLayout.minimumTouchTarget, paddingHorizontal: 20 },
  retryButtonPressed: { backgroundColor: chonColors.warmSurfaceStrong, ...chonShadows.hover },
  retryText: { color: chonColors.text, fontSize: 12, fontWeight: '700' },
  catalogScroll: { maxHeight: 430 },
  catalog: { paddingHorizontal: 14, paddingVertical: 14 },
  catalogCompact: { paddingHorizontal: 7, paddingVertical: 12 },
  catalogTitle: { color: chonColors.ink, fontSize: 13, fontWeight: '700', paddingHorizontal: 5 },
  catalogHint: { color: chonColors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 2, paddingHorizontal: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 7 },
  tileSlot: { padding: 4 },
  giftTile: { alignItems: 'center', backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: luxyRadii.md, borderWidth: 1, minHeight: 126, paddingHorizontal: 5, paddingVertical: 9 },
  giftTileCompact: { minHeight: 116, paddingHorizontal: 3, paddingVertical: 8 },
  giftSelected: { backgroundColor: chonColors.goldStrong, borderColor: chonColors.primaryRed, borderWidth: 2, ...chonShadows.card },
  giftUnaffordable: { opacity: 0.58 },
  giftIconRing: { alignItems: 'center', backgroundColor: 'transparent', borderColor: chonColors.gold, borderRadius: 32, borderWidth: 2, height: 58, justifyContent: 'center', width: 58 },
  giftIconRingSelected: { borderColor: chonColors.surface },
  giftIcon: { fontSize: 32, lineHeight: 38 },
  giftName: { color: chonColors.ink, fontSize: 11, fontWeight: '700', marginTop: 7, maxWidth: '100%' },
  giftPrice: { color: chonColors.goldStrong, fontSize: 10.5, fontWeight: '700', marginTop: 3 },
  giftTextSelected: { color: chonColors.surface },
  giftPriceUnaffordable: { color: chonColors.danger },
  confirmation: { alignItems: 'center', backgroundColor: chonColors.warmSurface, borderTopColor: chonColors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: luxySpacing.md, paddingHorizontal: luxySpacing.xl, paddingVertical: 14 },
  confirmationCompact: { alignItems: 'stretch', flexDirection: 'column', gap: 10, paddingHorizontal: chonLayout.contentHorizontalPaddingMobile },
  confirmationIcon: { alignItems: 'center', borderColor: chonColors.gold, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  confirmationGiftIcon: { fontSize: 24, lineHeight: 30 },
  confirmationCopy: { flex: 1 },
  confirmationTitle: { color: chonColors.ink, fontSize: 13, fontWeight: '700' },
  confirmationBody: { color: chonColors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  sendButton: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: chonLayout.minimumTouchTarget, minWidth: 112, paddingHorizontal: 18 },
  sendButtonCompact: { alignSelf: 'stretch' },
  sendButtonPressed: { backgroundColor: chonColors.primaryRedHover, opacity: chonInteraction.pressedOpacity, ...chonShadows.primaryHover },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: chonColors.surface, fontSize: 12, fontWeight: '700' },
  confirmPanel: { alignItems: 'center', gap: 10, minHeight: 320, paddingHorizontal: luxySpacing.xl, paddingVertical: 26 },
  confirmGiftIcon: { alignItems: 'center', borderColor: chonColors.gold, borderRadius: 42, borderWidth: 2, height: 82, justifyContent: 'center', width: 82 },
  confirmGiftEmoji: { fontSize: 42, lineHeight: 48 },
  confirmTitle: { color: chonColors.ink, fontFamily: chonTypography.families.display, fontSize: 20, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  confirmBody: { color: chonColors.text, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  confirmFacts: { alignSelf: 'stretch', backgroundColor: chonColors.warmSurface, borderRadius: luxyRadii.md, marginTop: 4, paddingHorizontal: 14, paddingVertical: 9 },
  confirmFactRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 32 },
  confirmFactLabel: { color: chonColors.muted, fontSize: 12 },
  confirmFactValue: { color: chonColors.ink, fontSize: 12, fontWeight: '700' },
  confirmNote: { color: chonColors.muted, fontSize: 11, lineHeight: 17, maxWidth: 460, textAlign: 'center' },
  confirmError: { color: chonColors.danger, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  confirmActions: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 4, width: '100%' },
  confirmActionsCompact: { flexDirection: 'column-reverse' },
  backButton: { alignItems: 'center', borderColor: chonColors.borderStrong, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: chonLayout.minimumTouchTarget, minWidth: 112, paddingHorizontal: 18 },
  backButtonText: { color: chonColors.text, fontSize: 12, fontWeight: '700' },
  confirmSendButton: { minWidth: 150 },
  resultPanel: { alignItems: 'center', gap: 10, minHeight: 320, paddingHorizontal: luxySpacing.xl, paddingVertical: 30 },
  resultMark: { alignItems: 'center', backgroundColor: chonColors.warmSurfaceStrong, borderColor: chonColors.gold, borderRadius: 34, borderWidth: 1, height: 68, justifyContent: 'center', width: 68 },
  resultMarkText: { color: chonColors.primaryRed, fontSize: 32, fontWeight: '700' },
  resultTitle: { color: chonColors.ink, fontFamily: chonTypography.families.display, fontSize: 20, fontWeight: '600', maxWidth: 440, textAlign: 'center' },
  resultBody: { color: chonColors.text, fontSize: 13, lineHeight: 20, maxWidth: 440, textAlign: 'center' },
  resultNote: { color: chonColors.muted, fontSize: 11, lineHeight: 17, maxWidth: 440, textAlign: 'center' },
  resultButton: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderRadius: luxyRadii.pill, justifyContent: 'center', marginTop: 5, minHeight: chonLayout.minimumTouchTarget, minWidth: 130, paddingHorizontal: 22 },
  resultButtonText: { color: chonColors.surface, fontSize: 12, fontWeight: '700' },
  errorText: { color: chonColors.danger, fontSize: 11, lineHeight: 16, paddingHorizontal: luxySpacing.xl, paddingTop: 8, textAlign: 'center' },
  disclaimer: { color: chonColors.muted, fontSize: 10, lineHeight: 15, paddingHorizontal: luxySpacing.xl, paddingVertical: 10, textAlign: 'center' },
  pressed: { opacity: chonInteraction.pressedOpacity },
});