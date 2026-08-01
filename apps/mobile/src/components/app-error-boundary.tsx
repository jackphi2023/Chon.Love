import { accessibility, colors, spacing } from '@myfan/ui';
import React, { type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { logger } from '@/lib/logger';
import { emitMobileRuntimeObservation } from '@/lib/runtime-observability';

type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<PropsWithChildren, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Unhandled mobile rendering error', error, { component: 'root_error_boundary' });
    emitMobileRuntimeObservation({
      eventName: 'app_render_error',
      severity: 'error',
      routeGroup: 'root',
      error,
      metadata: { component: info.componentStack ? 'react_component_tree' : 'unknown' },
    });
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
    emitMobileRuntimeObservation({
      eventName: 'route_recovered',
      severity: 'info',
      routeGroup: 'root',
      metadata: { recovered: true, source: 'error_boundary' },
    });
  };

  override render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <View
        accessibilityLiveRegion="assertive"
        accessibilityRole="alert"
        style={styles.container}
      >
        <Text accessibilityRole="header" style={styles.title}>MyFan chưa thể khởi động</Text>
        <Text style={styles.body}>Vui lòng thử lại. Token và dữ liệu nhạy cảm không được ghi vào nhật ký.</Text>
        <Pressable
          accessibilityHint="Tải lại giao diện MyFan mà không gửi lại giao dịch tài chính"
          accessibilityLabel="Thử tải lại MyFan"
          accessibilityRole="button"
          onPress={this.handleRetry}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  button: { minHeight: accessibility.preferredTouchTarget, borderRadius: 14, paddingHorizontal: spacing.lg, justifyContent: 'center', backgroundColor: colors.primary },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: colors.surface, fontWeight: '700' },
});
