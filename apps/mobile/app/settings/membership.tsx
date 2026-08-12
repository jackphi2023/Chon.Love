import {
  cancelLuxyMembershipOrder,
  createLuxyMembershipOrder,
  formatLuxyHeartBalance,
  formatLuxyMembershipAmount,
  getLuxyMembershipOrderStatusLabel,
  getLuxyMembershipPlanOptions,
  getMyLuxyMembershipCheckout,
  getMyLuxyMembershipPrivacy,
  getMyLuxyMembershipSnapshot,
  listMyLuxyMembershipOrders,
  luxyMembershipQueryKeys,
  markLuxyMembershipOrderSubmitted,
  updateMyLuxyMembershipPrivacy,
  type LuxyMembershipCheckout,
  type LuxyMembershipPeriodCount,
  type LuxyMembershipTier,
} from '@myfan/supabase';
import {
  luxyBrand,
  luxyColors,
  luxyRadii,
  luxyShadows,
  luxySpacing,
  luxyTypography,
} from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type PaidTier = Exclude<LuxyMembershipTier, 'free'>;
type BillingTab = 'membership' | 'one_time';

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
    description: 'Mở toàn bộ trải nghiệm kết nối và quyền riêng tư cần thiết để chủ động tìm kiếm.',
    features: [
      'Tìm kiếm & lọc đầy đủ',
      'Thích không giới hạn',
      'Gửi / xem tin nhắn không giới hạn',
      'Ưu tiên hiển thị cao hơn Free',
      'Ẩn trạng thái online',
    ],
  },
  diamond: {
    title: 'Diamond',
    eyebrow: 'KIM CƯƠNG',
    description: 'Quyền truy cập cao nhất, ưu tiên đầu danh sách và số dư ❤️ để tặng quà.',
    features: [
      'Toàn bộ quyền Premium',
      'Ưu tiên đầu danh sách thành viên',
      'Ẩn khỏi Search / danh sách',
      '80% tiền gói quy đổi sang ❤️',
      'Huy hiệu Diamond',
    ],
  },
};

const COMPARE_ROWS = [
  { label: 'Tạo & xem hồ sơ', premium: 'Có', diamond: 'Có' },
  { label: 'Lọc tìm kiếm đầy đủ', premium: 'Có', diamond: 'Có' },
  { label: 'Thích không giới hạn', premium: 'Có', diamond: 'Có' },
  { label: 'Tin nhắn không giới hạn', premium: 'Có', diamond: 'Có' },
  { label: 'Ưu tiên hiển thị', premium: 'Cao hơn Free', diamond: 'Cao nhất' },
  { label: 'Ẩn trạng thái online', premium: 'Có', diamond: 'Có' },
  { label: 'Ẩn khỏi danh sách', premium: '—', diamond: 'Có' },
  { label: 'Số dư ❤️ từ tiền gói', premium: '—', diamond: '80%' },
] as const;

export default function MembershipBillingPage() {
  const auth = useAuth();
  const router = useRouter();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<BillingTab>('membership');
  const [selectedTier, setSelectedTier] = useState<PaidTier>('premium');
  const [selectedPeriod, setSelectedPeriod] = useState<LuxyMembershipPeriodCount>(1);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'submit' | 'cancel' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getLuxyMembershipPlanOptions(client);
    },
  });

  const ordersQuery = useQuery({
    queryKey: luxyMembershipQueryKeys.orders(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
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

  useEffect(() => {
    const checkout = checkoutQuery.data;
    if (!checkout) return;
    if (checkout.status === 'approved' || checkout.status === 'rejected' || checkout.status === 'cancelled') {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.snapshot(auth.userId) }),
        queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) }),
      ]);
    }
  }, [auth.userId, checkoutQuery.data, queryClient]);

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  const membership = membershipQuery.data;
  const currentTier = membership?.tier ?? 'free';
  const currentName = currentTier === 'free' ? 'Free' : PLAN_COPY[currentTier].title;
  const selectedOption = plansQuery.data?.find(
    (option) => option.tier === selectedTier && option.period_count === selectedPeriod,
  );
  const checkout = checkoutQuery.data;
  const privacy = privacyQuery.data;
  const compact = width < 560;

  async function createCheckout() {
    if (!client || !selectedOption || Platform.OS !== 'web') return;
    setBusy('create');
    setMessage(null);
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
      setErrorMessage(getMembershipErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function submitTransfer() {
    if (!client || !checkout) return;
    setBusy('submit');
    setMessage(null);
    setErrorMessage(null);
    try {
      await markLuxyMembershipOrderSubmitted(client, checkout.order_id);
      await checkoutQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) });
      setMessage('Đã ghi nhận. Admin sẽ đối soát giao dịch trước khi kích hoạt gói.');
    } catch (error) {
      setErrorMessage(getMembershipErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function cancelCheckout() {
    if (!client || !checkout || checkout.status !== 'awaiting_payment') return;
    setBusy('cancel');
    setMessage(null);
    setErrorMessage(null);
    try {
      await cancelLuxyMembershipOrder(client, checkout.order_id);
      await checkoutQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) });
    } catch (error) {
      setErrorMessage(getMembershipErrorMessage(error));
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
      setErrorMessage('Không thể sao chép. Hãy chọn nội dung và sao chép thủ công.');
    }
  }

  const currentHideOnline = privacy?.hide_online ?? false;
  const currentHideListing = privacy?.hide_from_listing ?? false;
  function setPrivacy(next: { hideOnline?: boolean; hideFromListing?: boolean }) {
    privacyMutation.mutate({
      hideOnline: next.hideOnline ?? currentHideOnline,
      hideFromListing: next.hideFromListing ?? currentHideListing,
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} testID="luxy-upgrade-billing">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, compact && styles.pageCompact]}>
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <Text style={styles.brand}>{luxyBrand.productName}</Text>
            <View style={styles.topSpacer} />
          </View>

          <View style={styles.headingBlock}>
            <Text accessibilityRole="header" style={styles.title}>Nâng cấp trải nghiệm của bạn</Text>
            <Text style={styles.subtitle}>Chọn quyền truy cập phù hợp. Giá và quyền lợi được xác nhận trực tiếp từ hệ thống Luxy.Love.</Text>
            <View style={styles.currentPlanPill}>
              <Text style={styles.currentPlanText}>Gói hiện tại: {currentName}{membership?.expires_at ? ` · đến ${formatDate(membership.expires_at)}` : ''}</Text>
            </View>
          </View>

          <View accessibilityRole="tablist" style={styles.tabs}>
            <BillingTabButton active={tab === 'membership'} label="Gói thành viên" onPress={() => setTab('membership')} />
            <BillingTabButton active={tab === 'one_time'} label="Một lần" onPress={() => setTab('one_time')} />
          </View>

          {tab === 'membership' ? (
            <>
              {plansQuery.isLoading ? (
                <View style={styles.loadingBox}><ActivityIndicator color={luxyColors.ink} /><Text style={styles.muted}>Đang tải bảng giá…</Text></View>
              ) : plansQuery.isError ? (
                <View style={styles.loadingBox}>
                  <Text accessibilityRole="alert" style={styles.errorText}>Không thể tải bảng giá.</Text>
                  <Pressable onPress={() => void plansQuery.refetch()} style={styles.textButton}><Text style={styles.textButtonLabel}>Thử lại</Text></Pressable>
                </View>
              ) : (
                <>
                  <PlanSection
                    options={plansQuery.data ?? []}
                    selectedPeriod={selectedTier === 'premium' ? selectedPeriod : null}
                    tier="premium"
                    onSelect={(period) => { setSelectedTier('premium'); setSelectedPeriod(period); }}
                  />
                  <PlanSection
                    options={plansQuery.data ?? []}
                    selectedPeriod={selectedTier === 'diamond' ? selectedPeriod : null}
                    tier="diamond"
                    onSelect={(period) => { setSelectedTier('diamond'); setSelectedPeriod(period); }}
                  />
                </>
              )}

              <View style={styles.ctaBlock}>
                <View style={styles.ctaPriceRow}>
                  <View>
                    <Text style={styles.ctaEyebrow}>BẠN ĐÃ CHỌN</Text>
                    <Text style={styles.ctaPlan}>{PLAN_COPY[selectedTier].title} · {selectedPeriod} kỳ</Text>
                  </View>
                  <Text style={styles.ctaAmount}>{selectedOption ? formatLuxyMembershipAmount(selectedOption.amount_due_vnd) : '—'}</Text>
                </View>
                {selectedPeriod === 3 ? <Text style={styles.savingNote}>Đã áp dụng giảm 20% cho 3 kỳ.</Text> : null}
                {selectedTier === 'diamond' && selectedOption ? (
                  <Text style={styles.heartNote}>Sau khi Admin xác nhận, {selectedOption.heart_credit_display} ❤️ sẽ được cộng từ 80% số tiền gói.</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={!selectedOption || busy !== null || Platform.OS !== 'web'}
                  onPress={() => void createCheckout()}
                  style={({ pressed }) => [styles.primaryButton, (!selectedOption || busy !== null || Platform.OS !== 'web') && styles.disabled, pressed && styles.pressed]}
                  testID="membership-checkout-cta"
                >
                  {busy === 'create' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Tiếp tục thanh toán</Text>}
                </Pressable>
                {Platform.OS !== 'web' ? <Text style={styles.platformNote}>VietQR chỉ mở trên web/PWA. Android Google Play Billing thuộc LX-21.</Text> : null}
                <Text style={styles.activationNote}>Thanh toán không tự kích hoạt. Gói chỉ có hiệu lực sau khi Admin đối soát đúng giao dịch và số tiền.</Text>
              </View>

              <CompareTable compact={compact} />

              {ordersQuery.data?.length ? (
                <View style={styles.historySection}>
                  <Text style={styles.sectionHeading}>Yêu cầu gần đây</Text>
                  {ordersQuery.data.map((order) => (
                    <Pressable
                      accessibilityRole="button"
                      key={order.order_id}
                      onPress={() => setCheckoutOrderId(order.order_id)}
                      style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                    >
                      <View style={styles.historyCopy}>
                        <Text style={styles.historyTitle}>{PLAN_COPY[order.tier].title} · {order.period_count} kỳ</Text>
                        <Text style={styles.historyMeta}>{order.order_code} · {formatDate(order.created_at)}</Text>
                      </View>
                      <View style={styles.historyTail}>
                        <Text style={styles.historyAmount}>{formatLuxyMembershipAmount(order.amount_due_vnd)}</Text>
                        <Text style={styles.historyStatus}>{getLuxyMembershipOrderStatusLabel(order.status)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <MembershipPrivacySection
                canHideFromListing={privacy?.can_hide_from_listing ?? false}
                canHideOnline={privacy?.can_hide_online ?? false}
                hideFromListing={currentHideListing}
                hideOnline={currentHideOnline}
                pending={privacyMutation.isPending}
                onHideFromListing={(value) => setPrivacy({ hideFromListing: value })}
                onHideOnline={(value) => setPrivacy({ hideOnline: value })}
              />
            </>
          ) : (
            <View style={styles.oneTimeEmpty}>
              <Text style={styles.oneTimeTitle}>Sản phẩm mua một lần chưa mở trong LX-18</Text>
              <Text style={styles.oneTimeText}>Tab được giữ theo cấu trúc Billing của Seeking. Quà tặng và các giao dịch một lần thuộc LX-19; Luxy không tạo sản phẩm giả chỉ để lấp giao diện.</Text>
              <Pressable onPress={() => setTab('membership')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Xem gói thành viên</Text></Pressable>
            </View>
          )}

          {errorMessage ? <Text accessibilityRole="alert" style={styles.errorBanner}>{errorMessage}</Text> : null}
        </View>
      </ScrollView>

      <MembershipCheckoutModal
        busy={busy}
        checkout={checkout}
        copied={copied}
        error={checkoutQuery.isError ? 'Không thể tải chi tiết thanh toán.' : null}
        loading={Boolean(checkoutOrderId) && checkoutQuery.isLoading}
        message={message}
        onCancel={() => void cancelCheckout()}
        onClose={() => { setCheckoutOrderId(null); setMessage(null); setErrorMessage(null); }}
        onCopy={(key, value) => void copyValue(key, value)}
        onSubmit={() => void submitTransfer()}
      />
    </SafeAreaView>
  );
}

function BillingTabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PlanSection({
  tier,
  options,
  selectedPeriod,
  onSelect,
}: {
  tier: PaidTier;
  options: Awaited<ReturnType<typeof getLuxyMembershipPlanOptions>>;
  selectedPeriod: LuxyMembershipPeriodCount | null;
  onSelect: (period: LuxyMembershipPeriodCount) => void;
}) {
  const copy = PLAN_COPY[tier];
  return (
    <View style={styles.planSection} testID={`plan-${tier}`}>
      <View style={styles.planHeadingRow}>
        <View style={styles.planHeadingCopy}>
          <Text style={styles.planEyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.planTitle}>{copy.title}</Text>
        </View>
        {tier === 'diamond' ? <Text style={styles.ultimateBadge}>ULTIMATE ACCESS</Text> : null}
      </View>
      <Text style={styles.planDescription}>{copy.description}</Text>
      <View style={styles.planFeatures}>
        {copy.features.map((feature) => <Text key={feature} style={styles.featureLine}>✓ {feature}</Text>)}
      </View>
      <View style={styles.optionStack}>
        {[1, 3].map((period) => {
          const typedPeriod = period as LuxyMembershipPeriodCount;
          const option = options.find((item) => item.tier === tier && item.period_count === typedPeriod);
          if (!option) return null;
          const selected = selectedPeriod === typedPeriod;
          const monthlyEffective = Math.round(option.amount_due_vnd / typedPeriod);
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={period}
              onPress={() => onSelect(typedPeriod)}
              style={({ pressed }) => [styles.planOption, selected && styles.planOptionSelected, pressed && styles.pressed]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              <View style={styles.optionCopy}>
                <View style={styles.optionTitleRow}>
                  <Text style={styles.optionTitle}>{period === 1 ? '1 kỳ' : '3 kỳ'}</Text>
                  {period === 3 ? <Text style={styles.discountBadge}>GIẢM 20%</Text> : null}
                </View>
                <Text style={styles.optionMeta}>{formatLuxyMembershipAmount(monthlyEffective)} / tháng{period === 3 ? ' · thanh toán 3 kỳ' : ''}</Text>
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

function CompareTable({ compact }: { compact: boolean }) {
  return (
    <View style={styles.compareSection} testID="membership-compare-table">
      <Text style={styles.sectionHeading}>So sánh quyền lợi</Text>
      <View style={styles.compareHeader}>
        <Text style={[styles.compareFeature, compact && styles.compareFeatureCompact]}>Quyền lợi</Text>
        <Text style={styles.compareValueHeader}>Premium</Text>
        <Text style={styles.compareValueHeader}>Diamond</Text>
      </View>
      {COMPARE_ROWS.map((row) => (
        <View key={row.label} style={styles.compareRow}>
          <Text style={[styles.compareFeature, compact && styles.compareFeatureCompact]}>{row.label}</Text>
          <Text style={styles.compareValue}>{row.premium}</Text>
          <Text style={styles.compareValue}>{row.diamond}</Text>
        </View>
      ))}
    </View>
  );
}

function MembershipPrivacySection({
  hideOnline,
  hideFromListing,
  canHideOnline,
  canHideFromListing,
  pending,
  onHideOnline,
  onHideFromListing,
}: {
  hideOnline: boolean;
  hideFromListing: boolean;
  canHideOnline: boolean;
  canHideFromListing: boolean;
  pending: boolean;
  onHideOnline: (value: boolean) => void;
  onHideFromListing: (value: boolean) => void;
}) {
  return (
    <View style={styles.privacySection}>
      <Text style={styles.sectionHeading}>Quyền riêng tư của gói hiện tại</Text>
      <PrivacyRow disabled={!canHideOnline || pending} label="Ẩn trạng thái online" note="Premium và Diamond" onValueChange={onHideOnline} value={hideOnline} />
      <PrivacyRow disabled={!canHideFromListing || pending} label="Ẩn khỏi danh sách thành viên" note="Chỉ Diamond" onValueChange={onHideFromListing} value={hideFromListing} />
    </View>
  );
}

function PrivacyRow({ label, note, value, disabled, onValueChange }: { label: string; note: string; value: boolean; disabled: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.privacyRow}>
      <View style={styles.privacyCopy}><Text style={[styles.privacyLabel, disabled && styles.muted]}>{label}</Text><Text style={styles.privacyNote}>{note}</Text></View>
      <Switch accessibilityLabel={label} disabled={disabled} onValueChange={onValueChange} value={value} />
    </View>
  );
}

function MembershipCheckoutModal({
  checkout,
  loading,
  error,
  busy,
  message,
  copied,
  onCopy,
  onSubmit,
  onCancel,
  onClose,
}: {
  checkout?: LuxyMembershipCheckout;
  loading: boolean;
  error: string | null;
  busy: 'create' | 'submit' | 'cancel' | null;
  message: string | null;
  copied: string | null;
  onCopy: (key: string, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const visible = loading || Boolean(checkout) || Boolean(error);
  if (!visible) return null;
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Pressable accessibilityLabel="Đóng" accessibilityRole="button" onPress={onClose} style={styles.modalClose}><Text style={styles.modalCloseText}>×</Text></Pressable>
          {loading ? <View style={styles.modalLoading}><ActivityIndicator color={luxyColors.ink} size="large" /><Text style={styles.muted}>Đang tạo thông tin thanh toán…</Text></View> : null}
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          {checkout ? (
            <ScrollView contentContainerStyle={styles.checkoutContent}>
              <Text style={styles.checkoutEyebrow}>{checkout.order_code}</Text>
              <Text style={styles.checkoutTitle}>Thanh toán {PLAN_COPY[checkout.tier].title}</Text>
              <Text style={styles.checkoutStatus}>{getLuxyMembershipOrderStatusLabel(checkout.status)}</Text>

              {checkout.status === 'awaiting_payment' ? (
                <Image accessibilityLabel="Mã VietQR thanh toán gói thành viên" resizeMode="contain" source={{ uri: checkout.qr_image_url }} style={styles.qrImage} />
              ) : null}

              <View style={styles.checkoutSummary}>
                <CheckoutRow label="Gói" value={`${PLAN_COPY[checkout.tier].title} · ${checkout.period_count} kỳ`} />
                <CheckoutRow label="Ngân hàng" value={`${checkout.bank_name} (${checkout.bank_code})`} />
                <CheckoutRow copied={copied === 'account'} label="Số tài khoản" onCopy={() => onCopy('account', checkout.account_no)} value={checkout.account_no} />
                <CheckoutRow label="Chủ tài khoản" value={checkout.account_name} />
                <CheckoutRow copied={copied === 'amount'} label="Số tiền" onCopy={() => onCopy('amount', String(checkout.amount_due_vnd))} value={formatLuxyMembershipAmount(checkout.amount_due_vnd)} />
                <CheckoutRow copied={copied === 'content'} label="Nội dung" onCopy={() => onCopy('content', checkout.transfer_content)} value={checkout.transfer_content} />
                {checkout.tier === 'diamond' ? <CheckoutRow label="❤️ sau khi duyệt" value={`${checkout.heart_credit_display} ❤️`} /> : null}
              </View>

              {checkout.status === 'awaiting_payment' ? (
                <>
                  <Text style={styles.checkoutInstruction}>Chuyển đúng số tiền và giữ nguyên nội dung. Sau đó chọn “Tôi đã chuyển khoản”.</Text>
                  <Pressable disabled={busy !== null} onPress={onSubmit} style={[styles.primaryButton, busy !== null && styles.disabled]}>
                    {busy === 'submit' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Tôi đã chuyển khoản</Text>}
                  </Pressable>
                  <Pressable disabled={busy !== null} onPress={onCancel} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{busy === 'cancel' ? 'Đang hủy…' : 'Hủy yêu cầu'}</Text></Pressable>
                </>
              ) : null}

              {checkout.status === 'awaiting_confirmation' ? (
                <View style={styles.waitingBox}><ActivityIndicator color={luxyColors.ink} /><Text style={styles.waitingText}>Đang chờ Admin đối soát. Màn hình tự kiểm tra lại mỗi 10 giây; thao tác này chưa kích hoạt gói.</Text></View>
              ) : null}
              {checkout.status === 'approved' ? <View style={styles.successBox}><Text style={styles.successTitle}>Gói đã được kích hoạt</Text><Text style={styles.successText}>Quyền thành viên đã cập nhật theo thời hạn đã duyệt.</Text></View> : null}
              {checkout.status === 'rejected' ? <View style={styles.warningBox}><Text style={styles.warningTitle}>Giao dịch chưa được xác nhận</Text><Text style={styles.warningText}>Vui lòng liên hệ hỗ trợ nếu bạn đã chuyển khoản.</Text></View> : null}
              {checkout.status === 'cancelled' ? <View style={styles.warningBox}><Text style={styles.warningTitle}>Yêu cầu đã hủy</Text><Text style={styles.warningText}>Bạn có thể quay lại và tạo yêu cầu mới.</Text></View> : null}
              {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}
              <Text style={styles.checkoutFootnote}>Admin là đường duy nhất kích hoạt Premium/Diamond. Nút xác nhận của thành viên không tự cấp quyền và không tự cộng ❤️.</Text>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function CheckoutRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <View style={styles.checkoutRow}>
      <View style={styles.checkoutRowCopy}><Text style={styles.checkoutLabel}>{label}</Text><Text selectable style={styles.checkoutValue}>{value}</Text></View>
      {onCopy ? <Pressable accessibilityRole="button" onPress={onCopy} style={styles.copyButton}><Text style={styles.copyButtonText}>{copied ? 'Đã chép' : 'Sao chép'}</Text></Pressable> : null}
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN');
}

function getMembershipErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('active_adult_account_required')) return 'Tài khoản phải đang hoạt động và đủ 18 tuổi.';
  if (message.includes('membership_vietqr_disabled')) return 'Thanh toán VietQR cho gói thành viên hiện đang tạm khóa.';
  if (message.includes('vietqr_account_not_configured')) return 'Tài khoản nhận VietQR chưa được cấu hình.';
  if (message.includes('membership_order_not_found')) return 'Không tìm thấy yêu cầu thanh toán này.';
  if (message.includes('membership_period_count_must_be_1_or_3')) return 'Chỉ hỗ trợ 1 kỳ hoặc 3 kỳ.';
  return 'Không thể xử lý yêu cầu thanh toán. Vui lòng thử lại.';
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: luxyColors.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 72 },
  page: { alignSelf: 'center', paddingHorizontal: 20, width: '100%', maxWidth: 600 },
  pageCompact: { paddingHorizontal: 16 },
  topBar: { alignItems: 'center', flexDirection: 'row', minHeight: 74, justifyContent: 'space-between' },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backIcon: { color: luxyColors.ink, fontSize: 34, fontWeight: '300', lineHeight: 36 },
  brand: { color: luxyColors.brandCoral, fontFamily: luxyTypography.families.brand, fontSize: 27, letterSpacing: -1.2 },
  topSpacer: { width: 44 },
  headingBlock: { alignItems: 'center', paddingBottom: 26, paddingTop: 14 },
  title: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 34, lineHeight: 42, textAlign: 'center' },
  subtitle: { color: luxyColors.muted, fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 520, textAlign: 'center' },
  currentPlanPill: { backgroundColor: luxyColors.subtleSurface, borderRadius: luxyRadii.pill, marginTop: 16, paddingHorizontal: 14, paddingVertical: 7 },
  currentPlanText: { color: luxyColors.text, fontSize: 12.5, fontWeight: '600' },
  tabs: { borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', marginBottom: 28 },
  tab: { alignItems: 'center', borderBottomColor: 'transparent', borderBottomWidth: 2, flex: 1, minHeight: 48, justifyContent: 'center' },
  tabActive: { borderBottomColor: luxyColors.ink },
  tabText: { color: luxyColors.muted, fontSize: 14.5 },
  tabTextActive: { color: luxyColors.text, fontWeight: '700' },
  loadingBox: { alignItems: 'center', borderColor: luxyColors.border, borderWidth: 1, gap: 10, marginBottom: 24, padding: 32 },
  muted: { color: luxyColors.muted, fontSize: 13, lineHeight: 19 },
  planSection: { borderBottomColor: luxyColors.border, borderBottomWidth: 1, marginBottom: 30, paddingBottom: 30 },
  planHeadingRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  planHeadingCopy: { flex: 1 },
  planEyebrow: { color: luxyColors.muted, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.5 },
  planTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 28, lineHeight: 34, marginTop: 2 },
  ultimateBadge: { backgroundColor: luxyColors.ink, borderRadius: 4, color: '#FFFFFF', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6 },
  planDescription: { color: luxyColors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  planFeatures: { gap: 5, marginTop: 14 },
  featureLine: { color: luxyColors.text, fontSize: 12.5, lineHeight: 18 },
  optionStack: { gap: 10, marginTop: 18 },
  planOption: { alignItems: 'center', backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 76, paddingHorizontal: 14, paddingVertical: 12 },
  planOptionSelected: { backgroundColor: '#FFF7F7', borderColor: luxyColors.brandCoral, borderWidth: 1.5 },
  radio: { alignItems: 'center', borderColor: luxyColors.softMuted, borderRadius: 10, borderWidth: 1.5, height: 20, justifyContent: 'center', width: 20 },
  radioSelected: { borderColor: luxyColors.brandCoral },
  radioDot: { backgroundColor: luxyColors.brandCoral, borderRadius: 5, height: 10, width: 10 },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  optionTitle: { color: luxyColors.text, fontSize: 14.5, fontWeight: '700' },
  discountBadge: { backgroundColor: luxyColors.brandCoral, borderRadius: 3, color: '#FFFFFF', fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3 },
  optionMeta: { color: luxyColors.muted, fontSize: 11.5, marginTop: 3 },
  optionHeart: { color: luxyColors.text, fontSize: 11.5, fontWeight: '600', marginTop: 4 },
  optionAmount: { color: luxyColors.text, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  ctaBlock: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: 8, borderWidth: 1, marginBottom: 34, padding: 18, ...luxyShadows.card },
  ctaPriceRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  ctaEyebrow: { color: luxyColors.muted, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.1 },
  ctaPlan: { color: luxyColors.text, fontSize: 16, fontWeight: '700', marginTop: 3 },
  ctaAmount: { color: luxyColors.text, fontSize: 18, fontWeight: '700' },
  savingNote: { color: luxyColors.brandCoral, fontSize: 12, fontWeight: '700', marginTop: 10 },
  heartNote: { color: luxyColors.text, fontSize: 12, lineHeight: 18, marginTop: 7 },
  primaryButton: { alignItems: 'center', backgroundColor: luxyColors.actionRed, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 50, marginTop: 16, paddingHorizontal: 20 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  platformNote: { color: luxyColors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 10, textAlign: 'center' },
  activationNote: { color: luxyColors.muted, fontSize: 11, lineHeight: 17, marginTop: 10, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  compareSection: { marginBottom: 34 },
  sectionHeading: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 22, lineHeight: 28, marginBottom: 14 },
  compareHeader: { backgroundColor: luxyColors.subtleSurface, borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 46, paddingHorizontal: 10 },
  compareRow: { borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 54, paddingHorizontal: 10 },
  compareFeature: { alignSelf: 'center', color: luxyColors.text, flex: 1.35, fontSize: 12.5, paddingRight: 8 },
  compareFeatureCompact: { fontSize: 11.5 },
  compareValueHeader: { alignSelf: 'center', color: luxyColors.text, flex: 0.8, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  compareValue: { alignSelf: 'center', color: luxyColors.text, flex: 0.8, fontSize: 11.5, textAlign: 'center' },
  historySection: { marginBottom: 34 },
  historyRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 72, paddingVertical: 10 },
  historyCopy: { flex: 1 },
  historyTitle: { color: luxyColors.text, fontSize: 13.5, fontWeight: '700' },
  historyMeta: { color: luxyColors.muted, fontSize: 11, marginTop: 4 },
  historyTail: { alignItems: 'flex-end' },
  historyAmount: { color: luxyColors.text, fontSize: 12, fontWeight: '700' },
  historyStatus: { color: luxyColors.muted, fontSize: 10.5, marginTop: 4 },
  privacySection: { marginBottom: 36 },
  privacyRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 66, paddingVertical: 8 },
  privacyCopy: { flex: 1 },
  privacyLabel: { color: luxyColors.text, fontSize: 13, fontWeight: '600' },
  privacyNote: { color: luxyColors.muted, fontSize: 11, marginTop: 3 },
  oneTimeEmpty: { alignItems: 'center', borderColor: luxyColors.border, borderWidth: 1, padding: 30 },
  oneTimeTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 23, textAlign: 'center' },
  oneTimeText: { color: luxyColors.muted, fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: 'center' },
  secondaryButton: { alignItems: 'center', backgroundColor: luxyColors.surface, borderColor: luxyColors.ink, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 46, marginTop: 14, paddingHorizontal: 18 },
  secondaryButtonText: { color: luxyColors.ink, fontSize: 13, fontWeight: '700' },
  textButton: { padding: 8 },
  textButtonLabel: { color: luxyColors.ink, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  errorText: { color: luxyColors.danger, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  errorBanner: { backgroundColor: '#FFF4F4', borderColor: '#F3B4B4', borderWidth: 1, color: luxyColors.danger, fontSize: 12, lineHeight: 18, marginBottom: 24, padding: 12 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.58)', flex: 1, justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: luxyColors.surface, borderRadius: 8, maxHeight: '92%', maxWidth: 466, minHeight: 260, position: 'relative', width: '100%', ...luxyShadows.card },
  modalClose: { alignItems: 'center', height: 42, justifyContent: 'center', position: 'absolute', right: 5, top: 5, width: 42, zIndex: 10 },
  modalCloseText: { color: luxyColors.ink, fontSize: 28, fontWeight: '300' },
  modalLoading: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 40 },
  checkoutContent: { padding: 26, paddingTop: 34 },
  checkoutEyebrow: { color: luxyColors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, textAlign: 'center' },
  checkoutTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 27, lineHeight: 33, marginTop: 4, textAlign: 'center' },
  checkoutStatus: { color: luxyColors.muted, fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  qrImage: { alignSelf: 'center', height: 248, marginVertical: 14, width: 248 },
  checkoutSummary: { borderTopColor: luxyColors.border, borderTopWidth: 1, marginTop: 8 },
  checkoutRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, minHeight: 56, paddingVertical: 8 },
  checkoutRowCopy: { flex: 1 },
  checkoutLabel: { color: luxyColors.muted, fontSize: 10.5 },
  checkoutValue: { color: luxyColors.text, fontSize: 13, fontWeight: '600', marginTop: 2 },
  copyButton: { borderColor: luxyColors.border, borderRadius: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  copyButtonText: { color: luxyColors.ink, fontSize: 10.5, fontWeight: '700' },
  checkoutInstruction: { color: luxyColors.muted, fontSize: 11.5, lineHeight: 18, marginTop: 14, textAlign: 'center' },
  waitingBox: { alignItems: 'center', backgroundColor: luxyColors.subtleSurface, gap: 9, marginTop: 16, padding: 16 },
  waitingText: { color: luxyColors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  successBox: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', borderWidth: 1, marginTop: 16, padding: 14 },
  successTitle: { color: luxyColors.text, fontSize: 13, fontWeight: '700' },
  successText: { color: luxyColors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  warningBox: { backgroundColor: '#FFFBEB', borderColor: '#F2B51D', borderWidth: 1, marginTop: 16, padding: 14 },
  warningTitle: { color: luxyColors.text, fontSize: 13, fontWeight: '700' },
  warningText: { color: luxyColors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  notice: { color: luxyColors.text, fontSize: 11.5, lineHeight: 17, marginTop: 12, textAlign: 'center' },
  checkoutFootnote: { color: luxyColors.muted, fontSize: 10.5, lineHeight: 16, marginTop: 14, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
