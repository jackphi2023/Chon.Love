import {
  cancelLuxyMembershipOrder,
  createLuxyMembershipOrder,
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
  type LuxyMembershipPlanOption,
  type LuxyMembershipTier,
} from '@myfan/supabase';
import { luxyBrand, luxyColors, luxyRadii, luxyShadows, luxyTypography } from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { LuxyModalLayer } from '@/components/luxy-modal-layer';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type PaidTier = Exclude<LuxyMembershipTier, 'free'>;
type BillingTab = 'membership' | 'one_time';

const PLAN_COPY: Record<PaidTier, { title: string; eyebrow: string; description: string; features: string[] }> = {
  premium: {
    title: 'Premium',
    eyebrow: 'CAO CẤP',
    description: 'Mở toàn bộ trải nghiệm kết nối và quyền riêng tư cần thiết để chủ động tìm kiếm.',
    features: ['Tìm kiếm & lọc đầy đủ', 'Thích không giới hạn', 'Tin nhắn không giới hạn', 'Ưu tiên hơn Free', 'Ẩn trạng thái online'],
  },
  diamond: {
    title: 'Diamond',
    eyebrow: 'KIM CƯƠNG',
    description: 'Quyền truy cập cao nhất, ưu tiên đầu danh sách và số dư ❤️ để tặng quà.',
    features: ['Toàn bộ quyền Premium', 'Ưu tiên đầu danh sách', 'Ẩn khỏi danh sách', '80% tiền gói quy đổi sang ❤️', 'Huy hiệu Diamond'],
  },
};

const COMPARE_ROWS = [
  ['Tạo & xem hồ sơ', 'Có', 'Có'],
  ['Lọc tìm kiếm đầy đủ', 'Có', 'Có'],
  ['Thích không giới hạn', 'Có', 'Có'],
  ['Tin nhắn không giới hạn', 'Có', 'Có'],
  ['Ưu tiên hiển thị', 'Cao hơn Free', 'Cao nhất'],
  ['Ẩn trạng thái online', 'Có', 'Có'],
  ['Ẩn khỏi danh sách', '—', 'Có'],
  ['Số dư ❤️ từ tiền gói', '—', '80%'],
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
    mutationFn: async (input: { hideOnline: boolean; hideFromListing: boolean }) => {
      if (!client) throw new Error('supabase_not_configured');
      return updateMyLuxyMembershipPrivacy(client, input);
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
    if (!checkoutQuery.data) return;
    if (['approved', 'rejected', 'cancelled'].includes(checkoutQuery.data.status)) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.snapshot(auth.userId) }),
        queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) }),
      ]);
    }
  }, [auth.userId, checkoutQuery.data, queryClient]);

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  const currentTier = membershipQuery.data?.tier ?? 'free';
  const currentName = currentTier === 'free' ? 'Free' : PLAN_COPY[currentTier].title;
  const selectedOption = plansQuery.data?.find((row) => row.tier === selectedTier && row.period_count === selectedPeriod);
  const privacy = privacyQuery.data;
  const hideOnline = privacy?.hide_online ?? false;
  const hideFromListing = privacy?.hide_from_listing ?? false;
  const compact = width < 560;

  async function startCheckout() {
    if (!client || !selectedOption || Platform.OS !== 'web') return;
    setBusy('create'); setNotice(null); setErrorMessage(null);
    try {
      const order = await createLuxyMembershipOrder(client, selectedTier, selectedPeriod, createRequestId(), 'upgrade_billing_web');
      setCheckoutOrderId(order.order_id);
      await queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) });
    } catch (error) { setErrorMessage(errorCopy(error)); }
    finally { setBusy(null); }
  }

  async function submitTransfer() {
    if (!client || !checkoutQuery.data) return;
    setBusy('submit'); setNotice(null); setErrorMessage(null);
    try {
      await markLuxyMembershipOrderSubmitted(client, checkoutQuery.data.order_id);
      await checkoutQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) });
      setNotice('Đã ghi nhận. Admin sẽ đối soát giao dịch trước khi kích hoạt gói.');
    } catch (error) { setErrorMessage(errorCopy(error)); }
    finally { setBusy(null); }
  }

  async function cancelCheckout() {
    const checkout = checkoutQuery.data;
    if (!client || !checkout || checkout.status !== 'awaiting_payment') return;
    setBusy('cancel'); setErrorMessage(null);
    try {
      await cancelLuxyMembershipOrder(client, checkout.order_id);
      await checkoutQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: luxyMembershipQueryKeys.orders(auth.userId) });
    } catch (error) { setErrorMessage(errorCopy(error)); }
    finally { setBusy(null); }
  }

  async function copyValue(key: string, value: string) {
    if (Platform.OS !== 'web' || !globalThis.navigator?.clipboard) return setErrorMessage('Trình duyệt này không hỗ trợ sao chép tự động.');
    try {
      await globalThis.navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((current) => current === key ? null : current), 1800);
    } catch { setErrorMessage('Không thể sao chép. Hãy sao chép thủ công.'); }
  }

  function updatePrivacy(next: { hideOnline?: boolean; hideFromListing?: boolean }) {
    privacyMutation.mutate({ hideOnline: next.hideOnline ?? hideOnline, hideFromListing: next.hideFromListing ?? hideFromListing });
  }

  return (
    <SafeAreaView style={styles.safeArea} testID="luxy-upgrade-billing">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, compact && styles.pageCompact]}>
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backIcon}>‹</Text></Pressable>
            <Text style={styles.brand}>{luxyBrand.productName}</Text><View style={styles.topSpacer} />
          </View>
          <View style={styles.headingBlock}>
            <Text accessibilityRole="header" style={styles.title}>Nâng cấp trải nghiệm của bạn</Text>
            <Text style={styles.subtitle}>Chọn quyền truy cập phù hợp. Giá và quyền lợi được lấy trực tiếp từ hệ thống Luxy.Love.</Text>
            <View style={styles.currentPill}><Text style={styles.currentText}>Gói hiện tại: {currentName}{membershipQuery.data?.expires_at ? ` · đến ${formatDate(membershipQuery.data.expires_at)}` : ''}</Text></View>
          </View>

          <View style={styles.tabs}>
            <Tab active={tab === 'membership'} label="Gói thành viên" onPress={() => setTab('membership')} />
            <Tab active={tab === 'one_time'} label="Một lần" onPress={() => setTab('one_time')} />
          </View>

          {tab === 'one_time' ? (
            <View style={styles.emptyBox}>
              <Text style={styles.sectionTitle}>Sản phẩm mua một lần chưa mở trong LX-18</Text>
              <Text style={styles.muted}>Tab được giữ theo cấu trúc Billing của Seeking. Quà tặng và giao dịch một lần thuộc LX-19; Luxy không tạo sản phẩm giả chỉ để lấp giao diện.</Text>
              <Pressable onPress={() => setTab('membership')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Xem gói thành viên</Text></Pressable>
            </View>
          ) : (
            <>
              {plansQuery.isLoading ? <View style={styles.loading}><ActivityIndicator color={luxyColors.ink} /><Text style={styles.muted}>Đang tải bảng giá…</Text></View> : null}
              {plansQuery.isError ? <Text accessibilityRole="alert" style={styles.error}>Không thể tải bảng giá.</Text> : null}
              {(plansQuery.data ?? []).length ? (
                <>
                  <PlanSection tier="premium" options={plansQuery.data ?? []} selectedPeriod={selectedTier === 'premium' ? selectedPeriod : null} onSelect={(period) => { setSelectedTier('premium'); setSelectedPeriod(period); }} />
                  <PlanSection tier="diamond" options={plansQuery.data ?? []} selectedPeriod={selectedTier === 'diamond' ? selectedPeriod : null} onSelect={(period) => { setSelectedTier('diamond'); setSelectedPeriod(period); }} />
                </>
              ) : null}

              <View style={styles.ctaCard}>
                <View style={styles.rowBetween}><View><Text style={styles.eyebrow}>BẠN ĐÃ CHỌN</Text><Text style={styles.ctaPlan}>{PLAN_COPY[selectedTier].title} · {selectedPeriod} kỳ</Text></View><Text style={styles.ctaAmount}>{selectedOption ? formatLuxyMembershipAmount(selectedOption.amount_due_vnd) : '—'}</Text></View>
                {selectedPeriod === 3 ? <Text style={styles.discountText}>Đã áp dụng giảm 20% cho 3 kỳ.</Text> : null}
                {selectedTier === 'diamond' && selectedOption ? <Text style={styles.heartText}>Sau khi Admin xác nhận: +{selectedOption.heart_credit_display} ❤️ từ 80% tiền gói.</Text> : null}
                <Pressable disabled={!selectedOption || busy !== null || Platform.OS !== 'web'} onPress={() => void startCheckout()} style={[styles.primaryButton, (!selectedOption || busy !== null || Platform.OS !== 'web') && styles.disabled]} testID="membership-checkout-cta">
                  {busy === 'create' ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Tiếp tục thanh toán</Text>}
                </Pressable>
                {Platform.OS !== 'web' ? <Text style={styles.note}>VietQR chỉ mở trên web/PWA. Android Google Play Billing thuộc LX-21.</Text> : null}
                <Text style={styles.note}>Thanh toán không tự kích hoạt. Admin phải đối soát đúng giao dịch và số tiền.</Text>
              </View>

              <CompareTable />

              {ordersQuery.data?.length ? <View style={styles.section}><Text style={styles.sectionTitle}>Yêu cầu gần đây</Text>{ordersQuery.data.map((order) => <Pressable key={order.order_id} onPress={() => setCheckoutOrderId(order.order_id)} style={styles.historyRow}><View style={{ flex: 1 }}><Text style={styles.historyTitle}>{PLAN_COPY[order.tier].title} · {order.period_count} kỳ</Text><Text style={styles.historyMeta}>{order.order_code} · {formatDate(order.created_at)}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={styles.historyTitle}>{formatLuxyMembershipAmount(order.amount_due_vnd)}</Text><Text style={styles.historyMeta}>{getLuxyMembershipOrderStatusLabel(order.status)}</Text></View></Pressable>)}</View> : null}

              <View style={styles.section}><Text style={styles.sectionTitle}>Quyền riêng tư của gói hiện tại</Text><PrivacyRow label="Ẩn trạng thái online" note="Premium và Diamond" disabled={!privacy?.can_hide_online || privacyMutation.isPending} value={hideOnline} onChange={(value) => updatePrivacy({ hideOnline: value })} /><PrivacyRow label="Ẩn khỏi danh sách thành viên" note="Chỉ Diamond" disabled={!privacy?.can_hide_from_listing || privacyMutation.isPending} value={hideFromListing} onChange={(value) => updatePrivacy({ hideFromListing: value })} /></View>
            </>
          )}
          {errorMessage ? <Text accessibilityRole="alert" style={styles.errorBanner}>{errorMessage}</Text> : null}
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
        onClose={() => { setCheckoutOrderId(null); setNotice(null); setErrorMessage(null); }}
        onCopy={(key, value) => void copyValue(key, value)}
        onSubmit={() => void submitTransfer()}
      />
    </SafeAreaView>
  );
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>;
}

function PlanSection({ tier, options, selectedPeriod, onSelect }: { tier: PaidTier; options: LuxyMembershipPlanOption[]; selectedPeriod: LuxyMembershipPeriodCount | null; onSelect: (period: LuxyMembershipPeriodCount) => void }) {
  const copy = PLAN_COPY[tier];
  return <View style={styles.planSection} testID={`plan-${tier}`}>
    <View style={styles.rowBetween}><View><Text style={styles.eyebrow}>{copy.eyebrow}</Text><Text style={styles.planTitle}>{copy.title}</Text></View>{tier === 'diamond' ? <Text style={styles.ultimate}>ULTIMATE ACCESS</Text> : null}</View>
    <Text style={styles.planDescription}>{copy.description}</Text>
    <View style={{ gap: 4, marginTop: 12 }}>{copy.features.map((feature) => <Text key={feature} style={styles.feature}>✓ {feature}</Text>)}</View>
    <View style={{ gap: 10, marginTop: 18 }}>{([1, 3] as LuxyMembershipPeriodCount[]).map((period) => {
      const option = options.find((row) => row.tier === tier && row.period_count === period); if (!option) return null;
      const selected = selectedPeriod === period;
      return <Pressable key={period} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onSelect(period)} style={[styles.planOption, selected && styles.planOptionSelected]}><View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View><View style={{ flex: 1 }}><View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}><Text style={styles.optionTitle}>{period} kỳ</Text>{period === 3 ? <Text style={styles.discountBadge}>GIẢM 20%</Text> : null}</View><Text style={styles.optionMeta}>{formatLuxyMembershipAmount(Math.round(option.amount_due_vnd / period))} / tháng</Text>{tier === 'diamond' ? <Text style={styles.optionHeart}>+ {option.heart_credit_display} ❤️ sau khi duyệt</Text> : null}</View><Text style={styles.optionAmount}>{formatLuxyMembershipAmount(option.amount_due_vnd)}</Text></Pressable>;
    })}</View>
  </View>;
}

function CompareTable() {
  return <View style={styles.section} testID="membership-compare-table"><Text style={styles.sectionTitle}>So sánh quyền lợi</Text><View style={styles.compareHeader}><Text style={styles.compareFeature}>Quyền lợi</Text><Text style={styles.compareValueHead}>Premium</Text><Text style={styles.compareValueHead}>Diamond</Text></View>{COMPARE_ROWS.map(([label, premium, diamond]) => <View key={label} style={styles.compareRow}><Text style={styles.compareFeature}>{label}</Text><Text style={styles.compareValue}>{premium}</Text><Text style={styles.compareValue}>{diamond}</Text></View>)}</View>;
}

function PrivacyRow({ label, note, value, disabled, onChange }: { label: string; note: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.privacyRow}><View style={{ flex: 1 }}><Text style={styles.privacyLabel}>{label}</Text><Text style={styles.historyMeta}>{note}</Text></View><Switch accessibilityLabel={label} disabled={disabled} onValueChange={onChange} value={value} /></View>;
}

function CheckoutModal({ checkout, loading, error, busy, notice, copied, onCopy, onSubmit, onCancel, onClose }: {
  checkout: LuxyMembershipCheckout | undefined;
  loading: boolean;
  error: string | null;
  busy: 'create' | 'submit' | 'cancel' | null;
  notice: string | null;
  copied: string | null;
  onCopy: (key: string, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const visible = loading || Boolean(checkout) || Boolean(error);
  if (!visible) return null;
  return <LuxyModalLayer visible={visible} onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.modalCard}><Pressable accessibilityLabel="Đóng" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>{loading ? <View style={styles.loading}><ActivityIndicator color={luxyColors.ink} /><Text style={styles.muted}>Đang tạo thông tin thanh toán…</Text></View> : null}{error ? <Text style={styles.error}>{error}</Text> : null}{checkout ? <ScrollView contentContainerStyle={styles.checkoutContent}>
    <Text style={[styles.eyebrow, { textAlign: 'center' }]}>{checkout.order_code}</Text><Text style={styles.checkoutTitle}>Thanh toán {PLAN_COPY[checkout.tier].title}</Text><Text style={styles.checkoutStatus}>{getLuxyMembershipOrderStatusLabel(checkout.status)}</Text>
    {checkout.status === 'awaiting_payment' ? <Image accessibilityLabel="Mã VietQR thanh toán gói thành viên" resizeMode="contain" source={{ uri: checkout.qr_image_url }} style={styles.qrImage} /> : null}
    <View style={styles.checkoutSummary}><CheckoutRow label="Gói" value={`${PLAN_COPY[checkout.tier].title} · ${checkout.period_count} kỳ`} /><CheckoutRow label="Ngân hàng" value={`${checkout.bank_name} (${checkout.bank_code})`} /><CheckoutRow label="Số tài khoản" value={checkout.account_no} copied={copied === 'account'} onCopy={() => onCopy('account', checkout.account_no)} /><CheckoutRow label="Chủ tài khoản" value={checkout.account_name} /><CheckoutRow label="Số tiền" value={formatLuxyMembershipAmount(checkout.amount_due_vnd)} copied={copied === 'amount'} onCopy={() => onCopy('amount', String(checkout.amount_due_vnd))} /><CheckoutRow label="Nội dung" value={checkout.transfer_content} copied={copied === 'content'} onCopy={() => onCopy('content', checkout.transfer_content)} />{checkout.tier === 'diamond' ? <CheckoutRow label="❤️ sau khi duyệt" value={`${checkout.heart_credit_display} ❤️`} /> : null}</View>
    {checkout.status === 'awaiting_payment' ? <><Text style={styles.note}>Chuyển đúng số tiền và giữ nguyên nội dung.</Text><Pressable disabled={busy !== null} onPress={onSubmit} style={[styles.primaryButton, busy !== null && styles.disabled]}>{busy === 'submit' ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Tôi đã chuyển khoản</Text>}</Pressable><Pressable disabled={busy !== null} onPress={onCancel} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{busy === 'cancel' ? 'Đang hủy…' : 'Hủy yêu cầu'}</Text></Pressable></> : null}
    {checkout.status === 'awaiting_confirmation' ? <View style={styles.waiting}><ActivityIndicator color={luxyColors.ink} /><Text style={styles.muted}>Đang chờ Admin đối soát. Tự kiểm tra lại mỗi 10 giây; chưa kích hoạt gói.</Text></View> : null}
    {checkout.status === 'approved' ? <StateBox title="Gói đã được kích hoạt" text="Quyền thành viên đã cập nhật theo thời hạn được duyệt." success /> : null}
    {checkout.status === 'rejected' ? <StateBox title="Giao dịch chưa được xác nhận" text="Vui lòng liên hệ hỗ trợ nếu bạn đã chuyển khoản." /> : null}
    {checkout.status === 'cancelled' ? <StateBox title="Yêu cầu đã hủy" text="Bạn có thể tạo một yêu cầu mới." /> : null}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}<Text style={styles.footnote}>Admin là đường duy nhất kích hoạt Premium/Diamond. Nút xác nhận của thành viên không tự cấp quyền và không tự cộng ❤️.</Text>
  </ScrollView> : null}</View></View></LuxyModalLayer>;
}

function CheckoutRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return <View style={styles.checkoutRow}><View style={{ flex: 1 }}><Text style={styles.checkoutLabel}>{label}</Text><Text selectable style={styles.checkoutValue}>{value}</Text></View>{onCopy ? <Pressable onPress={onCopy} style={styles.copyButton}><Text style={styles.copyText}>{copied ? 'Đã chép' : 'Sao chép'}</Text></Pressable> : null}</View>;
}

function StateBox({ title, text, success = false }: { title: string; text: string; success?: boolean }) {
  return <View style={[styles.stateBox, success && styles.stateSuccess]}><Text style={styles.historyTitle}>{title}</Text><Text style={styles.historyMeta}>{text}</Text></View>;
}

function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => { const random = Math.floor(Math.random() * 16); return (char === 'x' ? random : (random & 3) | 8).toString(16); });
}
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN'); }
function errorCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('active_adult_account_required')) return 'Tài khoản phải đang hoạt động và đủ 18 tuổi.';
  if (message.includes('membership_vietqr_disabled')) return 'Thanh toán VietQR cho gói thành viên hiện đang tạm khóa.';
  if (message.includes('vietqr_account_not_configured')) return 'Tài khoản nhận VietQR chưa được cấu hình.';
  if (message.includes('membership_order_not_found')) return 'Không tìm thấy yêu cầu thanh toán này.';
  return 'Không thể xử lý yêu cầu thanh toán. Vui lòng thử lại.';
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: luxyColors.background, flex: 1 }, scrollContent: { flexGrow: 1, paddingBottom: 72 }, page: { alignSelf: 'center', maxWidth: 600, paddingHorizontal: 20, width: '100%' }, pageCompact: { paddingHorizontal: 16 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 74 }, backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }, backIcon: { color: luxyColors.ink, fontSize: 34, fontWeight: '300' }, topSpacer: { width: 44 }, brand: { color: luxyColors.brandCoral, fontFamily: luxyTypography.families.brand, fontSize: 27, letterSpacing: -1.2 },
  headingBlock: { alignItems: 'center', paddingBottom: 26, paddingTop: 14 }, title: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 34, lineHeight: 42, textAlign: 'center' }, subtitle: { color: luxyColors.muted, fontSize: 14, lineHeight: 21, marginTop: 10, textAlign: 'center' }, currentPill: { backgroundColor: luxyColors.subtleSurface, borderRadius: luxyRadii.pill, marginTop: 16, paddingHorizontal: 14, paddingVertical: 7 }, currentText: { color: luxyColors.text, fontSize: 12.5, fontWeight: '600' },
  tabs: { borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', marginBottom: 28 }, tab: { alignItems: 'center', borderBottomColor: 'transparent', borderBottomWidth: 2, flex: 1, justifyContent: 'center', minHeight: 48 }, tabActive: { borderBottomColor: luxyColors.ink }, tabText: { color: luxyColors.muted, fontSize: 14.5 }, tabTextActive: { color: luxyColors.text, fontWeight: '700' },
  planSection: { borderBottomColor: luxyColors.border, borderBottomWidth: 1, marginBottom: 30, paddingBottom: 30 }, rowBetween: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' }, eyebrow: { color: luxyColors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 }, planTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 28, marginTop: 2 }, ultimate: { backgroundColor: luxyColors.ink, borderRadius: 4, color: '#FFF', fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 6 }, planDescription: { color: luxyColors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 8 }, feature: { color: luxyColors.text, fontSize: 12.5, lineHeight: 18 },
  planOption: { alignItems: 'center', backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 76, padding: 13 }, planOptionSelected: { backgroundColor: '#FFF7F7', borderColor: luxyColors.brandCoral, borderWidth: 1.5 }, radio: { alignItems: 'center', borderColor: luxyColors.softMuted, borderRadius: 10, borderWidth: 1.5, height: 20, justifyContent: 'center', width: 20 }, radioSelected: { borderColor: luxyColors.brandCoral }, radioDot: { backgroundColor: luxyColors.brandCoral, borderRadius: 5, height: 10, width: 10 }, optionTitle: { color: luxyColors.text, fontSize: 14.5, fontWeight: '700' }, discountBadge: { backgroundColor: luxyColors.brandCoral, borderRadius: 3, color: '#FFF', fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3 }, optionMeta: { color: luxyColors.muted, fontSize: 11.5, marginTop: 3 }, optionHeart: { color: luxyColors.text, fontSize: 11.5, fontWeight: '600', marginTop: 4 }, optionAmount: { color: luxyColors.text, fontSize: 14, fontWeight: '700' },
  ctaCard: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: 8, borderWidth: 1, marginBottom: 34, padding: 18, ...luxyShadows.card }, ctaPlan: { color: luxyColors.text, fontSize: 16, fontWeight: '700', marginTop: 3 }, ctaAmount: { color: luxyColors.text, fontSize: 18, fontWeight: '700' }, discountText: { color: luxyColors.brandCoral, fontSize: 12, fontWeight: '700', marginTop: 10 }, heartText: { color: luxyColors.text, fontSize: 12, marginTop: 7 },
  primaryButton: { alignItems: 'center', backgroundColor: luxyColors.actionRed, borderRadius: luxyRadii.pill, justifyContent: 'center', marginTop: 16, minHeight: 50, paddingHorizontal: 20 }, primaryButtonText: { color: '#FFF', fontSize: 14.5, fontWeight: '700' }, secondaryButton: { alignItems: 'center', backgroundColor: luxyColors.surface, borderColor: luxyColors.ink, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', marginTop: 13, minHeight: 46, paddingHorizontal: 18 }, secondaryButtonText: { color: luxyColors.ink, fontSize: 13, fontWeight: '700' }, disabled: { opacity: 0.5 }, note: { color: luxyColors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 10, textAlign: 'center' },
  section: { marginBottom: 34 }, sectionTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 22, lineHeight: 28, marginBottom: 14 }, compareHeader: { backgroundColor: luxyColors.subtleSurface, borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 46, paddingHorizontal: 8 }, compareRow: { borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 54, paddingHorizontal: 8 }, compareFeature: { alignSelf: 'center', color: luxyColors.text, flex: 1.35, fontSize: 11.5 }, compareValueHead: { alignSelf: 'center', color: luxyColors.text, flex: 0.8, fontSize: 11.5, fontWeight: '700', textAlign: 'center' }, compareValue: { alignSelf: 'center', color: luxyColors.text, flex: 0.8, fontSize: 11, textAlign: 'center' },
  historyRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 70, paddingVertical: 9 }, historyTitle: { color: luxyColors.text, fontSize: 13, fontWeight: '700' }, historyMeta: { color: luxyColors.muted, fontSize: 10.5, lineHeight: 16, marginTop: 3 }, privacyRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 64, paddingVertical: 8 }, privacyLabel: { color: luxyColors.text, fontSize: 13, fontWeight: '600' },
  emptyBox: { alignItems: 'center', borderColor: luxyColors.border, borderWidth: 1, padding: 30 }, loading: { alignItems: 'center', gap: 10, justifyContent: 'center', minHeight: 120 }, muted: { color: luxyColors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }, error: { color: luxyColors.danger, fontSize: 12, padding: 14, textAlign: 'center' }, errorBanner: { backgroundColor: '#FFF4F4', borderColor: '#F3B4B4', borderWidth: 1, color: luxyColors.danger, fontSize: 12, marginBottom: 24, padding: 12 },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.58)', flex: 1, justifyContent: 'center', padding: 16 }, modalCard: { backgroundColor: luxyColors.surface, borderRadius: 8, maxHeight: '92%', maxWidth: 466, minHeight: 240, position: 'relative', width: '100%', ...luxyShadows.card }, close: { alignItems: 'center', height: 42, justifyContent: 'center', position: 'absolute', right: 5, top: 5, width: 42, zIndex: 10 }, closeText: { color: luxyColors.ink, fontSize: 28, fontWeight: '300' }, checkoutContent: { padding: 26, paddingTop: 34 }, checkoutTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 27, textAlign: 'center' }, checkoutStatus: { color: luxyColors.muted, fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' }, qrImage: { alignSelf: 'center', height: 248, marginVertical: 14, width: 248 }, checkoutSummary: { borderTopColor: luxyColors.border, borderTopWidth: 1, marginTop: 8 }, checkoutRow: { alignItems: 'center', borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, minHeight: 55, paddingVertical: 8 }, checkoutLabel: { color: luxyColors.muted, fontSize: 10.5 }, checkoutValue: { color: luxyColors.text, fontSize: 13, fontWeight: '600', marginTop: 2 }, copyButton: { borderColor: luxyColors.border, borderRadius: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 }, copyText: { color: luxyColors.ink, fontSize: 10.5, fontWeight: '700' }, waiting: { alignItems: 'center', backgroundColor: luxyColors.subtleSurface, gap: 9, marginTop: 16, padding: 16 }, stateBox: { backgroundColor: '#FFFBEB', borderColor: '#F2B51D', borderWidth: 1, marginTop: 16, padding: 14 }, stateSuccess: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }, notice: { color: luxyColors.text, fontSize: 11.5, marginTop: 12, textAlign: 'center' }, footnote: { color: luxyColors.muted, fontSize: 10.5, lineHeight: 16, marginTop: 14, textAlign: 'center' },
});
