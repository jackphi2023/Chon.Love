import {
  chonColors,
  chonInteraction,
  chonShadows,
  chonTypography,
  luxyRadii,
  luxySpacing,
} from '@myfan/ui';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LuxyModalLayer } from '@/components/luxy-modal-layer';

type PaymentRow = {
  key: string;
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
};

type ChonPaymentModalProps = {
  visible: boolean;
  title: string;
  eyebrow?: string | null;
  status?: string | null;
  loading?: boolean;
  loadingText?: string;
  error?: string | null;
  qrImageUrl?: string | null;
  qrAccessibilityLabel?: string;
  rows?: PaymentRow[];
  children?: ReactNode;
  footerNote?: string | null;
  onClose: () => void;
  testID?: string;
};

export function ChonPaymentModal({
  visible,
  title,
  eyebrow,
  status,
  loading = false,
  loadingText = 'Đang tạo thông tin thanh toán…',
  error,
  qrImageUrl,
  qrAccessibilityLabel = 'Mã VietQR thanh toán',
  rows = [],
  children,
  footerNote,
  onClose,
  testID = 'chon-payment-modal',
}: ChonPaymentModalProps) {
  if (!visible) return null;

  return (
    <LuxyModalLayer onRequestClose={onClose} visible={visible}>
      <View style={styles.backdrop} testID={testID}>
        <View style={styles.card}>
          <Pressable accessibilityLabel="Đóng" onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={chonColors.primaryRed} />
              <Text style={styles.muted}>{loadingText}</Text>
            </View>
          ) : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          {!loading && !error ? (
            <ScrollView contentContainerStyle={styles.content}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              {status ? <Text style={styles.status}>{status}</Text> : null}
              {qrImageUrl ? (
                <Image
                  accessibilityLabel={qrAccessibilityLabel}
                  resizeMode="contain"
                  source={{ uri: qrImageUrl }}
                  style={styles.qr}
                />
              ) : null}
              {rows.length ? (
                <View style={styles.summary}>
                  {rows.map((row) => (
                    <ChonPaymentRow key={row.key} {...row} />
                  ))}
                </View>
              ) : null}
              {children}
              {footerNote ? <Text style={styles.footer}>{footerNote}</Text> : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </LuxyModalLayer>
  );
}

export function ChonPaymentAction({
  label,
  onPress,
  disabled = false,
  loading = false,
  secondary = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
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
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {loading ? <ActivityIndicator color={secondary ? chonColors.text : chonColors.surface} /> : (
        <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function ChonPaymentState({
  title,
  text,
  success = false,
}: {
  title: string;
  text: string;
  success?: boolean;
}) {
  return (
    <View style={[styles.state, success && styles.stateSuccess]}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

function ChonPaymentRow({ label, value, onCopy, copied }: PaymentRow) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text selectable style={styles.rowValue}>{value}</Text>
      </View>
      {onCopy ? (
        <Pressable accessibilityRole="button" onPress={onCopy} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>
          <Text style={styles.copyText}>{copied ? 'Đã chép' : 'Sao chép'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.46)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: chonColors.surface,
    borderColor: chonColors.gold,
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: '92%',
    maxWidth: 560,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    ...chonShadows.card,
  },
  close: {
    alignItems: 'center',
    backgroundColor: chonColors.surface,
    borderColor: chonColors.border,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    zIndex: 3,
  },
  closeText: { color: chonColors.text, fontSize: 22, lineHeight: 24 },
  loading: { alignItems: 'center', gap: luxySpacing.sm, minHeight: 220, justifyContent: 'center', padding: 28 },
  muted: { color: chonColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  error: { color: chonColors.danger, fontSize: 13, lineHeight: 19, padding: 28, textAlign: 'center' },
  content: { gap: 12, paddingBottom: 24, paddingHorizontal: 20, paddingTop: 26 },
  eyebrow: { color: chonColors.goldStrong, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, paddingRight: 42, textAlign: 'center' },
  title: {
    color: chonColors.text,
    fontFamily: chonTypography.families.display,
    fontSize: chonTypography.sizes.h2,
    lineHeight: chonTypography.lineHeights.h2,
    paddingHorizontal: 42,
    textAlign: 'center',
  },
  status: { color: chonColors.goldStrong, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  qr: { alignSelf: 'center', height: 230, marginVertical: 4, maxWidth: '100%', width: 230 },
  summary: { borderColor: chonColors.border, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    borderBottomColor: chonColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: chonColors.muted, fontSize: 10.5, fontWeight: '600' },
  rowValue: { color: chonColors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  copyButton: { borderColor: chonColors.gold, borderRadius: luxyRadii.pill, borderWidth: 1, minHeight: 34, justifyContent: 'center', paddingHorizontal: 10 },
  copyText: { color: chonColors.goldStrong, fontSize: 11, fontWeight: '700' },
  action: {
    alignItems: 'center',
    backgroundColor: chonColors.primaryRed,
    borderColor: chonColors.primaryRed,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    ...chonShadows.primary,
  },
  actionSecondary: { backgroundColor: chonColors.surface, borderColor: chonColors.gold },
  actionText: { color: chonColors.surface, fontSize: 14, fontWeight: '800' },
  actionTextSecondary: { color: chonColors.text },
  disabled: { opacity: 0.55 },
  pressed: { opacity: chonInteraction.pressedOpacity, transform: [{ scale: chonInteraction.pressedScale }] },
  state: { backgroundColor: chonColors.warmSurface, borderColor: chonColors.border, borderRadius: 10, borderWidth: 1, gap: 4, padding: 14 },
  stateSuccess: { borderColor: chonColors.gold },
  stateTitle: { color: chonColors.text, fontSize: 14, fontWeight: '800' },
  stateText: { color: chonColors.muted, fontSize: 12, lineHeight: 18 },
  footer: { color: chonColors.muted, fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
});
