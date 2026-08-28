import {
  cancelMyWithdrawal,
  createGiftIdempotencyKey,
  formatHeartUnitBalance,
  formatVnd,
  getMyLuxyGiftWallet,
  giftCatalogQueryKeys,
  listMyPayoutBankAccounts,
  listMyWithdrawals,
  requestMyWithdrawal,
  submitMyPayoutBankAccount,
  withdrawalQueryKeys,
  withdrawalStatusLabel,
  type MyPayoutBankAccount,
  type MyWithdrawal,
} from '@myfan/supabase';
import {
  chonColors,
  chonInteraction,
  chonShadows,
  chonTypography,
  luxyRadii,
  luxySpacing,
} from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const HEART_UNITS_PER_HEART = 100;

type BankDraft = {
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
};

const EMPTY_BANK_DRAFT: BankDraft = { bankCode: '', accountNumber: '', accountHolder: '' };

export function ChonWithdrawalPanel() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [amountHearts, setAmountHearts] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankDraft, setBankDraft] = useState<BankDraft>(EMPTY_BANK_DRAFT);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const walletQuery = useQuery({
    queryKey: giftCatalogQueryKeys.wallet(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyLuxyGiftWallet(client);
    },
  });

  const bankQuery = useQuery({
    queryKey: withdrawalQueryKeys.banks(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listMyPayoutBankAccounts(client);
    },
  });

  const historyQuery = useQuery({
    queryKey: withdrawalQueryKeys.history(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listMyWithdrawals(client, 20);
    },
  });

  const verifiedBanks = useMemo(
    () => (bankQuery.data ?? []).filter((account) => account.status === 'verified'),
    [bankQuery.data],
  );
  const selectedBank = verifiedBanks.find((account) => account.id === selectedBankId)
    ?? verifiedBanks.find((account) => account.is_default)
    ?? verifiedBanks[0]
    ?? null;
  const requestedUnits = parseHeartAmountToUnits(amountHearts);
  const wallet = walletQuery.data;
  const minimumUnits = wallet?.minimum_withdrawal_units ?? 0;
  const amountValid = requestedUnits !== null
    && requestedUnits >= minimumUnits
    && requestedUnits <= (wallet?.reward_available_units ?? 0);
  const withdrawalReady = Boolean(wallet?.withdrawal_ready && selectedBank && amountValid);

  async function refreshWithdrawalSurface() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: giftCatalogQueryKeys.wallet(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: withdrawalQueryKeys.banks(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: withdrawalQueryKeys.history(auth.userId) }),
    ]);
  }

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!client || !selectedBank || requestedUnits === null) throw new Error('withdrawal_not_ready');
      return requestMyWithdrawal(client, {
        bankAccountId: selectedBank.id,
        requestedRewardUnits: requestedUnits,
        idempotencyKey: createGiftIdempotencyKey(),
      });
    },
    onMutate: () => {
      setNotice(null);
      setErrorMessage(null);
    },
    onSuccess: async (result) => {
      setAmountHearts('');
      setNotice(`Yêu cầu rút ${formatVnd(result.amount_vnd)} đã được gửi và đang chờ xử lý.`);
      await refreshWithdrawalSurface();
    },
    onError: (error) => setErrorMessage(getWithdrawalErrorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: async (withdrawalId: string) => {
      if (!client) throw new Error('supabase_not_configured');
      return cancelMyWithdrawal(client, {
        withdrawalId,
        requestId: createGiftIdempotencyKey(),
      });
    },
    onMutate: () => {
      setNotice(null);
      setErrorMessage(null);
    },
    onSuccess: async () => {
      setNotice('Yêu cầu rút tiền đã được hủy. Số dư khả dụng đã được hoàn lại.');
      await refreshWithdrawalSurface();
    },
    onError: (error) => setErrorMessage(getWithdrawalErrorMessage(error)),
  });

  const bankMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return submitMyPayoutBankAccount(client, {
        ...bankDraft,
        isDefault: true,
        requestId: createGiftIdempotencyKey(),
      });
    },
    onMutate: () => {
      setNotice(null);
      setErrorMessage(null);
    },
    onSuccess: async () => {
      setBankDraft(EMPTY_BANK_DRAFT);
      setNotice('Tài khoản ngân hàng đã được gửi xác minh. Bạn có thể rút tiền sau khi tài khoản được duyệt.');
      await refreshWithdrawalSurface();
    },
    onError: (error) => setErrorMessage(getWithdrawalErrorMessage(error)),
  });

  if (walletQuery.isLoading || bankQuery.isLoading || historyQuery.isLoading) {
    return (
      <View style={styles.panel} testID="withdrawal-panel">
        <ActivityIndicator color={chonColors.primaryRed} />
        <Text style={styles.muted}>Đang tải thông tin rút tiền…</Text>
      </View>
    );
  }

  if (walletQuery.isError || bankQuery.isError || historyQuery.isError || !wallet) {
    return (
      <View style={styles.panel} testID="withdrawal-panel">
        <Text accessibilityRole="alert" style={styles.error}>Không thể tải thông tin rút tiền.</Text>
        <Pressable accessibilityRole="button" onPress={() => void Promise.all([walletQuery.refetch(), bankQuery.refetch(), historyQuery.refetch()])} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.panel} testID="withdrawal-panel">
      <View style={styles.headingBlock}>
        <Text style={styles.eyebrow}>RÚT TIỀN</Text>
        <Text style={styles.title}>Quà tặng có thể rút</Text>
        <Text style={styles.available} testID="withdrawal-available-balance">
          {formatHeartUnitBalance(wallet.reward_available_units)}
        </Text>
        <Text style={styles.muted}>
          Tối thiểu {formatHeartUnitBalance(wallet.minimum_withdrawal_units)}. Quà mới nhận chỉ chuyển sang số dư khả dụng sau thời gian giữ {wallet.reward_hold_days} ngày.
        </Text>
      </View>

      <EligibilityRow ready={wallet.kyc_approved} label="Xác minh danh tính" readyText="Đã xác minh" blockedText="Chưa được duyệt" />
      <EligibilityRow ready={wallet.verified_bank_available} label="Tài khoản ngân hàng" readyText="Đã xác minh" blockedText="Chưa có tài khoản đã xác minh" />
      <EligibilityRow ready={!wallet.reward_frozen} label="Trạng thái số dư" readyText="Sẵn sàng" blockedText="Đang tạm khóa" />

      {verifiedBanks.length ? (
        <View style={styles.formBlock}>
          <Text style={styles.label}>Nhận tiền về</Text>
          <View accessibilityRole="radiogroup" style={styles.bankList}>
            {verifiedBanks.map((account) => (
              <BankChoice
                account={account}
                key={account.id}
                onPress={() => setSelectedBankId(account.id)}
                selected={selectedBank?.id === account.id}
              />
            ))}
          </View>
        </View>
      ) : (
        <BankAccountForm
          draft={bankDraft}
          loading={bankMutation.isPending}
          onChange={setBankDraft}
          onSubmit={() => void bankMutation.mutate()}
        />
      )}

      <View style={styles.formBlock}>
        <Text style={styles.label}>Số ❤️ muốn rút</Text>
        <TextInput
          accessibilityLabel="Số tim muốn rút"
          inputMode="decimal"
          keyboardType="decimal-pad"
          onChangeText={setAmountHearts}
          placeholder="Ví dụ: 10"
          placeholderTextColor={chonColors.muted}
          style={styles.input}
          testID="withdrawal-amount-input"
          value={amountHearts}
        />
        {amountHearts && !amountValid ? (
          <Text accessibilityRole="alert" style={styles.inlineError}>
            {requestedUnits !== null && requestedUnits < minimumUnits
              ? `Mức rút tối thiểu là ${formatHeartUnitBalance(minimumUnits)}.`
              : `Số dư có thể rút hiện tại là ${formatHeartUnitBalance(wallet.reward_available_units)}.`}
          </Text>
        ) : null}
      </View>

      {!wallet.kyc_approved ? (
        <Text style={styles.blocker}>Bạn cần hoàn tất xác minh danh tính trước khi gửi yêu cầu rút tiền.</Text>
      ) : null}
      {wallet.kyc_approved && !wallet.verified_bank_available ? (
        <Text style={styles.blocker}>Tài khoản ngân hàng cần được xác minh trước khi có thể nhận tiền.</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !withdrawalReady || requestMutation.isPending }}
        disabled={!withdrawalReady || requestMutation.isPending}
        onPress={() => void requestMutation.mutate()}
        style={({ pressed }) => [
          styles.primaryButton,
          (!withdrawalReady || requestMutation.isPending) && styles.disabled,
          pressed && withdrawalReady && styles.primaryButtonPressed,
        ]}
        testID="withdrawal-submit"
      >
        {requestMutation.isPending ? <ActivityIndicator color={chonColors.surface} /> : <Text style={styles.primaryButtonText}>Gửi yêu cầu rút tiền</Text>}
      </Pressable>

      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

      <WithdrawalHistory
        cancellingId={cancelMutation.variables ?? null}
        items={historyQuery.data ?? []}
        onCancel={(withdrawalId) => void cancelMutation.mutate(withdrawalId)}
      />
    </View>
  );
}

function EligibilityRow(props: { ready: boolean; label: string; readyText: string; blockedText: string }) {
  return (
    <View style={styles.eligibilityRow}>
      <Text style={styles.eligibilityLabel}>{props.label}</Text>
      <Text style={[styles.eligibilityStatus, props.ready ? styles.ready : styles.blocked]}>
        {props.ready ? props.readyText : props.blockedText}
      </Text>
    </View>
  );
}

function BankChoice(props: { account: MyPayoutBankAccount; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      aria-checked={props.selected}
      accessibilityLabel={`${props.account.bank_code}, tài khoản kết thúc ${props.account.account_number_last4}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [styles.bankChoice, props.selected && styles.bankChoiceSelected, pressed && styles.bankChoicePressed]}
    >
      <Text style={styles.bankCode}>{props.account.bank_code}</Text>
      <Text style={styles.bankNumber}>•••• {props.account.account_number_last4}</Text>
      {props.account.is_default ? <Text style={styles.defaultTag}>Mặc định</Text> : null}
    </Pressable>
  );
}

function BankAccountForm(props: {
  draft: BankDraft;
  loading: boolean;
  onChange: (draft: BankDraft) => void;
  onSubmit: () => void;
}) {
  const valid = /^[A-Za-z0-9_-]{2,32}$/u.test(props.draft.bankCode.trim())
    && /^\d{4,34}$/u.test(props.draft.accountNumber.replace(/\s+/gu, ''))
    && props.draft.accountHolder.trim().length >= 2;
  return (
    <View style={styles.bankForm} testID="withdrawal-bank-form">
      <Text style={styles.formTitle}>Thêm tài khoản nhận tiền</Text>
      <TextInput
        accessibilityLabel="Mã ngân hàng"
        autoCapitalize="characters"
        onChangeText={(bankCode) => props.onChange({ ...props.draft, bankCode })}
        placeholder="Mã ngân hàng, ví dụ VCB"
        placeholderTextColor={chonColors.muted}
        style={styles.input}
        value={props.draft.bankCode}
      />
      <TextInput
        accessibilityLabel="Số tài khoản ngân hàng"
        inputMode="numeric"
        keyboardType="number-pad"
        onChangeText={(accountNumber) => props.onChange({ ...props.draft, accountNumber })}
        placeholder="Số tài khoản"
        placeholderTextColor={chonColors.muted}
        style={styles.input}
        value={props.draft.accountNumber}
      />
      <TextInput
        accessibilityLabel="Tên chủ tài khoản"
        autoCapitalize="characters"
        onChangeText={(accountHolder) => props.onChange({ ...props.draft, accountHolder })}
        placeholder="Tên chủ tài khoản"
        placeholderTextColor={chonColors.muted}
        style={styles.input}
        value={props.draft.accountHolder}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid || props.loading }}
        disabled={!valid || props.loading}
        onPress={props.onSubmit}
        style={({ pressed }) => [styles.secondaryButton, (!valid || props.loading) && styles.disabled, pressed && styles.bankChoicePressed]}
      >
        {props.loading ? <ActivityIndicator color={chonColors.primaryRed} /> : <Text style={styles.secondaryButtonText}>Gửi xác minh ngân hàng</Text>}
      </Pressable>
      <Text style={styles.helper}>Thông tin đầy đủ được mã hóa phía server; màn hình chỉ hiển thị 4 số cuối sau khi gửi.</Text>
    </View>
  );
}

function WithdrawalHistory(props: {
  items: MyWithdrawal[];
  cancellingId: string | null;
  onCancel: (withdrawalId: string) => void;
}) {
  return (
    <View style={styles.history} testID="withdrawal-history">
      <Text style={styles.formTitle}>Lịch sử rút tiền</Text>
      {props.items.length === 0 ? <Text style={styles.muted}>Chưa có yêu cầu rút tiền.</Text> : null}
      {props.items.map((item) => (
        <View key={item.id} style={styles.historyRow} testID={`withdrawal-row-${item.id}`}>
          <View style={styles.historyMain}>
            <Text style={styles.historyAmount}>{formatVnd(item.amount_vnd)}</Text>
            <Text style={styles.historyMeta}>
              {formatHeartUnitBalance(item.requested_reward_units)} · {item.bank_code_snapshot} •••• {item.bank_account_last4_snapshot}
            </Text>
            <Text style={styles.historyDate}>{formatDate(item.requested_at)}</Text>
          </View>
          <View style={styles.historyAside}>
            <Text style={[styles.statusPill, statusTone(item.status)]}>{withdrawalStatusLabel(item.status)}</Text>
            {item.status === 'pending' ? (
              <Pressable
                accessibilityRole="button"
                disabled={props.cancellingId === item.id}
                onPress={() => props.onCancel(item.id)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>{props.cancellingId === item.id ? 'Đang hủy…' : 'Hủy'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function parseHeartAmountToUnits(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/u.test(normalized)) return null;
  const hearts = Number(normalized);
  if (!Number.isFinite(hearts) || hearts <= 0) return null;
  return Math.round(hearts * HEART_UNITS_PER_HEART);
}

function getWithdrawalErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('approved_kyc_required')) return 'Bạn cần hoàn tất xác minh danh tính trước khi rút tiền.';
  if (message.includes('verified_bank_account_required')) return 'Tài khoản ngân hàng chưa được xác minh.';
  if (message.includes('withdrawal_blocked_by_hold')) return 'Tài khoản đang được kiểm tra nên tạm thời chưa thể rút tiền.';
  if (message.includes('withdrawal_below_minimum')) return 'Số tiền rút chưa đạt mức tối thiểu.';
  if (message.includes('insufficient_recipient_available_balance') || message.includes('insufficient_creator_available_balance')) return 'Số dư quà tặng khả dụng không đủ.';
  if (message.includes('pending_withdrawal_required')) return 'Yêu cầu này không còn ở trạng thái có thể hủy.';
  if (message.includes('invalid_bank_submission')) return 'Thông tin ngân hàng chưa hợp lệ. Vui lòng kiểm tra lại.';
  if (message.includes('payout_profile_submit_failed')) return 'Chưa thể gửi tài khoản ngân hàng. Vui lòng thử lại.';
  if (message.includes('withdrawal_requests_enabled_disabled')) return 'Tính năng rút tiền đang tạm bảo trì.';
  return 'Chưa thể xử lý yêu cầu rút tiền. Vui lòng thử lại.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === 'paid') return styles.statusPaid;
  if (status === 'rejected' || status === 'cancelled' || status === 'reversed') return styles.statusClosed;
  return styles.statusOpen;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: chonColors.surface,
    borderColor: chonColors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginTop: 28,
    padding: 16,
    ...chonShadows.card,
  },
  headingBlock: { alignItems: 'center', gap: 4 },
  eyebrow: { color: chonColors.primaryRed, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: chonColors.goldChrome, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '800', textAlign: 'center' },
  available: { color: chonColors.text, fontSize: 24, fontWeight: '900', marginTop: 2 },
  muted: { color: chonColors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  eligibilityRow: { alignItems: 'center', borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 38 },
  eligibilityLabel: { color: chonColors.text, flex: 1, fontSize: 13, fontWeight: '700' },
  eligibilityStatus: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
  ready: { color: chonColors.goldStrong },
  blocked: { color: chonColors.danger },
  formBlock: { gap: 8 },
  label: { color: chonColors.text, fontSize: 13, fontWeight: '800' },
  input: { backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: 10, borderWidth: 1, color: chonColors.text, fontSize: 14, minHeight: 46, paddingHorizontal: 12, paddingVertical: 9 },
  inlineError: { color: chonColors.danger, fontSize: 11.5, lineHeight: 17 },
  blocker: { backgroundColor: chonColors.warmSurface, borderRadius: 10, color: chonColors.text, fontSize: 12, lineHeight: 18, padding: 10, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 48, paddingHorizontal: 20, ...chonShadows.primary },
  primaryButtonPressed: { backgroundColor: chonColors.primaryRedHover, opacity: chonInteraction.pressedOpacity, ...chonShadows.primaryHover },
  primaryButtonText: { color: chonColors.surface, fontSize: 14, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', borderColor: chonColors.goldChrome, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  secondaryButtonText: { color: chonColors.text, fontSize: 12.5, fontWeight: '800' },
  disabled: { opacity: chonInteraction.disabledOpacity },
  notice: { color: chonColors.goldStrong, fontSize: 12, fontWeight: '700', lineHeight: 18, textAlign: 'center' },
  error: { color: chonColors.danger, fontSize: 12, fontWeight: '700', lineHeight: 18, textAlign: 'center' },
  bankList: { gap: 8 },
  bankChoice: { alignItems: 'center', borderColor: chonColors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 50, paddingHorizontal: 12 },
  bankChoiceSelected: { backgroundColor: chonColors.goldChrome, borderColor: chonColors.goldChrome, borderWidth: 2 },
  bankChoicePressed: { opacity: chonInteraction.pressedOpacity },
  bankCode: { color: chonColors.text, fontSize: 13, fontWeight: '900' },
  bankNumber: { color: chonColors.text, flex: 1, fontSize: 13 },
  defaultTag: { color: chonColors.primaryRed, fontSize: 10.5, fontWeight: '800' },
  bankForm: { backgroundColor: chonColors.warmSurface, borderRadius: 12, gap: 9, padding: 12 },
  formTitle: { color: chonColors.text, fontSize: 14, fontWeight: '900' },
  helper: { color: chonColors.muted, fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
  history: { borderTopColor: chonColors.border, borderTopWidth: 1, gap: luxySpacing.sm, marginTop: 4, paddingTop: 16 },
  historyRow: { alignItems: 'flex-start', borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, paddingVertical: 10 },
  historyMain: { flex: 1, minWidth: 0 },
  historyAmount: { color: chonColors.text, fontSize: 14, fontWeight: '900' },
  historyMeta: { color: chonColors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  historyDate: { color: chonColors.muted, fontSize: 10.5, marginTop: 2 },
  historyAside: { alignItems: 'flex-end', gap: 6 },
  statusPill: { borderRadius: 999, fontSize: 10.5, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  statusOpen: { backgroundColor: chonColors.warmSurface, color: chonColors.primaryRed },
  statusPaid: { backgroundColor: chonColors.goldChrome, color: chonColors.text },
  statusClosed: { backgroundColor: chonColors.warmSurface, color: chonColors.muted },
  cancelButton: { paddingHorizontal: 8, paddingVertical: 4 },
  cancelButtonText: { color: chonColors.danger, fontSize: 11, fontWeight: '800' },
});