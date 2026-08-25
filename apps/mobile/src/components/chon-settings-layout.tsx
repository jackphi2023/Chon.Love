import {
  chonColors,
  chonInteraction,
  chonLayout,
  chonShadows,
  chonTypography,
  luxyRadii,
  luxySpacing,
} from '@myfan/ui';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export function ChonSettingsPage({
  title,
  description,
  children,
  testID,
}: PropsWithChildren<{ title: string; description: string; testID?: string }>) {
  return (
    <View style={styles.page} testID={testID}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} contentInsetAdjustmentBehavior="automatic">
          <View style={styles.inner}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function SettingsSection({
  title,
  description,
  children,
  testID,
}: PropsWithChildren<{ title: string; description?: string; testID?: string }>) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SettingsLinkRow({
  title,
  description,
  symbol,
  status,
  onPress,
  disabled = false,
  testID,
}: {
  title: string;
  description: string;
  symbol: string;
  status?: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const interactive = Boolean(onPress) && !disabled;
  return (
    <Pressable
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityState={{ disabled: !interactive }}
      disabled={!interactive}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressedRow, disabled && styles.disabledRow]}
      testID={testID}
    >
      <View accessibilityElementsHidden style={styles.icon}><Text style={styles.iconText}>{symbol}</Text></View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <View style={styles.rowTail}>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {interactive ? <Text accessibilityElementsHidden style={styles.chevron}>›</Text> : null}
      </View>
    </Pressable>
  );
}

export function SettingsAction({
  label,
  onPress,
  disabled = false,
  secondary = false,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  icon?: ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.actionSecondary,
        disabled && styles.actionDisabled,
        pressed && styles.actionPressed,
      ]}
      testID={testID}
    >
      {icon}
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

export const chonSettingsStyles = StyleSheet.create({
  stateText: { color: chonColors.muted, fontSize: 12, lineHeight: 18 },
  errorText: { color: chonColors.danger, fontSize: 12, lineHeight: 18 },
});

const styles = StyleSheet.create({
  page: { backgroundColor: chonColors.surface, flex: 1 },
  safeArea: { backgroundColor: chonColors.surface, flex: 1 },
  scrollContent: { flexGrow: 1 },
  inner: { alignSelf: 'center', maxWidth: 980, paddingBottom: luxySpacing.xxl, paddingHorizontal: chonLayout.contentHorizontalPaddingMobile, width: '100%' },
  heading: { paddingBottom: luxySpacing.lg, paddingTop: luxySpacing.xxl },
  title: { color: chonColors.goldStrong, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, lineHeight: chonTypography.lineHeights.h2 },
  description: { color: chonColors.muted, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, marginTop: luxySpacing.xs, maxWidth: 760 },
  section: { gap: luxySpacing.sm, marginBottom: luxySpacing.xl },
  sectionHeading: { gap: 3, paddingHorizontal: 2 },
  sectionTitle: { color: chonColors.text, fontSize: chonTypography.sizes.h3, fontWeight: '700' },
  sectionDescription: { color: chonColors.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: luxyRadii.md, borderWidth: 1, overflow: 'hidden', ...chonShadows.card },
  row: { alignItems: 'center', borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: luxySpacing.md, minHeight: 82, paddingHorizontal: luxySpacing.lg, paddingVertical: luxySpacing.md },
  icon: { alignItems: 'center', backgroundColor: chonColors.warmSurface, borderColor: chonColors.gold, borderRadius: luxyRadii.pill, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  iconText: { color: chonColors.goldStrong, fontSize: 17, fontWeight: '700' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: chonColors.text, fontSize: 14, fontWeight: '700' },
  rowDescription: { color: chonColors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  rowTail: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.sm, marginLeft: luxySpacing.sm },
  status: { color: chonColors.goldStrong, fontSize: 11, fontWeight: '600', maxWidth: 118, textAlign: 'right' },
  chevron: { color: chonColors.softMuted, fontSize: 27, fontWeight: '300' },
  action: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderColor: chonColors.primaryRed, borderRadius: luxyRadii.pill, borderWidth: 1, flexDirection: 'row', gap: luxySpacing.sm, justifyContent: 'center', minHeight: chonLayout.primaryActionHeight, paddingHorizontal: luxySpacing.xl },
  actionSecondary: { backgroundColor: chonColors.surface, borderColor: chonColors.gold },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: chonColors.surface, fontSize: 14, fontWeight: '700' },
  actionTextSecondary: { color: chonColors.text },
  actionPressed: { backgroundColor: chonColors.primaryRedHover, opacity: chonInteraction.pressedOpacity, ...chonShadows.primaryHover },
  disabledRow: { opacity: 0.62 },
  pressedRow: { backgroundColor: chonColors.warmSurface, opacity: chonInteraction.pressedOpacity },
});
