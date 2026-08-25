import {
  chonBreakpoints,
  chonColors,
  chonInteraction,
  chonLayout,
  chonShadows,
  chonTypography,
  luxyRadii,
} from '@myfan/ui';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
} from 'react-native';
import { PublicFooter, PublicHeader } from '@/components/public-site-chrome';

export function ChonAuthShell({
  children,
  actionLabel,
  prompt,
  onAction,
  testID = 'chon-auth-shell',
}: {
  children: ReactNode;
  actionLabel: string;
  prompt: string;
  onAction: () => void;
  testID?: string;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < chonBreakpoints.mobile;

  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      <PublicHeader
        actionLabel={actionLabel}
        compact={compact}
        onAction={onAction}
        onHome={() => router.replace('/')}
        prompt={prompt}
        variant="solid"
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.panel, compact && styles.panelCompact]}>{children}</View>
        <PublicFooter
          compact={compact}
          onCommunity={() => router.push('/legal/community-standards')}
          onTerms={() => router.push('/legal/terms')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export function ChonAuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.headingBlock}>
      <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
      {description ? <Text style={styles.subheading}>{description}</Text> : null}
    </View>
  );
}

export function ChonAuthField({ label, help, error, ...inputProps }: TextInputProps & {
  label: string;
  help?: string;
  error?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        placeholderTextColor={chonColors.softMuted}
        style={[styles.input, error ? styles.inputError : null, inputProps.style]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.fieldError}>{error}</Text> : null}
      {!error && help ? <Text style={styles.fieldHelp}>{help}</Text> : null}
    </View>
  );
}

export function ChonAuthPrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  const unavailable = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.primaryButtonPressed,
        unavailable && styles.disabled,
      ]}
      testID={testID}
    >
      {busy ? <ActivityIndicator color={chonColors.surface} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

export function ChonAuthLink({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} testID={testID}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function ChonAuthAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.alert}>{message}</Text>;
}

export function ChonAuthNotice({ title, children, success = false }: { title: string; children: ReactNode; success?: boolean }) {
  return (
    <View style={[styles.notice, success && styles.noticeSuccess]}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeCopy}>{children}</Text>
    </View>
  );
}

export function ChonAuthLoading({ text }: { text: string }) {
  return (
    <View accessibilityRole="alert" style={styles.loadingState}>
      <ActivityIndicator color={chonColors.primaryRed} size="large" />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

export const chonAuthStyles = StyleSheet.create({
  form: { gap: 16 },
  fieldStack: { gap: 14 },
});

const styles = StyleSheet.create({
  safeArea: { backgroundColor: chonColors.surface, flex: 1 },
  scrollContent: {
    alignItems: 'center',
    backgroundColor: chonColors.surface,
    flexGrow: 1,
    paddingTop: 48,
  },
  scrollContentCompact: { paddingTop: 28 },
  panel: {
    maxWidth: 456,
    paddingBottom: 54,
    paddingHorizontal: 8,
    width: '100%',
  },
  panelCompact: {
    paddingBottom: 38,
    paddingHorizontal: chonLayout.contentHorizontalPaddingMobile + 8,
  },
  headingBlock: { alignItems: 'center', marginBottom: 24 },
  heading: {
    color: chonColors.goldStrong,
    fontFamily: chonTypography.families.display,
    fontSize: chonTypography.sizes.h2,
    fontWeight: '700',
    lineHeight: chonTypography.lineHeights.h2,
    textAlign: 'center',
  },
  subheading: {
    color: chonColors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 420,
    textAlign: 'center',
  },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: chonColors.text, fontSize: 14, fontWeight: '700' },
  input: {
    backgroundColor: chonColors.surface,
    borderColor: chonColors.borderStrong,
    borderRadius: luxyRadii.md,
    borderWidth: 1,
    color: chonColors.text,
    fontSize: 16,
    minHeight: chonLayout.formControlHeight,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: chonColors.danger },
  fieldHelp: { color: chonColors.muted, fontSize: chonTypography.sizes.help, lineHeight: chonTypography.lineHeights.help },
  fieldError: { color: chonColors.danger, fontSize: chonTypography.sizes.help, lineHeight: chonTypography.lineHeights.help },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: chonColors.primaryRed,
    borderColor: chonColors.primaryRed,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: chonLayout.primaryActionHeight,
    paddingHorizontal: 20,
    width: '100%',
    ...chonShadows.primary,
  },
  primaryButtonPressed: {
    backgroundColor: chonColors.primaryRedHover,
    opacity: chonInteraction.pressedOpacity,
    ...chonShadows.primaryHover,
  },
  primaryButtonText: { color: chonColors.surface, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: chonInteraction.disabledOpacity },
  pressed: { opacity: chonInteraction.pressedOpacity },
  linkButton: { alignItems: 'center', justifyContent: 'center', minHeight: chonLayout.minimumTouchTarget, paddingHorizontal: 8 },
  linkText: { color: chonColors.primaryRed, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  alert: { color: chonColors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  notice: {
    backgroundColor: chonColors.warmSurface,
    borderColor: chonColors.border,
    borderRadius: luxyRadii.md,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  noticeSuccess: { backgroundColor: chonColors.warmSurfaceStrong, borderColor: chonColors.gold },
  noticeTitle: { color: chonColors.text, fontSize: 14, fontWeight: '800' },
  noticeCopy: { color: chonColors.muted, fontSize: 12, lineHeight: 18 },
  loadingState: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 240 },
  loadingText: { color: chonColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
