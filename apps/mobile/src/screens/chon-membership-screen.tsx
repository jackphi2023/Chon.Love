import {
  cancelLuxyMembershipOrder,
  createLuxyMembershipOrder,
  formatLuxyMembershipAmount,
  getLuxyMembershipOrderStatusLabel,
  getLuxyMembershipPlanOptions,
  getMyLuxyMembershipCheckout,
  getMyLuxyMembershipSnapshot,
  listMyLuxyMembershipOrders,
  luxyMembershipQueryKeys,
  markLuxyMembershipOrderSubmitted,
  type LuxyMembershipCheckout,
  type LuxyMembershipPeriodCount,
  type LuxyMembershipPlanOption,
  type LuxyMembershipTier,
} from '@myfan/supabase';
import {
  chonBreakpoints,
  chonColors,
  chonShadows,
  chonTypography,
  luxyRadii,
} from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { ChonMembershipBadge } from '@/components/chon-membership-badge';
import { LuxyModalLayer } from '@/components/luxy-modal-layer';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type PaidTier = Exclude<LuxyMembershipTier, 'free'>;
type BusyAction = 'create' | 'submit' | 'cancel' | null;

type PlanCopy = {
  title: string;
  eyebrow: string;
  description: string;
  features: string[];
};

const PLAN_COPY: Record<PaidTier, PlanCopy> = {
  premium: {
    title: 'Premium',
    eyebrow: 'CAO CẤP',
    description:
      'Mở toàn bộ trải nghiệm kết nối, quyền riêng tư, đồng thời giúp đối phương nhận biết bạn là thành viên có năng lực tài chính và nghiêm túc trong việc xây dựng mối quan hệ.',
    features: [
      'Tìm kiếm và lọc đầy đủ',
      'Thích không giới hạn',
      'Tin nhắn không giới hạn',
      'Ưu tiên hơn thành viên Free',
      'Ẩn trạng thái online',
    ],
  },
  diamond: {
    title: 'Diamond',
    eyebrow: 'KIM CƯƠNG',
    description:
      'Quyền lợi cao hơn Premium, đồng thời giúp đối phương nhận biết bạn là thành viên có năng lực tài chính cao, có giá trị và sẵn sàng chủ động tặng quà để thể hiện sự quan tâm.',
    features: [
      'Toàn bộ quyền lợi Premium',
      'Ưu tiên hiển thị cao nhất',
      'Ẩn khỏi danh sách thành viên',
      '80% tiền gói quy đổi sang ❤️',
      'Huy hiệu Diamond',
    ],
  },
};

const COMPARE_ROWS = [
  ['Tạo và xem hồ sơ', 'Có', 'Có'],
  ['Lọc tìm kiếm đầy đủ', 'Có', 'Có'],
  ['Thích không giới hạn', 'Có', 'Có'],
  ['Tin nhắn không giới hạn', 'Có', 'Có'],
  ['Ưu tiên hiển thị', 'Cao hơn Free', 'Cao nhất'],
  ['Ẩn trạng thái online', 'Có', 'Có'],
  ['Ẩn khỏi danh sách', '—', 'Có'],
  ['Số dư ❤️ từ tiền gói', '—', '80%'],
] as const;

export function ChonMembershipScreen() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const desktop = width >= chonBreakpoints.desktop;
  const compact = width < 560;

  const [selectedTier, setSelectedTier] = useState<PaidTier>('premium');
  const [selectedPeriod, setSelectedPeriod] = useState<LuxyMembershipPeriodCount>(1);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const membershipQuery = useQuery({
    queryKey: luxyMembershipQueryKeys.snapshot(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyLuxyMembershipSnapshot(client);
    },
  });

  const plansQuery = useQuery({
    queryKey: luxyMembershipQueryKeys.plans,
    enabled: Boolean(client && auth.userId),
    staleTime: 300_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getLuxyMembershipPlanOptions(client);
    },
  });

  const ordersQuery = useQuery({
    queryKey: luxyMembershipQueryKeys.orders(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 10_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listMyLuxyMembershipOrders(client, { limit: 6 });
    },
  });

  const checkoutQuery = useQuery({
    queryKey: luxyMembershipQueryKeys.checkout(checkoutOrderId),
    enabled: Boolean(client && checkoutOrderId),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client || !checkoutOrderId) throw new Error('membership_order_not_found');
      return getMyLuxyMembershipCheckout(client, checkoutOrderId);
    },
  });

  useEffect(() => {
    if (!checkoutQuery.data) return;
    if (!['approved', 'rejected', 'cancelled'].includes(checkoutQuery.data.status)) return;

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.snapshot(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) }),
    ]);
  }, [auth.userId, checkoutQuery.data, queryClient]);

  const currentTier = membershipQuery.data?.tier ?? 'free';
  const currentName = currentTier === 'free' ? 'Free' : PLAN_COPY[currentTier].title;
  const selectedOption = plansQuery.data?.find(
    (option) => option.tier === selectedTier && option.period_count === selectedPeriod,
  );

  async function startCheckout() {
    if (!client || !selectedOption || Platform.OS !== 'web') return;
    setBusy('create');
    setNotice(null);
    setErrorMessage(null);
    try {
      const order = await createLuxyMembershipOrder(
        client,
        selectedTier,
        selectedPeriod,
        createRequestId(),
        'upgrade_billing_web',
      );
      setCheckoutOrderId(order.order_id);
      await queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) });
    } catch (error) {
      setErrorMessage(errorCopy(error));
    } finally {
      setBusy(null);
    }
  }

  async function submitTransfer() {
    if (!client || !checkoutQuery.data) return;
    setBusy('submit');
    setNotice(null);
    setErrorMessage(null);
    try {
      await markLuxyMembershipOrderSubmitted(client, checkoutQuery.data.order_id);
      await checkoutQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) });
      setNotice('Đã ghi nhận. Admin sẽ đối soát giao dịch trước khi kích hoạt gói.');
    } catch (error) {
      setErrorMessage(errorCopy(error));
    } finally {
      setBusy(null);
    }
  }

  async function cancelCheckout() {
    const checkout = checkoutQuery.data;
    if (!client || !checkout || checkout.status !== 'awaiting_payment') return;
    setBusy('cancel');
    setErrorMessage(null);
    try {
      await cancelLuxyMembershipOrder(client, checkout.order_id);
      await checkoutQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) });
    } catch (error) {
      setErrorMessage(errorCopy(error));
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
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
    } catch {
      setErrorMessage('Không thể sao chép. Hãy sao chép thủ công.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} testID="luxy-upgrade-billing">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, compact && styles.pageCompact]}>
          <View style={styles.headingBlock}>
            <Text accessibilityRole="header" style={[styles.title, desktop && styles.titleDesktop]}>
              Nâng cấp trải nghiệm của bạn
            </Text>
            <Text style={styles.subtitle}>
              Chọn gói phù hợp để kết nối chủ động hơn trên Chon.Love.
            </Text>
            <View style={styles.currentPill}>
              <Text style={styles.currentText}>
                Gói hiện tại: {currentName}
                {membershipQuery.data?.expires_at ? ` · đến ${formatDate(membershipQuery.data.expires_at)}` : ''}
              </Text>
            </View>
          </View>

          {plansQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={chonColors.ink} />
              <Text style={styles.muted}>Đang tải bảng giá…</Text>
            </View>
          ) : null}
          {plansQuery.isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              Không thể tải bảng giá.
            </Text>
          ) : null}

          {(plansQuery.data ?? []).length ? (
            <>
              <PlanSection
                desktop={desktop}
                onSelect={(period) => {
                  setSelectedTier('premium');
                  setSelectedPeriod(period);
                }}
                options={plansQuery.data ?? []}
                selectedPeriod={selectedTier === 'premium' ? selectedPeriod : null}
                tier="premium"
              />
              <PlanSection
                desktop={desktop}
                onSelect={(period) => {
                  setSelectedTier('diamond');
                  setSelectedPeriod(period);
                }}
                options={plansQuery.data ?? []}
                selectedPeriod={selectedTier === 'diamond' ? selectedPeriod : null}
                tier="diamond"
              />
            </>
          ) : null}

          <View style={styles.ctaCard} testID="membership-selection-summary">
            <View style={styles.rowBetween}>
              <View style={styles.flexOne}>
                <Text style={styles.eyebrow}>BẠN ĐÃ CHỌN</Text>
                <Text style={styles.ctaPlan}>
                  {PLAN_COPY[selectedTier].title} · {selectedPeriod} kỳ
                </Text>
              </View>
              <Text style={styles.ctaAmount}>
                {selectedOption ? formatLuxyMembershipAmount(selectedOption.amount_due_vnd) : '—'}
              </Text>
            </View>
            {selectedPeriod === 3 ? (
              <Text style={styles.discountText}>Đã áp dụng giảm 20% cho 3 kỳ.</Text>
            ) : null}
            {selectedTier === 'diamond' && selectedOption ? (
              <Text style={styles.heartText}>
                Sau khi Admin xác nhận: +{selectedOption.heart_credit_display} ❤️ từ 80% tiền gói.
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!selectedOption || busy !== null || Platform.OS !== 'web'}
              onPress={() => void startCheckout()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                (!selectedOption || busy !== null || Platform.OS !== 'web') && styles.disabled,
              ]}
              testID="membership-checkout-cta"
            >
              {busy === 'create' ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Tiếp tục thanh toán</Text>
              )}
            </Pressable>
            {Platform.OS !== 'web' ? (
              <Text style={styles.note}>
                VietQR chỉ mở trên web. Thanh toán Google Play chưa được hỗ trợ trong phiên bản này.
              </Text>
            ) : null}
            <Text style={styles.note}>
              Thanh toán không tự kích hoạt. Admin phải đối soát đúng giao dịch và số tiền.
            </Text>
          </View>

          <CompareTable />

          {ordersQuery.data?.length ? (
            <View style={styles.section} testID="membership-order-history">
              <Text style={styles.sectionTitle}>Yêu cầu gần đây</Text>
              {ordersQuery.data.map((order) => (
                <Pressable
                  key={order.order_id}
                  onPress={() => setCheckoutOrderId(order.order_id)}
                  style={styles.historyRow}
                >
                  <View style={styles.flexOne}>
                    <Text style={styles.historyTitle}>
                      {PLAN_COPY[order.tier].title} · {order.period_count} kỳ
                    </Text>
                    <Text style={styles.historyMeta}>
                      {order.order_code} · {formatDate(order.created_at)}
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyTitle}>
                      {formatLuxyMembershipAmount(order.amount_due_vnd)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {getLuxyMembershipOrderStatusLabel(order.status)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorBanner}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <CheckoutModal
        busy={busy}
        checkout={checkoutQuery.data}
        copied={copied}
        error={checkoutQuery.isError ? 'Không thể tải chi tiết thanh toán.' : null}
        loading={Boolean(checkoutOrderId) && checkoutQuery.isLoading}
        notice={notice}
        onCancel={() => void cancelCheckout()}
        onClose={() => {
          setCheckoutOrderId(null);
          setNotice(null);
          setErrorMessage(null);
        }}
        onCopy={(key, value) => void copyValue(key, value)}
        onSubmit={() => void submitTransfer()}
      />
    </SafeAreaView>
  );
}

function PlanSection({
  tier,
  options,
  selectedPeriod,
  onSelect,
  desktop,
}: {
  tier: PaidTier;
  options: LuxyMembershipPlanOption[];
  selectedPeriod: LuxyMembershipPeriodCount | null;
  onSelect: (period: LuxyMembershipPeriodCount) => void;
  desktop: boolean;
}) {
  const copy = PLAN_COPY[tier];

  return (
    <View style={styles.planSection} testID={`plan-${tier}`}>
      <View style={[styles.certificateStage, desktop && styles.certificateStageDesktop]}>
        <ChonMembershipBadge desktop={desktop} inset={0} tier={tier} variant="certificate" />
      </View>
      <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
      <Text style={styles.planTitle}>{copy.title}</Text>
      <Text style={styles.planDescription}>{copy.description}</Text>
      <View style={styles.features}>
        {copy.features.map((feature) => (
          <Text key={feature} style={styles.feature}>
            ✓ {feature}
          </Text>
        ))}
      </View>
      <View style={styles.planOptions}>
        {([1, 3] as LuxyMembershipPeriodCount[]).map((period) => {
          const option = options.find((row) => row.tier === tier && row.period_count === period);
          if (!option) return null;
          const selected = selectedPeriod === period;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={period}
              onPress={() => onSelect(period)}
              style={({ pressed }) => [
                styles.planOption,
                selected && styles.planOptionSelected,
                pressed && styles.planOptionPressed,
              ]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.flexOne}>
                <View style={styles.optionTitleRow}>
                  <Text style={styles.optionTitle}>{period} kỳ</Text>
                  {period === 3 ? <Text style={styles.discountBadge}>GIẢM 20%</Text> : null}
                </View>
                <Text style={styles.optionMeta}>
                  {formatLuxyMembershipAmount(Math.round(option.amount_due_vnd / period))} / tháng
                </Text>
                {tier === 'diamond' ? (
                  <Text style={styles.optionHeart}>+ {option.heart_credit_display} ❤️ sau khi duyệt</Text>
                ) : null}
              </View>
              <Text style={styles.optionAmount}>{formatLuxyMembershipAmount(option.amount_due_vnd)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CompareTable() {
  return (
    <View style={styles.section} testID="membership-compare-table">
      <Text style={styles.sectionTitle}>So sánh quyền lợi</Text>
      <View style={styles.compareHeader}>
        <Text style={styles.compareFeature}>Quyền lợi</Text>
        <Text style={styles.compareValueHead}>Premium</Text>
        <Text style={styles.compareValueHead}>Diamond</Text>
      </View>
      {COMPARE_ROWS.map(([label, premium, diamond]) => (
        <View key={label} style={styles.compareRow}>
          <Text style={styles.compareFeature}>{label}</Text>
          <Text style={styles.compareValue}>{premium}</Text>
          <Text style={styles.compareValue}>{diamond}</Text>
        </View>
      ))}
    </View>
  );
}

function CheckoutModal({
  checkout,
  loading,
  error,
  busy,
  notice,
  copied,
  onCopy,
  onSubmit,
  onCancel,
  onClose,
}: {
  checkout: LuxyMembershipCheckout | undefined;
  loading: boolean;
  error: string | null;
  busy: BusyAction;
  notice: string | null;
  copied: string | null;
  onCopy: (key: string, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const visible = loading || Boolean(checkout) || Boolean(error);
  if (!visible) return null;

  return (
    <LuxyModalLayer onRequestClose={onClose} visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <Pressable accessibilityLabel="Đóng" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={chonColors.ink} />
              <Text style={styles.muted}>Đang tạo thông tin thanh toán…</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {checkout ? (
            <ScrollView contentContainerStyle={styles.checkoutContent}>
              <Text style={[styles.eyebrow, styles.centerText]}>{checkout.order_code}</Text>
              <Text style={styles.checkoutTitle}>Thanh toán {PLAN_COPY[checkout.tier].title}</Text>
              <Text style={styles.checkoutStatus}>
                {getLuxyMembershipOrderStatusLabel(checkout.status)}
              </Text>
              {checkout.status === 'awaiting_payment' ? (
                <Image
                  accessibilityLabel="Mã VietQR thanh toán gói thành viên"
                  resizeMode="contain"
                  source={{ uri: checkout.qr_image_url }}
                  style={styles.qrImage}
                />
              ) : null}
              <View style={styles.checkoutSummary}>
                <CheckoutRow
                  label="Gói"
                  value={`${PLAN_COPY[checkout.tier].title} · ${checkout.period_count} kỳ`}
                />
                <CheckoutRow label="Ngân hàng" value={`${checkout.bank_name} (${checkout.bank_code})`} />
                <CheckoutRow
                  copied={copied === 'account'}
                  label="Số tài khoản"
                  onCopy={() => onCopy('account', checkout.account_no)}
                  value={checkout.account_no}
                />
                <CheckoutRow label="Chủ tài khoản" value={checkout.account_name} />
                <CheckoutRow
                  copied={copied === 'amount'}
                  label="Số tiền"
                  onCopy={() => onCopy('amount', String(checkout.amount_due_vnd))}
                  value={formatLuxyMembershipAmount(checkout.amount_due_vnd)}
                />
                <CheckoutRow
                  copied={copied === 'content'}
                  label="Nội dung"
                  onCopy={() => onCopy('content', checkout.transfer_content)}
                  value={checkout.transfer_content}
                />
                {checkout.tier === 'diamond' ? (
                  <CheckoutRow label="❤️ sau khi duyệt" value={`${checkout.heart_credit_display} ❤️`} />
                ) : null}
              </View>
              {checkout.status === 'awaiting_payment' ? (
                <>
                  <Text style={styles.note}>Chuyển đúng số tiền và giữ nguyên nội dung.</Text>
                  <Pressable
                    disabled={busy !== null}
                    onPress={onSubmit}
                    style={[styles.primaryButton, busy !== null && styles.disabled]}
                  >
                    {busy === 'submit' ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Tôi đã chuyển khoản</Text>
                    )}
                  </Pressable>
                  <Pressable disabled={busy !== null} onPress={onCancel} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>
                      {busy === 'cancel' ? 'Đang hủy…' : 'Hủy yêu cầu'}
                    </Text>
                  </Pressable>
                </>
              ) : null}
              {checkout.status === 'awaiting_confirmation' ? (
                <View style={styles.waiting}>
                  <ActivityIndicator color={chonColors.ink} />
                  <Text style={styles.muted}>
                    Đang chờ Admin đối soát. Tự kiểm tra lại mỗi 10 giây; chưa kích hoạt gói.
                  </Text>
                </View>
              ) : null}
              {checkout.status === 'approved' ? (
                <StateBox
                  success
                  text="Quyền thành viên đã cập nhật theo thời hạn được duyệt."
                  title="Gói đã được kích hoạt"
                />
              ) : null}
              {checkout.status === 'rejected' ? (
                <StateBox
                  text="Vui lòng liên hệ hỗ trợ nếu bạn đã chuyển khoản."
                  title="Giao dịch chưa được xác nhận"
                />
              ) : null}
              {checkout.status === 'cancelled' ? (
                <StateBox text="Bạn có thể tạo một yêu cầu mới." title="Yêu cầu đã hủy" />
              ) : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <Text style={styles.footnote}>
                Admin là đường duy nhất kích hoạt Premium/Diamond. Nút xác nhận của thành viên không tự cấp quyền và không tự cộng ❤️.
              </Text>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </LuxyModalLayer>
  );
}

function CheckoutRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <View style={styles.checkoutRow}>
      <View style={styles.flexOne}>
        <Text style={styles.checkoutLabel}>{label}</Text>
        <Text selectable style={styles.checkoutValue}>{value}</Text>
      </View>
      {onCopy ? (
        <Pressable onPress={onCopy} style={styles.copyButton}>
          <Text style={styles.copyText}>{copied ? 'Đã chép' : 'Sao chép'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StateBox({ title, text, success = false }: { title: string; text: string; success?: boolean }) {
  return (
    <View style={[styles.stateBox, success && styles.stateSuccess]}>
      <Text style={styles.historyTitle}>{title}</Text>
      <Text style={styles.historyMeta}>{text}</Text>
    </View>
  );
}

function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 3) | 8).toString(16);
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
}

function errorCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('active_adult_account_required')) return 'Tài khoản phải đang hoạt động và đủ 18 tuổi.';
  if (message.includes('membership_vietqr_disabled')) return 'Thanh toán VietQR cho gói thành viên hiện đang tạm khóa.';
  if (message.includes('vietqr_account_not_configured')) return 'Tài khoản nhận VietQR chưa được cấu hình.';
  if (message.includes('membership_order_not_found')) return 'Không tìm thấy yêu cầu thanh toán này.';
  return 'Không thể xử lý yêu cầu thanh toán. Vui lòng thử lại.';
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: chonColors.surface, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 72 },
  page: { alignSelf: 'center', maxWidth: 600, paddingHorizontal: 20, width: '100%' },
  pageCompact: { paddingHorizontal: 16 },
  headingBlock: { alignItems: 'center', paddingBottom: 30, paddingTop: 32 },
  title: {
    color: chonColors.goldStrong,
    fontFamily: chonTypography.families.display,
    fontSize: chonTypography.sizes.h2,
    lineHeight: chonTypography.lineHeights.h2,
    textAlign: 'center',
  },
  titleDesktop: { fontSize: chonTypography.sizes.h1Desktop, lineHeight: chonTypography.lineHeights.h1Desktop },
  subtitle: {
    color: chonColors.muted,
    fontSize: chonTypography.sizes.body,
    lineHeight: chonTypography.lineHeights.body,
    marginTop: 8,
    maxWidth: 470,
    textAlign: 'center',
  },
  currentPill: {
    backgroundColor: chonColors.warmSurface,
    borderColor: chonColors.gold,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  currentText: { color: chonColors.text, fontSize: 12, fontWeight: '600' },
  planSection: {
    alignItems: 'center',
    borderBottomColor: chonColors.border,
    borderBottomWidth: 1,
    marginBottom: 30,
    paddingBottom: 30,
  },
  certificateStage: { height: 91, marginBottom: 10, position: 'relative', width: 132 },
  certificateStageDesktop: { height: 110, width: 160 },
  eyebrow: { color: chonColors.goldStrong, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  planTitle: {
    color: chonColors.text,
    fontFamily: chonTypography.families.display,
    fontSize: chonTypography.sizes.h2,
    lineHeight: chonTypography.lineHeights.h2,
    marginTop: 2,
  },
  planDescription: {
    color: chonColors.muted,
    fontSize: chonTypography.sizes.body,
    lineHeight: chonTypography.lineHeights.body,
    marginTop: 8,
    textAlign: 'center',
  },
  features: { alignSelf: 'stretch', gap: 5, marginTop: 14 },
  feature: { color: chonColors.text, fontSize: 12, lineHeight: 18 },
  planOptions: { alignSelf: 'stretch', gap: 10, marginTop: 18 },
  planOption: {
    alignItems: 'center',
    backgroundColor: chonColors.surface,
    borderColor: chonColors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    padding: 13,
  },
  planOptionSelected: {
    backgroundColor: chonColors.warmSurfaceStrong,
    borderColor: chonColors.gold,
    borderWidth: 1.5,
  },
  planOptionPressed: { opacity: 0.82 },
  radio: {
    alignItems: 'center',
    borderColor: chonColors.softMuted,
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioSelected: { borderColor: chonColors.primaryRed },
  radioDot: { backgroundColor: chonColors.primaryRed, borderRadius: 5, height: 10, width: 10 },
  optionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  optionTitle: { color: chonColors.text, fontSize: 14, fontWeight: '700' },
  discountBadge: {
    backgroundColor: chonColors.primaryRed,
    borderRadius: 3,
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  optionMeta: { color: chonColors.muted, fontSize: 11, marginTop: 3 },
  optionHeart: { color: chonColors.text, fontSize: 11, fontWeight: '600', marginTop: 4 },
  optionAmount: { color: chonColors.text, fontSize: 14, fontWeight: '700' },
  ctaCard: {
    backgroundColor: chonColors.surface,
    borderColor: chonColors.gold,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 34,
    padding: 18,
    ...chonShadows.card,
  },
  rowBetween: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  flexOne: { flex: 1 },
  ctaPlan: { color: chonColors.text, fontSize: 16, fontWeight: '700', marginTop: 3 },
  ctaAmount: { color: chonColors.text, fontSize: 18, fontWeight: '700' },
  discountText: { color: chonColors.primaryRed, fontSize: 12, fontWeight: '700', marginTop: 10 },
  heartText: { color: chonColors.text, fontSize: 12, marginTop: 7 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: chonColors.primaryRed,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  primaryButtonPressed: { backgroundColor: chonColors.primaryRedHover, ...chonShadows.primaryHover },
  primaryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: chonColors.surface,
    borderColor: chonColors.gold,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 13,
    minHeight: 46,
    paddingHorizontal: 18,
  },
  secondaryButtonText: { color: chonColors.text, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  note: { color: chonColors.muted, fontSize: 11, lineHeight: 17, marginTop: 10, textAlign: 'center' },
  section: { marginBottom: 34 },
  sectionTitle: {
    color: chonColors.text,
    fontFamily: chonTypography.families.display,
    fontSize: chonTypography.sizes.h3,
    lineHeight: chonTypography.lineHeights.h3,
    marginBottom: 14,
  },
  compareHeader: {
    backgroundColor: chonColors.warmSurface,
    borderBottomColor: chonColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 46,
    paddingHorizontal: 8,
  },
  compareRow: {
    borderBottomColor: chonColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 8,
  },
  compareFeature: { alignSelf: 'center', color: chonColors.text, flex: 1.35, fontSize: 11.5 },
  compareValueHead: {
    alignSelf: 'center',
    color: chonColors.text,
    flex: 0.8,
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  compareValue: { alignSelf: 'center', color: chonColors.text, flex: 0.8, fontSize: 11, textAlign: 'center' },
  historyRow: {
    alignItems: 'center',
    borderBottomColor: chonColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 70,
    paddingVertical: 9,
  },
  historyRight: { alignItems: 'flex-end' },
  historyTitle: { color: chonColors.text, fontSize: 13, fontWeight: '700' },
  historyMeta: { color: chonColors.muted, fontSize: 10.5, lineHeight: 16, marginTop: 3 },
  loading: { alignItems: 'center', gap: 10, justifyContent: 'center', minHeight: 120 },
  muted: { color: chonColors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  error: { color: chonColors.danger, fontSize: 12, padding: 14, textAlign: 'center' },
  errorBanner: {
    backgroundColor: '#FFF4F4',
    borderColor: '#F3B4B4',
    borderWidth: 1,
    color: chonColors.danger,
    fontSize: 12,
    marginBottom: 24,
    padding: 12,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: chonColors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: chonColors.surface,
    borderRadius: 8,
    maxHeight: '92%',
    maxWidth: 466,
    minHeight: 240,
    position: 'relative',
    width: '100%',
    ...chonShadows.card,
  },
  close: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 4,
    width: 44,
    zIndex: 10,
  },
  closeText: { color: chonColors.ink, fontSize: 28, fontWeight: '300' },
  checkoutContent: { padding: 26, paddingTop: 34 },
  checkoutTitle: {
    color: chonColors.text,
    fontFamily: chonTypography.families.display,
    fontSize: 27,
    textAlign: 'center',
  },
  checkoutStatus: { color: chonColors.muted, fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  qrImage: { alignSelf: 'center', height: 248, marginVertical: 14, width: 248 },
  checkoutSummary: { borderTopColor: chonColors.border, borderTopWidth: 1, marginTop: 8 },
  checkoutRow: {
    alignItems: 'center',
    borderBottomColor: chonColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 55,
    paddingVertical: 8,
  },
  checkoutLabel: { color: chonColors.muted, fontSize: 10.5 },
  checkoutValue: { color: chonColors.text, fontSize: 13, fontWeight: '600', marginTop: 2 },
  copyButton: { borderColor: chonColors.border, borderRadius: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  copyText: { color: chonColors.ink, fontSize: 10.5, fontWeight: '700' },
  waiting: { alignItems: 'center', backgroundColor: chonColors.warmSurface, gap: 9, marginTop: 16, padding: 16 },
  stateBox: { backgroundColor: '#FFFBEB', borderColor: chonColors.gold, borderWidth: 1, marginTop: 16, padding: 14 },
  stateSuccess: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  notice: { color: chonColors.text, fontSize: 11.5, marginTop: 12, textAlign: 'center' },
  footnote: { color: chonColors.muted, fontSize: 10.5, lineHeight: 16, marginTop: 14, textAlign: 'center' },
  centerText: { textAlign: 'center' },
});
