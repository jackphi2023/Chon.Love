import { colors, spacing } from '@myfan/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type DatePickerField = 'day' | 'month' | 'year';
type DatePickerOption = { label: string; value: number };
type ParsedDateOfBirth = { day: number; month: number; year: number };

const MINIMUM_BIRTH_YEAR = 1900;
const CURRENT_YEAR = new Date().getFullYear();
const LATEST_ELIGIBLE_BIRTH_YEAR = CURRENT_YEAR - 18;
const YEAR_OPTIONS = Array.from(
  { length: LATEST_ELIGIBLE_BIRTH_YEAR - MINIMUM_BIRTH_YEAR + 1 },
  (_, index) => LATEST_ELIGIBLE_BIRTH_YEAR - index,
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

export function DateOfBirthSelector({
  onChange,
  value,
}: {
  onChange: (dateOfBirth: string) => void;
  value?: string | null;
}) {
  const initial = parseDateOfBirth(value);
  const [selectedDay, setSelectedDay] = useState<number | null>(initial?.day ?? null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(initial?.month ?? null);
  const [selectedYear, setSelectedYear] = useState<number | null>(initial?.year ?? null);
  const [activePicker, setActivePicker] = useState<DatePickerField | null>(null);

  const maximumDay = useMemo(
    () => getDaysInMonth(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );

  useEffect(() => {
    if (value === undefined) return;
    const parsed = parseDateOfBirth(value);
    const nextDay = parsed?.day ?? null;
    const nextMonth = parsed?.month ?? null;
    const nextYear = parsed?.year ?? null;
    if (nextDay !== selectedDay) setSelectedDay(nextDay);
    if (nextMonth !== selectedMonth) setSelectedMonth(nextMonth);
    if (nextYear !== selectedYear) setSelectedYear(nextYear);
  }, [selectedDay, selectedMonth, selectedYear, value]);

  useEffect(() => {
    if (selectedDay && selectedDay > maximumDay) setSelectedDay(maximumDay);
  }, [maximumDay, selectedDay]);

  useEffect(() => {
    if (!selectedDay || !selectedMonth || !selectedYear) {
      onChange('');
      return;
    }
    const nextValue = `${selectedYear}-${padDatePart(selectedMonth)}-${padDatePart(selectedDay)}`;
    if (nextValue !== value) onChange(nextValue);
  }, [onChange, selectedDay, selectedMonth, selectedYear, value]);

  function selectValue(field: DatePickerField, selectedValue: number) {
    if (field === 'day') setSelectedDay(selectedValue);
    if (field === 'month') setSelectedMonth(selectedValue);
    if (field === 'year') setSelectedYear(selectedValue);
    setActivePicker(null);
  }

  return (
    <>
      <View accessibilityLabel="Chọn ngày sinh" style={styles.dateFields}>
        <DateSelectField
          label="Ngày"
          placeholder="Ngày"
          value={selectedDay ? String(selectedDay) : null}
          onPress={() => setActivePicker('day')}
        />
        <DateSelectField
          label="Tháng"
          placeholder="Tháng"
          value={selectedMonth ? String(selectedMonth) : null}
          onPress={() => setActivePicker('month')}
        />
        <DateSelectField
          label="Năm"
          placeholder="Năm"
          value={selectedYear ? String(selectedYear) : null}
          onPress={() => setActivePicker('year')}
          wide
        />
      </View>

      <DatePickerModal
        field={activePicker}
        options={getPickerOptions(activePicker, maximumDay)}
        selectedValue={getSelectedPickerValue(
          activePicker,
          selectedDay,
          selectedMonth,
          selectedYear,
        )}
        onClose={() => setActivePicker(null)}
        onSelect={(selectedValue) => {
          if (activePicker) selectValue(activePicker, selectedValue);
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
        accessibilityState={{ expanded: false }}
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
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={field !== null}>
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
              <Text accessibilityElementsHidden style={styles.modalCloseText}>✕</Text>
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
                  accessibilityLabel={option.label}
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
                  {selected ? <Text accessibilityElementsHidden style={styles.optionCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function parseDateOfBirth(value: string | null | undefined): ParsedDateOfBirth | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < MINIMUM_BIRTH_YEAR || year > LATEST_ELIGIBLE_BIRTH_YEAR || month < 1 || month > 12) return null;
  if (day < 1 || day > getDaysInMonth(year, month)) return null;
  return { day, month, year };
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
  dateFields: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  dateFieldWrapper: { flex: 1 },
  dateFieldWrapperWide: { flex: 1.25 },
  dateFieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs },
  dateField: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateFieldPressed: { borderColor: colors.primary, backgroundColor: '#F7F4FF' },
  dateFieldValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  dateFieldPlaceholder: { color: colors.muted, fontSize: 16 },
  dateFieldChevron: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(18, 15, 31, 0.56)' },
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
