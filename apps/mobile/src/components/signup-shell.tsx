import { luxyBreakpoints, luxyColors, luxyRadii, luxyTypography } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
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
  const compact = width < luxyBreakpoints.mobile;

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
  onBack?: () => void;
  rightAction?: ReactNode;
}) {
  const safeTotal = Math.max(1, totalSteps);
  const safeStep = Math.min(Math.max(1, step), safeTotal);
  const progress = `${Math.round((safeStep / safeTotal) * 100)}%` as `${number}%`;

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
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
        ) : <View style={styles.progressSideSpacer} />}
        <Text style={styles.progressLabel}>Profile Setup</Text>
        <View style={styles.progressRight}>{rightAction ?? <View style={styles.progressSideSpacer} />}</View>
      </View>
      <View style={styles.progressBarRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progress }]} />
        </View>
        <ChonBrandIcon name="favorite" size={compact ? 18 : 20} />
      </View>
    </View>
  );
}

export function SignupPrimaryButton({ label, onPress, disabled = false, busy = false }: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const inactive = disabled || busy;
  return (
    <Pressable
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
  return <Text style={[styles.helpText, tone === 'danger' && styles.helpDanger, tone === 'success' && styles.helpSuccess]}>{children}</Text>;
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
    <Text style={[styles.characterCount, valid === true && styles.helpSuccess, valid === false && styles.helpDanger]}>
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
  contentCompact: { minHeight: 560, paddingBottom: 48, paddingHorizontal: 16, paddingTop: 16 },
  progressWrap: { marginBottom: 22 },
  progressTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 38 },
  backButton: { alignItems: 'center', height: 38, justifyContent: 'center', width: 44 },
  backArrow: { color: luxyColors.ink, fontSize: 27, fontWeight: '400', lineHeight: 30 },
  progressSideSpacer: { width: 44 },
  progressRight: { alignItems: 'flex-end', minWidth: 44 },
  progressLabel: { color: luxyColors.actionRed, fontSize: 12, fontWeight: '600' },
  progressBarRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  progressTrack: { backgroundColor: '#F5D8D8', borderRadius: 999, flex: 1, height: 5, overflow: 'hidden' },
  progressFill: { backgroundColor: '#FF4A4A', borderRadius: 999, height: 5 },
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
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#F8C9D4',
    borderColor: '#F3A9BA',
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 22,
  },
  secondaryButtonHovered: { backgroundColor: luxyColors.actionRed, borderColor: luxyColors.actionRed },
  secondaryButtonPressed: { backgroundColor: luxyColors.actionRed },
  secondaryButtonText: { color: '#7A2437', fontSize: 15, fontWeight: '800' },
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
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  multilineInput: { minHeight: 132, textAlignVertical: 'top' },
  tag: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C9CDD2',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagSelected: { backgroundColor: '#FFF1B8', borderColor: '#F2B51D', borderWidth: 1.5 },
  tagPressed: { borderColor: luxyColors.actionRed },
  tagDisabled: { backgroundColor: '#F3F4F6', opacity: 0.7 },
  tagText: { color: luxyColors.ink, fontSize: 13, fontWeight: '600' },
  tagTextSelected: { color: '#6F4B00', fontWeight: '800' },
  tagTextDisabled: { color: '#8B929B' },
  characterCount: { color: luxyColors.muted, fontSize: 11, lineHeight: 16, textAlign: 'right' },
  pressed: { opacity: 0.78 },
});
