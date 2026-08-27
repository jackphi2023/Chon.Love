import { luxyColors, luxyRadii, luxyTypography } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import { ChonBrandIcon } from '@/components/chon-brand-icon';
import { PublicFooter, PublicHeader } from '@/components/public-site-chrome';

type SignupShellProps = PropsWithChildren<{
  title: string;
  description?: string;
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  rightAction?: ReactNode;
  testID?: string;
}>;

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export type SignupSelectOption = {
  value: string;
  label: string;
};

const SIGNUP_COMPACT_BREAKPOINT = 768;

export function formatSignupProgressLabel(step: number, totalSteps: number): string {
  const safeTotal = Math.max(1, Math.floor(totalSteps));
  const safeStep = Math.min(Math.max(1, Math.floor(step)), safeTotal);
  return `Thiết lập hồ sơ · Bước ${safeStep}/${safeTotal}`;
}

export function SignupShell({
  title,
  description,
  step,
  totalSteps = 8,
  onBack,
  rightAction,
  children,
  testID,
}: SignupShellProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < SIGNUP_COMPACT_BREAKPOINT;

  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      <PublicHeader compact={compact} onHome={() => router.replace('/')} variant="solid" />
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, compact && styles.contentCompact]}>
          {typeof step === 'number' ? (
            <ProfileSetupProgress
              compact={compact}
              onBack={onBack}
              rightAction={rightAction}
              step={step}
              totalSteps={totalSteps}
            />
          ) : null}
          <View style={styles.headingBlock}>
            <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          <View style={styles.body}>{children}</View>
        </View>
        <PublicFooter
          compact={compact}
          onCommunity={() => router.push('/legal/community-standards')}
          onTerms={() => router.push('/legal/terms')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export function ProfileSetupProgress({
  compact,
  step,
  totalSteps,
  onBack,
  rightAction,
}: {
  compact: boolean;
  step: number;
  totalSteps: number;
  onBack?: (() => void) | undefined;
  rightAction?: ReactNode | undefined;
}) {
  const safeTotal = Math.max(1, Math.floor(totalSteps));
  const safeStep = Math.min(Math.max(1, Math.floor(step)), safeTotal);
  const progress = `${Math.round((safeStep / safeTotal) * 100)}%` as `${number}%`;
  const progressLabel = formatSignupProgressLabel(safeStep, safeTotal);

  return (
    <View style={styles.progressWrap} testID="profile-setup-progress">
      <View style={styles.progressTopRow}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Quay lại bước trước"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text accessibilityElementsHidden style={styles.backArrow}>←</Text>
          </Pressable>
        ) : <View style={styles.progressSideSpacer} />}
        <Text accessibilityLiveRegion="polite" style={styles.progressLabel}>{progressLabel}</Text>
        <View style={styles.progressRight}>{rightAction ?? <View style={styles.progressSideSpacer} />}</View>
      </View>
      <View style={styles.progressBarRow}>
        <View
          accessibilityLabel={progressLabel}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: safeTotal, now: safeStep, text: `Bước ${safeStep}/${safeTotal}` }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: progress }]} />
        </View>
        <View accessible={false} importantForAccessibility="no">
          <ChonBrandIcon name="favorite" size={compact ? 18 : 20} />
        </View>
      </View>
    </View>
  );
}

export function SignupPrimaryButton({ label, onPress, disabled = false, busy = false }: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: inactive }}
      disabled={inactive}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        hovered && !inactive && styles.primaryButtonHovered,
        pressed && !inactive && styles.primaryButtonPressed,
        inactive && styles.buttonDisabled,
      ]}
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

export function SignupSecondaryButton({ label, onPress, disabled = false, busy = false }: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: inactive }}
      disabled={inactive}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        hovered && !inactive && styles.secondaryButtonHovered,
        pressed && !inactive && styles.secondaryButtonPressed,
        inactive && styles.secondaryButtonDisabled,
      ]}
    >
      {busy ? <ActivityIndicator color={inactive ? '#6B7280' : '#FFFFFF'} /> : (
        <Text style={[styles.secondaryButtonText, (hovered && !inactive) && styles.secondaryButtonTextHovered, inactive && styles.secondaryButtonTextDisabled]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SignupFieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {children}{required ? <Text style={styles.required}>*</Text> : null}
    </Text>
  );
}

export function SignupHelpText({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'danger' | 'success';
}) {
  const danger = tone === 'danger';
  const success = tone === 'success';
  return (
    <Text
      accessibilityLiveRegion={danger ? 'assertive' : success ? 'polite' : 'none'}
      accessibilityRole={danger ? 'alert' : undefined}
      style={[styles.helpText, danger && styles.helpDanger, success && styles.helpSuccess]}
    >
      {children}
    </Text>
  );
}

export function SignupTextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={luxyColors.softMuted}
      {...props}
      style={[styles.input, props.multiline && styles.multilineInput, props.style]}
    />
  );
}

function resolveSignupSelectLabel(value: string, options: readonly SignupSelectOption[]): string {
  const selected = options.find((option) => option.value === value);
  if (selected) return selected.label;
  if (!value) return options[0]?.label ?? 'Chọn';

  const patterned = options.find((option) => option.value && option.label.includes(option.value));
  return patterned ? patterned.label.replace(patterned.value, value) : value;
}

export function SignupSelect({
  value,
  options,
  onChange,
  disabled = false,
  accessibilityLabel,
  testID,
}: {
  value: string;
  options: readonly SignupSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(
    () => resolveSignupSelectLabel(value, options),
    [options, value],
  );

  return (
    <>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.select, pressed && !disabled && styles.selectPressed, disabled && styles.selectDisabled]}
        testID={testID}
      >
        <Text numberOfLines={1} style={[styles.selectText, !value && styles.selectPlaceholder]}>{selectedLabel}</Text>
        <Text accessibilityElementsHidden style={styles.selectChevron}>⌄</Text>
      </Pressable>
      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Đóng danh sách lựa chọn"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={styles.modalDismissLayer}
          />
          <View accessibilityViewIsModal style={styles.selectModal}>
            <View style={styles.selectModalHeader}>
              <Text accessibilityRole="header" style={styles.selectModalTitle}>{accessibilityLabel ?? 'Chọn giá trị'}</Text>
              <Pressable accessibilityLabel="Đóng danh sách" accessibilityRole="button" onPress={() => setOpen(false)} style={styles.selectCloseButton}>
                <Text accessibilityElementsHidden style={styles.selectCloseText}>×</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.selectOptionsScroll}>
              {options.map((option) => {
                const selectedOption = option.value === value;
                return (
                  <Pressable
                    accessibilityLabel={option.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedOption }}
                    key={`${option.value}:${option.label}`}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [styles.selectOption, selectedOption && styles.selectOptionSelected, pressed && styles.selectOptionPressed]}
                  >
                    <Text style={[styles.selectOptionText, selectedOption && styles.selectOptionTextSelected]}>{option.label}</Text>
                    {selectedOption ? <Text accessibilityElementsHidden style={styles.selectCheck}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function SignupTag({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tag,
        selected && styles.tagSelected,
        pressed && !disabled && styles.tagPressed,
        disabled && styles.tagDisabled,
      ]}
    >
      <Text style={[styles.tagText, selected && styles.tagTextSelected, disabled && styles.tagTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

export function SignupCharacterCount({ current, max, valid }: { current: number; max: number; valid?: boolean }) {
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.characterCount, valid === true && styles.helpSuccess, valid === false && styles.helpDanger]}>
      {current}/{max} ký tự
    </Text>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFFFFF', flex: 1 },
  page: { backgroundColor: '#FFFDFC', flexGrow: 1 },
  content: {
    alignSelf: 'center',
    maxWidth: 760,
    minHeight: 620,
    paddingBottom: 64,
    paddingHorizontal: 32,
    paddingTop: 28,
    width: '100%',
  },
  contentCompact: { minHeight: 560, paddingBottom: 48, paddingHorizontal: 18, paddingTop: 18 },
  progressWrap: { marginBottom: 22 },
  progressTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backArrow: { color: luxyColors.ink, fontSize: 27, fontWeight: '400', lineHeight: 30 },
  progressSideSpacer: { width: 44 },
  progressRight: { alignItems: 'flex-end', minWidth: 44 },
  progressLabel: { color: luxyColors.actionRed, flex: 1, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  progressBarRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  progressTrack: { backgroundColor: '#F5D8D8', borderRadius: 999, flex: 1, height: 6, overflow: 'hidden' },
  progressFill: { backgroundColor: '#FF4A4A', borderRadius: 999, height: 6 },
  headingBlock: { marginBottom: 22 },
  title: {
    color: luxyColors.ink,
    fontFamily: luxyTypography.families.display,
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: -0.7,
    lineHeight: 40,
  },
  titleCompact: { fontSize: 29, lineHeight: 36 },
  description: { color: luxyColors.muted, fontSize: 15, lineHeight: 23, marginTop: 8 },
  body: { gap: 14 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#D92D2A',
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 22,
    width: '100%',
  },
  primaryButtonHovered: {
    backgroundColor: luxyColors.actionRed,
    shadowColor: '#C81C1D',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 9,
    elevation: 4,
  },
  primaryButtonPressed: { backgroundColor: luxyColors.actionRed, transform: [{ scale: 0.995 }] },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#F8C9D4',
    borderColor: '#F3A9BA',
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 22,
    width: '100%',
  },
  secondaryButtonHovered: { backgroundColor: luxyColors.actionRed, borderColor: luxyColors.actionRed },
  secondaryButtonPressed: { backgroundColor: luxyColors.actionRed },
  secondaryButtonText: { color: '#7A2437', fontSize: 16, fontWeight: '800' },
  secondaryButtonTextHovered: { color: '#FFFFFF' },
  secondaryButtonDisabled: { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' },
  secondaryButtonTextDisabled: { color: '#8B929B' },
  buttonDisabled: { backgroundColor: '#D1D5DB', opacity: 0.78 },
  fieldLabel: { color: luxyColors.ink, fontSize: 15, fontWeight: '800', lineHeight: 21, marginTop: 4 },
  required: { color: luxyColors.danger },
  helpText: { color: luxyColors.muted, fontSize: 11.5, lineHeight: 17 },
  helpDanger: { color: luxyColors.danger },
  helpSuccess: { color: '#15803D' },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#AEB5BB',
    borderRadius: 10,
    borderWidth: 1,
    color: luxyColors.ink,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  multilineInput: { minHeight: 132, textAlignVertical: 'top' },
  select: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#AEB5BB',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  selectPressed: { borderColor: luxyColors.actionRed },
  selectDisabled: { backgroundColor: '#F3F4F6', opacity: 0.72 },
  selectText: { color: luxyColors.ink, flex: 1, fontSize: 16, lineHeight: 22 },
  selectPlaceholder: { color: luxyColors.softMuted },
  selectChevron: { color: '#6B7280', fontSize: 20, marginLeft: 10, marginTop: -5 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(17,24,39,0.42)', flex: 1, justifyContent: 'center', padding: 18, position: 'relative' },
  modalDismissLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  selectModal: { backgroundColor: '#FFFFFF', borderRadius: 16, maxHeight: '78%', maxWidth: 520, overflow: 'hidden', width: '100%' },
  selectModalHeader: { alignItems: 'center', borderBottomColor: '#E5E7EB', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 16 },
  selectModalTitle: { color: luxyColors.ink, flex: 1, fontSize: 16, fontWeight: '800' },
  selectCloseButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  selectCloseText: { color: '#4B5563', fontSize: 28, lineHeight: 30 },
  selectOptionsScroll: { maxHeight: 480 },
  selectOption: { alignItems: 'center', borderBottomColor: '#F0F1F3', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 16, paddingVertical: 10 },
  selectOptionSelected: { backgroundColor: '#FFF7D6' },
  selectOptionPressed: { backgroundColor: '#FFF1F1' },
  selectOptionText: { color: luxyColors.ink, flex: 1, fontSize: 16, lineHeight: 22 },
  selectOptionTextSelected: { color: '#6F4B00', fontWeight: '800' },
  selectCheck: { color: '#C68A00', fontSize: 17, fontWeight: '800', marginLeft: 10 },
  tag: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C9CDD2',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tagSelected: { backgroundColor: '#FFF1B8', borderColor: '#F2B51D', borderWidth: 1.5 },
  tagPressed: { borderColor: luxyColors.actionRed },
  tagDisabled: { backgroundColor: '#F3F4F6', opacity: 0.7 },
  tagText: { color: luxyColors.ink, fontSize: 16, fontWeight: '600' },
  tagTextSelected: { color: '#6F4B00', fontWeight: '800' },
  tagTextDisabled: { color: '#8B929B' },
  characterCount: { color: luxyColors.muted, fontSize: 11, lineHeight: 16, textAlign: 'right' },
  pressed: { opacity: 0.78 },
});