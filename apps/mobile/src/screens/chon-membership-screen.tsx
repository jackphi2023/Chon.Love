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
  type LuxyMembershipPeriodCount,
  type LuxyMembershipPlanOption,
  type LuxyMembershipTier,
} from '@myfan/supabase';
import {
  chonBreakpoints,
  chonColors,
  chonInteraction,
  chonShadows,
  chonTypography,
  luxyRadii,
} from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ChonSiteFooter } from '@/components/chon-site-footer';
import {
  ChonPaymentAction,
  ChonPaymentModal,
  ChonPaymentState,
} from '@/components/chon-payment-modal';
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
  const router = useRouter();
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
    const checkout = checkoutQuery.data;
    if (!checkout || !['approved', 'rejected', 'cancelled'].includes(checkout.status)) return;
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
  const checkout = checkoutQuery.data;

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
    if (!client || !checkout) return;
    setBusy('submit');
    setNotice(null);
    setErrorMessage(null);
    try {
      await markLuxyMembershipOrderSubmitted(client, checkout.order_id);
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
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1_800);
    } catch {
      setErrorMessage('Không thể sao chép. Hãy sao chép thủ công.');
    }
  }

  const checkoutRows = checkout ? [
    {
      key: 'plan',
      label: 'Gói',
      value: `${PLAN_COPY[checkout.tier].title} · ${checkout.period_count} tháng`,
    },
    { key: 'bank', label: 'Ngân hàng', value: `${checkout.bank_name} (${checkout.bank_code})` },
    {
      key: 'account',
      label: 'Số tài khoản',
      value: checkout.account_no,
      copied: copied === 'account',
      onCopy: () => void copyValue('account', checkout.account_no),
    },
    { key: 'owner', label: 'Chủ tài khoản', value: checkout.account_name },
    {
      key: 'amount',
      label: 'Số tiền',
      value: formatLuxyMembershipAmount(checkout.amount_due_vnd),
      copied: copied === 'amount',
      onCopy: () => void copyValue('amount', String(checkout.amount_due_vnd)),
    },
    {
      key: 'content',
      label: 'Nội dung',
      value: checkout.transfer_content,
      copied: copied === 'content',
      onCopy: () => void copyValue('content', checkout.transfer_content),
    },
    ...(checkout.tier === 'diamond'
      ? [{ key: 'hearts', label: '❤️ sau khi duyệt', value: `${checkout.heart_credit_display} ❤️` }]
      : []),
  ] : [];

  return (
    <SafeAreaView style={styles.safeArea} testID="luxy-upgrade-billing">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, compact && styles.pageCompact]}>
          <View style={styles.headingBlock}>
            <Text accessibilityRole="header" style={[styles.title, desktop && styles.titleDesktop]}>
              Nâng cấp trải nghiệm của bạn
            </Text>
            <Text style={styles.subtitle}>Chọn gói phù hợp để kết nối chủ động hơn trên Chon.Love.</Text>
            <View style={styles.currentPill}>
              <Text style={styles.currentText}>
                Gói hiện tại: {currentName}
                {membershipQuery.data?.expires_at ? ` · đến ${formatDate(membershipQuery.data.expires_at)}` : ''}
              </Text>
            </View>
          </View>

          {plansQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={chonColors.primaryRed} />
              <Text style={styles.muted}>Đang tải bảng giá…</Text>
            </View>
          ) : null}
          {plansQuery.isError ? <Text accessibilityRole="alert" style={styles.error}>Không thể tải bảng giá.</Text> : null}

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
                <Text style={styles.ctaPlan}>{PLAN_COPY[selectedTier].title} · {selectedPeriod} kỳ</Text>
              </View>
              <Text style={styles.ctaAmount}>
                {selectedOption ? formatLuxyMembershipAmount(selectedOption.amount_due_vnd) : '—'}
              </Text>
            </View>
            {selectedPeriod === 3 ? <Text style={styles.discountText}>Đã áp dụng giảm 20% cho 3 tháng.</Text> : null}
            {selectedTier === 'diamond' && selectedOption ? (
              <Text style={styles.heartText}>Sau khi Admin xác nhận: +{selectedOption.heart_credit_display} ❤️ từ 80% tiền gói.</Text>
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
              {busy === 'create' ? <ActivityIndicator color={chonColors.surface} /> : <Text style={styles.primaryButtonText}>Tiếp tục thanh toán</Text>}
            </Pressable>
            {Platform.OS !== 'web' ? <Text style={styles.note}>VietQR hiện được hỗ trợ trên web.</Text> : null}
            <Text style={styles.note}>Thanh toán không tự kích hoạt. Admin phải đối soát đúng giao dịch và số tiền.</Text>
          </View>

          <CompareTable />

          {ordersQuery.data?.length ? (
            <View style={styles.section} testID="membership-order-history">
              <Text style={styles.sectionTitle}>Yêu cầu gần đây</Text>
              {ordersQuery.data.map((order) => (
                <Pressable key={order.order_id} onPress={() => setCheckoutOrderId(order.order_id)} style={styles.historyRow}>
                  <View style={styles.flexOne}>
                    <Text style={styles.historyTitle}>{PLAN_COPY[order.tier].title} · {order.period_count} kỳ</Text>
                    <Text style={styles.historyMeta}>{order.order_code} · {formatDate(order.created_at)}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyTitle}>{formatLuxyMembershipAmount(order.amount_due_vnd)}</Text>
                    <Text style={styles.historyMeta}>{getLuxyMembershipOrderStatusLabel(order.status)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {errorMessage ? <Text accessibilityRole="alert" style={styles.errorBanner}>{errorMessage}</Text> : null}
        </View>
        <ChonSiteFooter
          compact={!desktop}
          onCommunity={() => router.push('/legal/community-standards')}
          onTerms={() => router.push('/legal/terms')}
          testID="chon-membership-footer"
        />
      </ScrollView>

      <ChonPaymentModal
        eyebrow={checkout?.order_code ?? null}
        error={checkoutQuery.isError ? 'Không thể tải chi tiết thanh toán.' : null}
        footerNote="Admin là đường duy nhất kích hoạt Premium/Diamond; xác nhận của thành viên không tự cấp quyền hoặc tự cộng ❤️."
        loading={Boolean(checkoutOrderId) && checkoutQuery.isLoading}
        onClose={() => {
          setCheckoutOrderId(null);
          setNotice(null);
          setErrorMessage(null);
        }}
        qrAccessibilityLabel="Mã VietQR thanh toán gói thành viên"
        qrImageUrl={checkout?.status === 'awaiting_payment' ? checkout.qr_image_url : null}
        rows={checkoutRows}
        status={checkout ? getLuxyMembershipOrderStatusLabel(checkout.status) : null}
        testID="membership-payment-modal"
        title={checkout ? `Thanh toán ${PLAN_COPY[checkout.tier].title}` : 'Thanh toán gói thành viên'}
        visible={Boolean(checkoutOrderId) || checkoutQuery.isLoading || checkoutQuery.isError}
      >
        {checkout?.status === 'awaiting_payment' ? (
          <>
            <Text style={styles.note}>Chuyển đúng số tiền và giữ nguyên nội dung.</Text>
            <ChonPaymentAction
              disabled={busy !== null}
              label="Tôi đã chuyển khoản"
              loading={busy === 'submit'}
              onPress={() => void submitTransfer()}
              testID="membership-transfer-submitted"
            />
            <ChonPaymentAction
              disabled={busy !== null}
              label={busy === 'cancel' ? 'Đang hủy…' : 'Hủy yêu cầu'}
              onPress={() => void cancelCheckout()}
              secondary
            />
          </>
        ) : null}
        {checkout?.status === 'awaiting_confirmation' ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={chonColors.primaryRed} />
            <Text style={styles.muted}>Đang chờ Admin đối soát. Tự kiểm tra lại mỗi 10 giây.</Text>
          </View>
        ) : null}
        {checkout?.status === 'approved' ? (
          <ChonPaymentState success text="Quyền thành viên đã cập nhật theo thời hạn được duyệt." title="Gói đã được kích hoạt" />
        ) : null}
        {checkout?.status === 'rejected' ? (
          <ChonPaymentState text="Vui lòng liên hệ hỗ trợ nếu bạn đã chuyển khoản." title="Giao dịch chưa được xác nhận" />
        ) : null}
        {checkout?.status === 'cancelled' ? (
          <ChonPaymentState text="Bạn có thể tạo một yêu cầu mới." title="Yêu cầu đã hủy" />
        ) : null}
        {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      </ChonPaymentModal>
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
        {copy.features.map((feature) => <Text key={feature} style={styles.feature}>✓ {feature}</Text>)}
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
              style={({ pressed }) => [styles.planOption, selected && styles.planOptionSelected, pressed && styles.pressed]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              <View style={styles.flexOne}>
                <Text style={styles.optionTitle}>{period} tháng{period === 3 ? ' · GIẢM 20%' : ''}</Text>
                {tier === 'diamond' ? <Text style={styles.optionHeart}>+ {option.heart_credit_display} ❤️ sau khi duyệt</Text> : null}
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
  title: { color: chonColors.goldStrong, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, lineHeight: chonTypography.lineHeights.h2, textAlign: 'center' },
  titleDesktop: { fontSize: chonTypography.sizes.h1Desktop, lineHeight: chonTypography.lineHeights.h1Desktop },
  subtitle: { color: chonColors.muted, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, marginTop: 8, maxWidth: 470, textAlign: 'center' },
  currentPill: { backgroundColor: chonColors.warmSurface, borderColor: chonColors.gold, borderRadius: luxyRadii.pill, borderWidth: 1, marginTop: 14, paddingHorizontal: 14, paddingVertical: 7 },
  currentText: { color: chonColors.text, fontSize: 12, fontWeight: '600' },
  planSection: { alignItems: 'center', borderBottomColor: chonColors.border, borderBottomWidth: 1, marginBottom: 30, paddingBottom: 30 },
  certificateStage: { height: 91, marginBottom: 10, position: 'relative', width: 132 },
  certificateStageDesktop: { height: 110, width: 160 },
  eyebrow: { color: chonColors.goldStrong, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  planTitle: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, lineHeight: chonTypography.lineHeights.h2, marginTop: 2 },
  planDescription: { color: chonColors.muted, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, marginTop: 8, textAlign: 'center' },
  features: { alignSelf: 'stretch', gap: 5, marginTop: 14 },
  feature: { color: chonColors.text, fontSize: 12, lineHeight: 18 },
  planOptions: { alignSelf: 'stretch', gap: 10, marginTop: 18 },
  planOption: { alignItems: 'center', backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 76, padding: 13 },
  planOptionSelected: { backgroundColor: chonColors.warmSurfaceStrong, borderColor: chonColors.gold, borderWidth: 1.5, ...chonShadows.card },
  radio: { alignItems: 'center', borderColor: chonColors.borderStrong, borderRadius: 99, borderWidth: 1.5, height: 20, justifyContent: 'center', width: 20 },
  radioSelected: { borderColor: chonColors.primaryRed },
  radioDot: { backgroundColor: chonColors.primaryRed, borderRadius: 99, height: 10, width: 10 },
  optionTitle: { color: chonColors.text, fontSize: 13, fontWeight: '700' },
  optionHeart: { color: chonColors.goldStrong, fontSize: 11, fontWeight: '600', marginTop: 4 },
  optionAmount: { color: chonColors.text, fontSize: 13, fontWeight: '800' },
  ctaCard: { backgroundColor: chonColors.warmSurface, borderColor: chonColors.gold, borderRadius: 12, borderWidth: 1, gap: 10, marginBottom: 30, padding: 16, ...chonShadows.card },
  rowBetween: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  flexOne: { flex: 1, minWidth: 0 },
  ctaPlan: { color: chonColors.text, fontSize: 16, fontWeight: '800', marginTop: 3 },
  ctaAmount: { color: chonColors.primaryRed, fontSize: 16, fontWeight: '900' },
  discountText: { color: chonColors.goldStrong, fontSize: 11.5, fontWeight: '600' },
  heartText: { color: chonColors.goldStrong, fontSize: 11.5, fontWeight: '600' },
  primaryButton: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 48, paddingHorizontal: 22, ...chonShadows.primary },
  primaryButtonPressed: { backgroundColor: chonColors.primaryRedHover, opacity: chonInteraction.pressedOpacity },
  primaryButtonText: { color: chonColors.surface, fontSize: 14, fontWeight: '800' },
  note: { color: chonColors.muted, fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
  section: { marginBottom: 30 },
  sectionTitle: { color: chonColors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  compareHeader: { backgroundColor: chonColors.warmSurface, borderColor: chonColors.border, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, flexDirection: 'row', padding: 10 },
  compareRow: { borderBottomColor: chonColors.border, borderBottomWidth: 1, borderLeftColor: chonColors.border, borderLeftWidth: 1, borderRightColor: chonColors.border, borderRightWidth: 1, flexDirection: 'row', padding: 10 },
  compareFeature: { color: chonColors.text, flex: 1.45, fontSize: 11.5 },
  compareValueHead: { color: chonColors.goldStrong, flex: 0.8, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  compareValue: { color: chonColors.muted, flex: 0.8, fontSize: 11, textAlign: 'center' },
  historyRow: { alignItems: 'center', borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, minHeight: 64, paddingVertical: 8 },
  historyRight: { alignItems: 'flex-end' },
  historyTitle: { color: chonColors.text, fontSize: 12.5, fontWeight: '700' },
  historyMeta: { color: chonColors.muted, fontSize: 10.5, marginTop: 2 },
  loading: { alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 100 },
  muted: { color: chonColors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  error: { color: chonColors.danger, fontSize: 12, textAlign: 'center' },
  errorBanner: { color: chonColors.danger, fontSize: 12, marginBottom: 20, textAlign: 'center' },
  waiting: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', paddingVertical: 6 },
  notice: { color: chonColors.goldStrong, fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: chonInteraction.pressedOpacity },
});
