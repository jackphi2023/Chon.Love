import { luxyColors, luxyRadii, luxySpacing, luxyTypography } from '@myfan/ui';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const benefits = [
  'Nhắn tin không giới hạn',
  'Huy hiệu thành viên trả phí',
  'Bộ lọc tìm kiếm nâng cao',
  'Trải nghiệm ưu tiên hơn',
] as const;

export function LuxyUpgradeGateModal({
  visible,
  busy = false,
  onClose,
  onUpgrade,
}: {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop} testID="luxy-message-upgrade-gate">
        <Pressable accessibilityLabel="Đóng yêu cầu nâng cấp" accessibilityRole="button" onPress={onClose} style={styles.backdropDismiss} />
        <View accessibilityViewIsModal style={styles.card}>
          <Pressable accessibilityLabel="Đóng" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text accessibilityElementsHidden style={styles.icon}>▱</Text>
          <Text accessibilityRole="header" style={styles.title}>Bắt đầu nhắn tin ngay!</Text>
          <Text style={styles.description}>
            Nâng cấp Premium hoặc Diamond để mở quyền nhắn tin và trải nghiệm Luxy.Love đầy đủ hơn.
          </Text>

          <Text style={styles.benefitTitle}>Quyền lợi thành viên trả phí</Text>
          <View style={styles.benefitGrid}>
            {benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <Text accessibilityElementsHidden style={styles.check}>✓</Text>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onUpgrade}
            style={({ pressed }) => [styles.upgradeButton, pressed && styles.pressed, busy && styles.disabled]}
            testID="luxy-message-upgrade-cta"
          >
            <Text style={styles.upgradeText}>{busy ? 'Đang mở nâng cấp…' : 'Nâng cấp Premium'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.notNowButton}>
            <Text style={styles.notNowText}>Để sau</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,23,38,0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: luxySpacing.lg,
  },
  backdropDismiss: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  card: {
    backgroundColor: luxyColors.surface,
    borderRadius: 16,
    maxWidth: 430,
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 36,
    position: 'relative',
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 6,
    width: 44,
  },
  closeText: { color: luxyColors.muted, fontSize: 36, fontWeight: '300', lineHeight: 38 },
  icon: { color: '#D8B874', fontSize: 48, lineHeight: 52, textAlign: 'center' },
  title: {
    color: luxyColors.text,
    fontFamily: luxyTypography.families.display,
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 31,
    marginTop: 4,
    textAlign: 'center',
  },
  description: { color: luxyColors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  benefitTitle: { color: luxyColors.text, fontSize: 16, fontWeight: '700', marginTop: 24 },
  benefitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  benefitRow: { alignItems: 'center', flexBasis: '48%', flexDirection: 'row', gap: 7, minHeight: 30 },
  check: { color: luxyColors.ink, fontSize: 13, fontWeight: '800' },
  benefitText: { color: luxyColors.text, flex: 1, fontSize: 12, lineHeight: 17 },
  upgradeButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.actionRed,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 50,
    paddingHorizontal: 24,
  },
  upgradeText: { color: luxyColors.surface, fontSize: 14, fontWeight: '700' },
  notNowButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 4 },
  notNowText: { color: luxyColors.text, fontSize: 13, textDecorationLine: 'underline' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
