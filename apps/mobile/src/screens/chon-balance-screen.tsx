import {
  VIETQR_HEART_AMOUNTS,
  cancelMyVietqrHeartOrder,
  createVietqrHeartOrder,
  formatHeartUnitBalance,
  formatVietqrHearts,
  formatVnd,
  getMyAvailableHeartUnits,
  getMyVietqrHeartOrder,
  getVietqrRemainingSeconds,
  getVietqrStatusLabel,
  giftCatalogQueryKeys,
  listVietqrHeartProducts,
  markMyVietqrTransferSubmitted,
  vietqrQueryKeys,
  type VietqrHeartOrder,
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ChonPaymentAction,
  ChonPaymentModal,
  ChonPaymentState,
} from '@/components/chon-payment-modal';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const ACTIVE_STATUSES = new Set(['pending', 'awaiting_confirmation']);
const FINAL_PACKS = new Set<number>(VIETQR_HEART_AMOUNTS);

type BusyAction = 'create' | 'submit' | 'cancel' | null;

export function ChonBalanceScreen() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const desktop = width >= chonBreakpoints.desktop;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<VietqrHeartOrder | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const balanceQuery = useQuery({
    queryKey: giftCatalogQueryKeys.balance(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyAvailableHeartUnits(client);
    },
  });

  const productsQuery = useQuery({
    queryKey: vietqrQueryKeys.products,
    enabled: Boolean(client && auth.userId && Platform.OS === 'web'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listVietqrHeartProducts(client);
    },
  });

  const orderQuery = useQuery({
    queryKey: vietqrQueryKeys.order(createdOrder?.order_id ?? null),
    enabled: Boolean(client && createdOrder?.order_id),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client || !createdOrder) throw new Error('vietqr_order_missing');
      return getMyVietqrHeartOrder(client, createdOrder.order_id);
    },
  });

  const order = orderQuery.data ?? createdOrder;
  const products = useMemo(
    () => (productsQuery.data ?? []).filter((product) => FINAL_PACKS.has(product.display_hearts)),
    [productsQuery.data],
  );
  const selectedProduct = products.find((product) => product.product_id === selectedId) ?? null;
  const catalogReady = products.length === VIETQR_HEART_AMOUNTS.length
    && VIETQR_HEART_AMOUNTS.every((hearts) => products.some((product) => product.display_hearts === hearts));

  useEffect(() => {
    if (products.length && !selectedId) setSelectedId(products[0]?.product_id ?? null);
  }, [products, selectedId]);

  useEffect(() => {
    if (orderQuery.data) setCreatedOrder(orderQuery.data);
  }, [orderQuery.data]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (order?.status !== 'paid') return;
    void queryClient.invalidateQueries({ queryKey: giftCatalogQueryKeys.balance(auth.userId) });
  }, [auth.userId, order?.status, queryClient]);

  const remainingSeconds = order ? getVietqrRemainingSeconds(order.expires_at, nowMs) : 0;
  const countdown = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [remainingSeconds]);

  async function createOrder() {
    if (!client || !selectedProduct || !catalogReady || Platform.OS !== 'web') return;
    setBusy('create');
    setMessage(null);
    setErrorMessage(null);
    setCopiedField(null);
    try {
      if (order && ACTIVE_STATUSES.has(order.status)) {
        await cancelMyVietqrHeartOrder(client, order.order_id);
      }
      const nextOrder = await createVietqrHeartOrder(client, {
        productId: selectedProduct.product_id,
        requestId: createRequestId(),
      });
      setCreatedOrder(nextOrder);
      queryClient.setQueryData(vietqrQueryKeys.order(nextOrder.order_id), nextOrder);
    } catch (error) {
      setErrorMessage(getPaymentErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function markSubmitted() {
    if (!client || !order) return;
    setBusy('submit');
    setMessage(null);
    setErrorMessage(null);
    try {
      await markMyVietqrTransferSubmitted(client, order.order_id);
      const refreshed = await getMyVietqrHeartOrder(client, order.order_id);
      setCreatedOrder(refreshed);
      setMessage('Đã ghi nhận. Hệ thống đang chờ đối soát giao dịch ngân hàng.');
    } catch (error) {
      setErrorMessage(getPaymentErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function cancelOrder() {
    if (!client || !order) return;
    setBusy('cancel');
    setMessage(null);
    setErrorMessage(null);
    try {
      await cancelMyVietqrHeartOrder(client, order.order_id);
      const refreshed = await getMyVietqrHeartOrder(client, order.order_id);
      setCreatedOrder(refreshed);
      setMessage('Đơn VietQR đã được hủy.');
    } catch (error) {
      setErrorMessage(getPaymentErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function copyValue(key: string, value: string) {
    if (Platform.OS !== 'web' || !globalThis.navigator?.clipboard) {
      setErrorMessage('Trình duyệt này không hỗ trợ sao chép tự động.');
      return;
    }
    try {
      await globalThis.navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField((current) => (current === key ? null : current)), 1_800);
    } catch {
      setErrorMessage('Không thể sao chép. Hãy sao chép thủ công.');
    }
  }

  const modalRows = order ? [
    { key: 'product', label: 'Mã sản phẩm', value: order.product_id },
    { key: 'hearts', label: 'Nhận được', value: formatVietqrHearts(order.display_hearts) },
    { key: 'bank', label: 'Ngân hàng', value: `${order.bank_name} (${order.bank_code})` },
    {
      key: 'account',
      label: 'Số tài khoản',
      value: order.account_no,
      copied: copiedField === 'account',
      onCopy: () => void copyValue('account', order.account_no),
    },
    { key: 'owner', label: 'Chủ tài khoản', value: order.account_name },
    {
      key: 'amount',
      label: 'Số tiền',
      value: formatVnd(order.amount_vnd),
      copied: copiedField === 'amount',
      onCopy: () => void copyValue('amount', String(order.amount_vnd)),
    },
    {
      key: 'content',
      label: 'Nội dung',
      value: order.transfer_content,
      copied: copiedField === 'content',
      onCopy: () => void copyValue('content', order.transfer_content),
    },
  ] : [];

  return (
    <View style={styles.root} testID="chon-balance-screen">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, desktop && styles.pageDesktop]}>
          <Text accessibilityRole="header" style={[styles.title, desktop && styles.titleDesktop]}>Số dư</Text>

          <View style={styles.balanceLine} testID="balance-single-line">
            {balanceQuery.isLoading ? (
              <ActivityIndicator color={chonColors.primaryRed} />
            ) : balanceQuery.error ? (
              <Text accessibilityRole="alert" style={styles.error}>Không thể tải số dư.</Text>
            ) : (
              <Text style={styles.balanceText}>Số dư khả dụng: {formatHeartUnitBalance(balanceQuery.data ?? 0)}</Text>
            )}
          </View>

          {Platform.OS === 'web' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chọn gói nạp</Text>

              {productsQuery.isLoading ? (
                <View style={styles.centerState}>
                  <ActivityIndicator color={chonColors.primaryRed} />
                  <Text style={styles.med}>Đang tải các gói…</Text>
                </View>
              ) : productsQuery.error ? (
                <View style={styles.centerState}>
                  <Text accessibilityRole="alert" style={styles.error}>Không thể tải các gói ❤️.</Text>
                  <Pressable accessibilityRole="button" onPress={() => void productsQuery.refetch()} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Thử lại</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.packGrid} testID="balance-pack-grid">
                    {products.map((product) => {
                      const selected = selectedId === product.product_id;
                      return (
                        <Pressable
                          accessibilityLabel={`${formatVietqrHearts(product.display_hearts)}, ${formatVnd(product.amount_vnd)}`}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          key={product.product_id}
                          onPress={() => setSelectedId(product.product_id)}
                          style={({ pressed }) => [
                            styles.packCard,
                            selected && styles.packCardSelected,
                            pressed && styles.pressed,
                          ]}
                          testID={`balance-pack-${product.display_hearts}`}
                        >
                          <Text style={[styles.packHearts, selected && styles.packHeartsSelected]}>{formatVietqrHearts(product.display_hearts)}</Text>
                          <Text style={[styles.packAmount, selected && styles.packAmountSelected]}>{formatVnd(product.amount_vnd)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {!catalogReady ? (
                    <Text accessibilityRole="alert" style={styles.configError} testID="balance-catalog-blocker">
                      Cấu hình gói nạp chưa đầy đủ. Chon.Love chỉ mở thanh toán khi đủ 6 gói 10 / 50 / 100 / 200 / 500 / 1.000 ❤️ từ server.
                    </Text>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !selectedProduct || !catalogReady || busy !== null }}
                    disabled={!selectedProduct || !catalogReady || busy !== null}
                    onPress={() => void createOrder()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (!selectedProduct || !catalogReady || busy !== null) && styles.disabled,
                      pressed && styles.primaryButtonPressed,
                    ]}
                    testID="balance-checkout-cta"
                  >
                    {busy === 'create' ? <ActivityIndicator color={chonColors.surface} /> : (
                      <Text style={styles.primaryButtonText}>
                        {selectedProduct ? `Nạp ${formatVietqrHearts(selectedProduct.display_hearts)}` : 'Chọn gói nạp'}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <View style={styles.centerState}>
              <Text style={styles.sectionTitle}>Thanh toán trên web</Text>
              <Text style={styles.muted}>VietQR hiện được hỗ trợ trên web; native billing sẽ dùng cơ chế cửa hàng ứng dụng khi phát hành.</Text>
            </View>
          )}

          {errorMessage ? <Text accessibilityRole="alert" style={styles.errorBanner}>{errorMessage}</Text> : null}
        </View>
      </ScrollView>

      <ChonPaymentModal
        eyebrow={order?.order_code ?? null}
        error={orderQuery.isError ? 'Không thể tải chi tiết thanh toán.' : null}
        footerNote="❤️ chỉ được cộng sau khi server đối soát giao dịch; nút xác nhận không tự cộng số dư."
        loading={Boolean(createdOrder) && orderQuery.isLoading && !order}
        onClose={() => {
          setCreatedOrder(null);
          setMessage(null);
          setErrorMessage(null);
        }}
        qrAccessibilityLabel="Mã VietQR nạp tim"
        qrImageUrl={order && ACTIVE_STATUSES.has(order.status) ? order.qr_image_url : null}
        rows={modalRows}
        status={order ? (order.status === 'paid' ? 'Đã xác nhận' : `${getVietqrStatusLabel(order.status)} · ${countdown}`) : null}
        testID="balance-payment-modal"
        title={order ? `Nạp ${formatVietqrHearts(order.display_hearts)}` : 'Thanh toán VietQR'}
        visible={Boolean(createdOrder) || orderQuery.isLoading || orderQuery.isError}
      >
        {order?.status === 'pending' ? (
          <ChonPaymentAction
            disabled={busy !== null}
            label="Tôi đã chuyển khoản"
            loading={busy === 'submit'}
            onPress={() => void markSubmitted()}
            testID="balance-transfer-submitted"
          />
        ) : null}
        {order?.status === 'awaiting_confirmation' ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={chonColors.primaryRed} />
            <Text style={styles.muted}>Đang chờ đối soát. Tự kiểm tra lại mỗi 10 giây.</Text>
          </View>
        ) : null}
        {order?.status === 'paid' ? (
          <ChonPaymentState success text="Số ❤️ đã được cộng vào số dư." title="Thanh toán đã xác nhận" />
        ) : null}
        {order && ['expired', 'rejected', 'cancelled'].includes(order.status) ? (
          <ChonPaymentState text="Bạn có thể đóng popup và tạo một đơn mới." title={getVietqrStatusLabel(order.status)} />
        ) : null}
        {order && ACTIVE_STATUSES.has(order.status) ? (
          <ChonPaymentAction
            disabled={busy !== null}
            label={busy === 'cancel' ? 'Đang hủy…' : 'Hủy đơn'}
            onPress={() => void cancelOrder()}
            secondary
          />
        ) : null}
        {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}
      </ChonPaymentModal>
    </View>
  );
}

function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function getPaymentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('heart_product_not_active')) return 'Gói ❤️ này hiện không khả dụng.';
  if (message.includes('active_adult_account_required')) return 'Tài khoản phải đang hoạt động và đủ 18 tuổi.';
  if (message.includes('vietqr_order_not_found')) return 'Không tìm thấy đơn VietQR.';
  if (message.includes('vietqr_account_not_configured')) return 'Tài khoản nhận VietQR chưa được cấu hình.';
  return 'Không thể xử lý thanh toán VietQR. Vui lòng thử lại.';
}

const styles = StyleSheet.create({
  root: { backgroundColor: chonColors.surface, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 72 },
  page: { alignSelf: 'center', maxWidth: 680, paddingHorizontal: chonLayout.contentHorizontalPaddingMobile, paddingTop: 28, width: '100%' },
  pageDesktop: { paddingTop: 36 },
  title: {
    color: chonColors.goldStrong,
    fontFamily: chonTypography.families.display,
    fontSize: chonTypography.sizes.h2,
    lineHeight: chonTypography.lineHeights.h2,
    textAlign: 'center',
  },
  titleDesktop: { fontSize: chonTypography.sizes.h1Desktop, lineHeight: chonTypography.lineHeights.h1Desktop },
  balanceLine: { alignItems: 'center', justifyContent: 'center', minHeight: 54, paddingVertical: 8 },
  balanceText: { color: chonColors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  section: { gap: 14, marginTop: 12 },
  sectionTitle: { color: chonColors.text, fontSize: chonTypography.sizes.h3, fontWeight: '800', textAlign: 'center' },
  packGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  packCard: {
    alignItems: 'center',
    backgroundColor: chonColors.surface,
    borderColor: chonColors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 92,
    paddingHorizontal: 8,
    paddingVertical: 12,
    width: '48.5%',
  },
  packCardSelected: { backgroundColor: chonColors.goldStrong, borderColor: chonColors.primaryRed, borderWidth: 2, ...chonShadows.card },
  packHearts: { color: chonColors.text, fontSize: 18, fontWeight: '900' },
  packHeartsSelected: { color: chonColors.surface },
  packAmount: { color: chonColors.muted, fontSize: 12, fontWeight: '600', marginTop: 5 },
  packAmountSelected: { color: chonColors.surface },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: chonColors.primaryRed,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    minHeight: chonLayout.primaryActionHeight,
    paddingHorizontal: 28,
    width: '100%',
    ...chonShadows.primaryHover,
  },
  primaryButtonPressed: { backgroundColor: chonColors.primaryRedHover, opacity: chonInteraction.pressedOpacity },
  primaryButtonText: { color: chonColors.surface, fontSize: 14, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: chonColors.gold, borderRadius: luxyRadii.pill, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: chonColors.text, fontSize: 13, fontWeight: '700' },
  centerState: { alignItems: 'center', gap: luxySpacing.sm, justifyContent: 'center', minHeight: 130 },
  muted: { color: chonColors.muted, fontSize: 12.5, lineHeight: 19, textAlign: 'center' },
  error: { color: chonColors.danger, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  configError: { color: chonColors.danger, fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  errorBanner: { color: chonColors.danger, fontSize: 12, marginTop: 14, textAlign: 'center' },
  waiting: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', paddingVertical: 6 },
  notice: { color: chonColors.goldStrong, fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: chonInteraction.pressedOpacity },
});
