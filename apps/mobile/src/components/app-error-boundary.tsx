import { colors, spacing } from '@myfan/ui';
import React, { type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { logger } from '@/lib/logger';

type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<PropsWithChildren, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Unhandled mobile rendering error', error, { componentStack: info.componentStack });
  }

  override render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.title}>MyFan chưa thể khởi động</Text>
        <Text style={styles.body}>Vui lòng thử lại. Token và dữ liệu nhạy cảm không được ghi vào nhật ký.</Text>
        <Pressable style={styles.button} onPress={() => this.setState({ error: null })}>
          <Text style={styles.buttonText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: spacing.lg, justifyContent: 'center', backgroundColor: colors.primary },
  buttonText: { color: colors.surface, fontWeight: '700' },
});
