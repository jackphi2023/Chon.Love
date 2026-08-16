import {
  cancelMyVietqrHeartOrder,
  createVietqrHeartOrder,
  formatVietqrHearts,
  formatVnd,
  getMyVietqrHeartOrder,
  getVietqrRemainingSeconds,
  getVietqrStatusLabel,
  giftCatalogQueryKeys,
  listVietqrHeartProducts,
  markMyVietqrTransferSubmitted,
  vietqrQueryKeys,
  type VietqrHeartOrder,
  type VietqrHeartProduct,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const ACTIVE_STATUSES = new Set(['pending', 'awaiting_confirmation']);

export default function VietqrCheckoutPage() {
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<VietqrHeartProduct | null>(null);
  const [createdOrder, setCreatedOrder] = useState<VietqrHeartOrder | null>(null);
  const [busy, setBusy] = useState<'create' | 'submit' | 'cancel' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

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
  const products = productsQuery.data ?? [];

  useEffect(() => {
    if (orderQuery.data) setCreatedOrder(orderQuery.data);
  }, [orderQuery.data]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (order?.status === 'paid') {
      void queryClient.invalidateQueries({ queryKey: giftCatalogQueryKeys.balance(auth.userId) });
    }
  }, [auth.userId, order?.status, queryClient]);

  const remainingSeconds = order ? getVietqrRemainingSeconds(order.expires_at, nowMs) : 0;
  const countdown = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [remainingSeconds]);

  async function createOrder(product: VietqrHeartProduct) {
    if (!client) return;
    setBusy('create');
    setSelectedProduct(product);
    setMessage(null);
    setErrorMessage(null);
    setCopiedField(null);
    try {
      if (order && ACTIVE_STATUSES.has(order.status)) {
        await cancelMyVietqrHeartOrder(client, order.order_id);
      }
      const nextOrder = await createVietqrHeartOrder(client, {
        productId: product.product_id,
        requestId: createRequestId(),
      });
      setCreatedOrder(nextOrder);
      await queryClient.setQueryData(vietqrQueryKeys.order(nextOrder.order_id), nextOrder);
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
      setMessage('Đã ghi nhận thông báo của bạn. Hệ thống đang chờ đối soát giao dịch ngân hàng.');
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

  async function copyValue(label: string, value: string) {
    if (Platform.OS !== 'web' || !globalThis.navigator?.clipboard) {
      setErrorMessage('Trình duyệt này không hỗ trợ sao chép tự động.');
      return;
    }
    try {
      await globalThis.navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField((current) => (current === label ? null : current)), 2_000);
    } catch {
      setErrorMessage('Không thể sao chép. Hãy chạm giữ nội dung để sao chép thủ công.');
    }
  }

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text accessibilityRole="header" style={styles.title}>VietQR dành cho mobile web</Text>
          <Text style={styles.muted}>
            Trên Android, giao dịch vật phẩm số sẽ sử dụng Google Play Billing khi tính năng được mở.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <View style={styles.headingCopy}>
            <Text accessibilityRole="header" style={styles.title}>Nạp ❤️ bằng VietQR</Text>
            <Text style={styles.muted}>Chọn gói, quét mã và giữ nguyên số tiền cùng nội dung chuyển khoản.</Text>
          </View>
          <View style={styles.ageBadge}><Text style={styles.ageBadgeText}>18+</Text></View>
        </View>

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Không cộng ❤️ chỉ dựa trên ảnh chụp hoặc nút xác nhận</Text>
          <Text style={styles.safetyText}>
            ❤️ chỉ được ghi vào ledger sau khi server đối soát đúng số tiền và mã giao dịch ngân hàng. Mỗi mã QR chỉ dùng cho một đơn.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chọn gói ❤️</Text>
          <Text style={styles.sectionMeta}>1 ❤️ = 50.000 VNĐ</Text>
        </View>

        {productsQuery.isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.muted}>Đang tải các gói…</Text>
          </View>
        ) : productsQuery.error ? (
          <View style={styles.loadingCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>Không thể tải các gói ❤️.</Text>
            <Pressable onPress={() => void productsQuery.refetch()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.productGrid}>
            {products.map((product) => {
              const selected = selectedProduct?.product_id === product.product_id;
              return (
                <Pressable
                  accessibilityLabel={`${formatVietqrHearts(product.display_hearts)}, ${formatVnd(product.amount_vnd)}`}
                  accessibilityRole="button"
                  disabled={busy !== null}
                  key={product.product_id}
                  onPress={() => void createOrder(product)}
                  style={({ pressed }) => [
                    styles.productCard,
                    selected && styles.productCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.productHearts}>{formatVietqrHearts(product.display_hearts)}</Text>
                  <Text style={styles.productAmount}>{formatVnd(product.amount_vnd)}</Text>
                  {busy === 'create' && selected ? <ActivityIndicator color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {order ? (
          <View style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderEyebrow}>ĐƠN {order.order_code}</Text>
                <Text style={styles.orderTitle}>{getVietqrStatusLabel(order.status)}</Text>
              </View>
              <View style={[styles.statusBadge, order.status === 'paid' && styles.statusPaid]}>
                <Text style={[styles.statusBadgeText, order.status === 'paid' && styles.statusPaidText]}>
                  {order.status === 'paid' ? '✓ ĐÃ CỘNG' : countdown}
                </Text>
              </View>
            </View>

            {ACTIVE_STATUSES.has(order.status) ? (
              <Image accessibilityLabel="Mã VietQR thanh toán" resizeMode="contain" source={{ uri: order.qr_image_url }} style={styles.qrImage} />
            ) : null}

            <View style={styles.paymentSummary}>
              <InfoRow label="Ngân hàng" value={order.bank_name} />
              <InfoRow copy={() => copyValue('account', order.account_no)} copied={copiedField === 'account'} label="Số tài khoản" value={order.account_no} />
              <InfoRow label="Chủ tài khoản" value={order.account_name} />
              <InfoRow copy={() => copyValue('amount', String(order.amount_vnd))} copied={copiedField === 'amount'} label="Số tiền" value={formatVnd(order.amount_vnd)} />
              <InfoRow copy={() => copyValue('content', order.transfer_content)} copied={copiedField === 'content'} label="Nội dung" value={order.transfer_content} />
              <InfoRow label="Nhận được" value={formatVietqrHearts(order.display_hearts)} />
            </View>

            {order.status === 'paid' ? (
              <View style={styles.successCard}>
                <Text style={styles.successTitle}>Thanh toán đã được xác nhận</Text>
                <Text style={styles.successText}>Số ❤️ đã được cộng vào số dư và có thể dùng theo quy định Chon.Love.</Text>
              </View>
            ) : null}

            {order.status === 'pending' ? (
              <Pressable disabled={busy !== null} onPress={() => void markSubmitted()} style={styles.primaryButton}>
                {busy === 'submit' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Tôi đã chuyển khoản</Text>}
              </Pressable>
            ) : null}

            {order.status === 'awaiting_confirmation' ? (
              <View style={styles.waitingCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.waitingText}>Đang chờ đối soát. Màn hình tự kiểm tra lại mỗi 10 giây.</Text>
              </View>
            ) : null}

            {ACTIVE_STATUSES.has(order.status) ? (
              <Pressable disabled={busy !== null} onPress={() => void cancelOrder()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{busy === 'cancel' ? 'Đang hủy…' : 'Hủy đơn này'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}
        {errorMessage ? <Text accessibilityRole="alert" style={styles.errorBanner}>{errorMessage}</Text> : null}

        <Text style={styles.footerNote}>
          VietQR chỉ khởi tạo lệnh chuyển khoản. Việc bấm “Tôi đã chuyển khoản” không phải bằng chứng thanh toán và không tự cộng ❤️.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  copy,
  copied,
}: {
  label: string;
  value: string;
  copy?: () => void | Promise<void>;
  copied?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text selectable style={styles.infoValue}>{value}</Text>
      </View>
      {copy ? (
        <Pressable accessibilityLabel={`Sao chép ${label}`} accessibilityRole="button" onPress={() => void copy()} style={styles.copyButton}>
          <Text style={styles.copyButtonText}>{copied ? 'Đã sao chép' : 'Sao chép'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getPaymentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('heart_product_not_active')) return 'Gói ❤️ này hiện không khả dụng.';
  if (message.includes('active_adult_account_required')) return 'Tài khoản phải đang hoạt động và đủ 18 tuổi.';
  if (message.includes('vietqr_order_not_found')) return 'Không tìm thấy đơn VietQR.';
  if (message.includes('vietqr_account_not_configured')) return 'Tài khoản nhận VietQR chưa được cấu hình.';
  return 'Không thể xử lý yêu cầu VietQR. Hãy thử lại.';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  backButtonText: { color: colors.text, fontSize: 32, lineHeight: 34 },
  headingCopy: { flex: 1, gap: 5 },
  title: { color: colors.text, fontSize: 27, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  ageBadge: { minWidth: 44, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#FCE7F3' },
  ageBadgeText: { color: colors.primary, fontWeight: '900' },
  safetyCard: { borderRadius: 18, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', padding: spacing.md, gap: 5 },
  safetyTitle: { color: '#92400E', fontSize: 14, fontWeight: '900' },
  safetyText: { color: '#92400E', fontSize: 12, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  sectionMeta: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  productCard: { width: '47%', minHeight: 100, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: 7 },
  productCardSelected: { borderColor: colors.primary, backgroundColor: '#FFF1F2' },
  productHearts: { color: colors.text, fontSize: 19, fontWeight: '900' },
  productAmount: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  loadingCard: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  orderCard: { borderRadius: 24, borderWidth: 1, borderColor: '#FBCFE8', backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  orderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  orderEyebrow: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  orderTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 3 },
  statusBadge: { borderRadius: 999, backgroundColor: '#FFF1F2', paddingHorizontal: 12, paddingVertical: 8 },
  statusBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  statusPaid: { backgroundColor: '#DCFCE7' },
  statusPaidText: { color: '#166534' },
  qrImage: { width: '100%', aspectRatio: 0.84, maxHeight: 540, alignSelf: 'center', borderRadius: 18, backgroundColor: '#FFFFFF' },
  paymentSummary: { borderRadius: 16, backgroundColor: '#F8FAFC', paddingHorizontal: spacing.md },
  infoRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: 9 },
  infoCopy: { flex: 1, gap: 3 },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  copyButton: { borderRadius: 10, backgroundColor: '#FCE7F3', paddingHorizontal: 10, paddingVertical: 8 },
  copyButtonText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.primary },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  waitingCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 14, backgroundColor: '#FFF1F2', padding: spacing.md },
  waitingText: { flex: 1, color: '#9D174D', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  successCard: { borderRadius: 14, backgroundColor: '#DCFCE7', padding: spacing.md, gap: 4 },
  successTitle: { color: '#166534', fontSize: 14, fontWeight: '900' },
  successText: { color: '#166534', fontSize: 12, lineHeight: 18 },
  notice: { borderRadius: 14, backgroundColor: '#ECFDF5', color: '#166534', fontSize: 13, lineHeight: 19, padding: spacing.md },
  errorBanner: { borderRadius: 14, backgroundColor: '#FEF2F2', color: colors.danger, fontSize: 13, lineHeight: 19, padding: spacing.md },
  footerNote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
});
