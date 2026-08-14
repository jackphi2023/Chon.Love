import { colors, luxyBreakpoints, luxyLayout, luxyShadows, spacing } from '@myfan/ui';
import type { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type ScreenProps = PropsWithChildren<{
  title: string;
  description: string;
}>;

export function Screen({ title, description, children }: ScreenProps) {
  const { width } = useWindowDimensions();
  const desktop = width >= luxyBreakpoints.desktop;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, desktop && styles.desktopContent]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={desktop ? styles.desktopHeading : undefined}>
          <Text accessibilityRole="header" style={[styles.title, desktop && styles.desktopTitle]}>
            {title}
          </Text>
          <Text accessibilityLiveRegion="polite" style={[styles.description, desktop && styles.desktopDescription]}>{description}</Text>
        </View>
        <View style={[styles.card, desktop && styles.desktopCard]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Placeholder({ text }: { text: string }) {
  return <Text accessibilityLiveRegion="polite" style={styles.placeholder}>{text}</Text>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  desktopContent: {
    alignSelf: 'center',
    gap: 18,
    maxWidth: luxyLayout.desktopContentMaxWidth,
    paddingBottom: 48,
    paddingHorizontal: 32,
    paddingTop: 36,
    width: '100%',
  },
  desktopHeading: { gap: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  desktopTitle: { fontSize: 32, lineHeight: 40 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  desktopDescription: { fontSize: 14.5, lineHeight: 22, maxWidth: 820 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
  },
  desktopCard: {
    borderRadius: 18,
    padding: 32,
    ...luxyShadows.card,
  },
  placeholder: { color: colors.text, fontSize: 16, lineHeight: 24 },
});
