import {
  luxyColors,
  luxyLayout,
  luxyRadii,
  luxyShadows,
  luxySpacing,
  luxyTypography,
} from '@myfan/ui';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export function LuxySettingsPage({
  title,
  description,
  children,
  testID,
}: PropsWithChildren<{
  title: string;
  description: string;
  testID?: string;
}>) {
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
}: PropsWithChildren<{
  title: string;
  description?: string;
  testID?: string;
}>) {
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
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabledRow]}
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

export function SettingsNotice({
  title,
  children,
  tone = 'neutral',
}: PropsWithChildren<{ title: string; tone?: 'neutral' | 'warning' | 'success' }>) {
  return (
    <View style={[
      styles.notice,
      tone === 'warning' && styles.noticeWarning,
      tone === 'success' && styles.noticeSuccess,
    ]}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{children}</Text>
    </View>
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
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {icon}
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: luxyColors.background, flex: 1 },
  safeArea: { backgroundColor: luxyColors.background, flex: 1 },
  scrollContent: { flexGrow: 1 },
  inner: {
    alignSelf: 'center',
    maxWidth: 980,
    paddingBottom: luxySpacing.xxl,
    paddingHorizontal: luxySpacing.md,
    width: '100%',
  },
  heading: { paddingBottom: luxySpacing.lg, paddingTop: luxySpacing.xxl },
  title: {
    color: luxyColors.text,
    fontFamily: luxyTypography.families.display,
    fontSize: 34,
    lineHeight: 42,
  },
  description: { color: luxyColors.muted, fontSize: 15, lineHeight: 23, marginTop: luxySpacing.xs, maxWidth: 760 },
  section: { gap: luxySpacing.sm, marginBottom: luxySpacing.xl },
  sectionHeading: { gap: 3, paddingHorizontal: 2 },
  sectionTitle: { color: luxyColors.text, fontSize: 18, fontWeight: '700' },
  sectionDescription: { color: luxyColors.muted, fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...luxyShadows.card,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: luxyColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: luxySpacing.md,
    minHeight: 86,
    paddingHorizontal: luxySpacing.lg,
    paddingVertical: luxySpacing.md,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: luxyColors.elevatedSubtle,
    borderRadius: luxyRadii.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconText: { color: luxyColors.ink, fontSize: 17, fontWeight: '700' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: luxyColors.text, fontSize: 15.5, fontWeight: '600' },
  rowDescription: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  rowTail: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.sm, marginLeft: luxySpacing.sm },
  status: { color: luxyColors.muted, fontSize: 12.5, maxWidth: 118, textAlign: 'right' },
  chevron: { color: luxyColors.softMuted, fontSize: 27, fontWeight: '300' },
  notice: {
    backgroundColor: luxyColors.subtleSurface,
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.sm,
    borderWidth: 1,
    gap: 5,
    marginBottom: luxySpacing.lg,
    padding: luxySpacing.lg,
  },
  noticeWarning: { backgroundColor: '#FFFBEB', borderColor: '#F2B51D' },
  noticeSuccess: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  noticeTitle: { color: luxyColors.text, fontSize: 14, fontWeight: '700' },
  noticeBody: { color: luxyColors.muted, fontSize: 13, lineHeight: 20 },
  action: {
    alignItems: 'center',
    backgroundColor: luxyColors.ink,
    borderColor: luxyColors.ink,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: luxySpacing.sm,
    justifyContent: 'center',
    minHeight: luxyLayout.primaryActionHeight,
    paddingHorizontal: luxySpacing.xl,
  },
  actionSecondary: { backgroundColor: luxyColors.surface },
  actionDisabled: { opacity: 0.5 },
  actionText: { color: luxyColors.surface, fontSize: 14.5, fontWeight: '700' },
  actionTextSecondary: { color: luxyColors.ink },
  disabledRow: { opacity: 0.62 },
  pressed: { opacity: 0.72 },
});
