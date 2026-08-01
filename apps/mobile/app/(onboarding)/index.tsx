import { colors, spacing } from '@myfan/ui';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/screen';
import {
  completeMinimumOnboarding,
  getMyOnboardingStatus,
  getReadableOnboardingError,
} from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';

type DatePickerField = 'day' | 'month' | 'year';
type DatePickerOption = { label: string; value: number };

const MINIMUM_BIRTH_YEAR = 1900;
const CURRENT_YEAR = new Date().getFullYear();
const LATEST_ELIGIBLE_BIRTH_YEAR = CURRENT_YEAR - 18;
const YEAR_OPTIONS = Array.from(
  { length: LATEST_ELIGIBLE_BIRTH_YEAR - MINIMUM_BIRTH_YEAR + 1 },
  (_, index) => LATEST_ELIGIBLE_BIRTH_YEAR - index,
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

export default function OnboardingHome() {
  const router = useRouter();
  const auth = useAuth();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [activeDatePicker, setActiveDatePicker] = useState<DatePickerField | null>(null);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCommunityStandards, setAcceptedCommunityStandards] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const maximumDay = useMemo(
    () => getDaysInMonth(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );

  const dateOfBirth = useMemo(() => {
    if (!selectedDay || !selectedMonth || !selectedYear) return '';
    return `${selectedYear}-${padDatePart(selectedMonth)}-${padDatePart(selectedDay)}`;
  }, [selectedDay, selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectedDay && selectedDay > maximumDay) setSelectedDay(maximumDay);
  }, [maximumDay, selectedDay]);

  useEffect(() => {
    if (auth.isRestoring) return;
    if (!auth.userId) {
      router.replace('/(auth)');
      return;
    }
    let active = true;
    void getMyOnboardingStatus()
      .then((status) => {
        if (!active) return;
        if (status?.account_status && status.account_status !== 'active') {
          setAccountStatus(status.account_status);
        } else if (status?.age_verified && status.policies_accepted) {
          router.replace('/(tabs)');
        }
      })
      .catch((error) => {
        if (active) setErrorMessage(getReadableOnboardingError(error));
      })
      .finally(() => {
        if (active) setIsChecking(false);
      });
    return () => {
      active = false;
    };
  }, [auth.isRestoring, auth.userId, router]);

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await completeMinimumOnboarding({
        dateOfBirth,
        confirmedAdult,
        acceptedTerms,
        acceptedCommunityStandards,
      });
      router.replace('/(tabs)');
    } catch (error) {
      setErrorMessage(getReadableOnboardingError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDateSelection(field: DatePickerField, value: number) {
    if (field === 'day') setSelectedDay(value);
    if (field === 'month') setSelectedMonth(value);
    if (field === 'year') setSelectedYear(value);
    setActiveDatePicker(null);
  }

  const pickerOptions = getPickerOptions(activeDatePicker, maximumDay);
  const selectedPickerValue = getSelectedPickerValue(
    activeDatePicker,
    selectedDay,
    selectedMonth,
    selectedYear,
  );

  if (isChecking || auth.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Đang kiểm tra điều kiện 18+…</Text>
      </View>
    );
  }

  if (accountStatus) {
    const deletionRequested = accountStatus === 'deletion_requested';
    return (
      <Screen
        title={deletionRequested ? 'Tài khoản đang chờ xóa' : 'Tài khoản chưa thể truy cập'}
        description={
          deletionRequested
            ? 'Hồ sơ và tính năng xã hội đang tắt. Bạn có thể xem trạng thái hoặc hủy yêu cầu nếu vẫn còn trong thời gian cho phép.'
            : 'Tài khoản đang bị đình chỉ hoặc vô hiệu hóa. Gửi lại onboarding không thể tự mở khóa tài khoản.'
        }
      >
        {deletionRequested ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/account-deletion')}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Xem hoặc hủy yêu cầu xóa</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Đăng xuất</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <>
      <Screen
        title="Xác nhận bạn từ đủ 18 tuổi"
        description="Ngày sinh là dữ liệu riêng tư, không hiển thị trên hồ sơ công khai."
      >
        <Text style={styles.label}>Ngày sinh</Text>
        <View accessibilityLabel="Chọn ngày sinh" style={styles.dateFields}>
          <DateSelectField
            label="Ngày"
            placeholder="Ngày"
            value={selectedDay ? String(selectedDay) : null}
            onPress={() => setActiveDatePicker('day')}
          />
          <DateSelectField
            label="Tháng"
            placeholder="Tháng"
            value={selectedMonth ? String(selectedMonth) : null}
            onPress={() => setActiveDatePicker('month')}
          />
          <DateSelectField
            label="Năm"
            placeholder="Năm"
            value={selectedYear ? String(selectedYear) : null}
            onPress={() => setActiveDatePicker('year')}
            wide
          />
        </View>
        <Text style={styles.hint}>
          Chạm vào từng ô và cuộn để chọn Ngày – Tháng – Năm. MyFan không cho phép người dưới 18 tuổi sử dụng ứng dụng.
        </Text>

        <PolicyCheck
          checked={confirmedAdult}
          label="Tôi xác nhận mình từ đủ 18 tuổi và thông tin ngày sinh là chính xác."
          onPress={() => setConfirmedAdult((value) => !value)}
        />
        <PolicyCheck
          checked={acceptedTerms}
          label="Tôi đã đọc và chấp nhận Điều khoản sử dụng hiện hành."
          onPress={() => setAcceptedTerms((value) => !value)}
        />
        <Link href="/legal/terms" style={styles.link}>Xem Điều khoản sử dụng</Link>
        <PolicyCheck
          checked={acceptedCommunityStandards}
          label="Tôi đã đọc và chấp nhận Tiêu chuẩn cộng đồng hiện hành."
          onPress={() => setAcceptedCommunityStandards((value) => !value)}
        />
        <Link href="/legal/community-standards" style={styles.link}>Xem Tiêu chuẩn cộng đồng</Link>

        {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isSubmitting && styles.disabled]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>Hoàn tất xác nhận 18+</Text>
          )}
        </Pressable>
      </Screen>

      <DatePickerModal
        field={activeDatePicker}
        options={pickerOptions}
        selectedValue={selectedPickerValue}
        onClose={() => setActiveDatePicker(null)}
        onSelect={(value) => {
          if (activeDatePicker) handleDateSelection(activeDatePicker, value);
        }}
      />
    </>
  );
}

function DateSelectField({
  label,
  placeholder,
  value,
  onPress,
  wide = false,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <View style={[styles.dateFieldWrapper, wide && styles.dateFieldWrapperWide]}>
      <Text style={styles.dateFieldLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={`Chọn ${label.toLowerCase()} sinh`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.dateField, pressed && styles.dateFieldPressed]}
      >
        <Text style={value ? styles.dateFieldValue : styles.dateFieldPlaceholder}>
          {value ?? placeholder}
        </Text>
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.dateFieldChevron}>⌄</Text>
      </Pressable>
    </View>
  );
}

function DatePickerModal({
  field,
  options,
  selectedValue,
  onClose,
  onSelect,
}: {
  field: DatePickerField | null;
  options: DatePickerOption[];
  selectedValue: number | null;
  onClose: () => void;
  onSelect: (value: number) => void;
}) {
  const title = field === 'day' ? 'Chọn ngày' : field === 'month' ? 'Chọn tháng' : 'Chọn năm';

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={field !== null}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Đóng danh sách chọn ngày sinh"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.modalBackdrop}
        />
        <View accessibilityViewIsModal style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.modalTitle}>{title}</Text>
            <Pressable
              accessibilityLabel="Đóng"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.modalHint}>Cuộn danh sách và chạm để chọn.</Text>
          <ScrollView
            contentContainerStyle={styles.optionList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {options.map((option) => {
              const selected = option.value === selectedValue;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  style={({ pressed }) => [
                    styles.optionButton,
                    selected && styles.optionButtonSelected,
                    pressed && styles.optionButtonPressed,
                  ]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                  {selected ? <Text style={styles.optionCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PolicyCheck({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.checkRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        <Text style={styles.checkmark}>{checked ? '✓' : ''}</Text>
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

function getDaysInMonth(year: number | null, month: number | null): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function getPickerOptions(
  field: DatePickerField | null,
  maximumDay: number,
): DatePickerOption[] {
  if (field === 'day') {
    return Array.from({ length: maximumDay }, (_, index) => ({
      label: `Ngày ${index + 1}`,
      value: index + 1,
    }));
  }
  if (field === 'month') {
    return MONTH_OPTIONS.map((month) => ({ label: `Tháng ${month}`, value: month }));
  }
  if (field === 'year') {
    return YEAR_OPTIONS.map((year) => ({ label: String(year), value: year }));
  }
  return [];
}

function getSelectedPickerValue(
  field: DatePickerField | null,
  day: number | null,
  month: number | null,
  year: number | null,
): number | null {
  if (field === 'day') return day;
  if (field === 'month') return month;
  if (field === 'year') return year;
  return null;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
  loadingText: { color: colors.muted, fontSize: 15 },
  label: { color: colors.text, fontSize: 15, fontWeight: '800' },
  dateFields: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  dateFieldWrapper: { flex: 1 },
  dateFieldWrapperWide: { flex: 1.25 },
  dateFieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs },
  dateField: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateFieldPressed: { borderColor: colors.primary, backgroundColor: '#F7F4FF' },
  dateFieldValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  dateFieldPlaceholder: { color: colors.muted, fontSize: 15 },
  dateFieldChevron: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.md },
  checkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  checkLabel: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 21 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700', marginLeft: 32, marginBottom: spacing.sm },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  primaryButton: { minHeight: 52, marginTop: spacing.lg, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.lg },
  primaryButtonText: { color: colors.surface, fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 50, marginTop: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18, 15, 31, 0.56)' },
  modalCard: { width: '100%', maxWidth: 420, maxHeight: '72%', borderRadius: 22, padding: spacing.lg, backgroundColor: colors.surface, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  modalCloseButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  modalCloseText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  modalHint: { color: colors.muted, fontSize: 13, marginTop: spacing.xs, marginBottom: spacing.md },
  optionList: { gap: spacing.xs, paddingBottom: spacing.sm },
  optionButton: { minHeight: 50, borderRadius: 14, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderWidth: 1, borderColor: 'transparent' },
  optionButtonSelected: { borderColor: colors.primary, backgroundColor: '#F1ECFF' },
  optionButtonPressed: { opacity: 0.72 },
  optionText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  optionTextSelected: { color: colors.primary, fontWeight: '900' },
  optionCheck: { color: colors.primary, fontSize: 17, fontWeight: '900' },
});
