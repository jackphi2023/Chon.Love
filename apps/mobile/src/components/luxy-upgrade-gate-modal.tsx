import { luxyColors, luxyRadii, luxySpacing, luxyTypography } from '@myfan/ui';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type LuxyUpgradeGateReason = 'message' | 'favorite' | 'private_photo';

const benefits = [
  'Nhắn tin với thành viên',
  'Gửi Interest / Yêu thích',
  'Yêu cầu xem ảnh riêng tư',
  'Huy hiệu Premium',
] as const;

const reasonCopy: Record<LuxyUpgradeGateReason, { icon: string; title: string; description: string }> = {
  message: {
    icon: '▱ ◇',
    title: 'Bắt đầu nhắn tin ngay!',
    description: 'Nâng cấp Premium để gửi và nhận tin nhắn khi bạn tương tác với thành viên trên Luxy.Love.',
  },
  favorite: {
    icon: '♡',
    title: 'Mở khóa Interest!',
    description: 'Nâng cấp Premium để thể hiện sự quan tâm, lưu thành viên vào Yêu thích và tạo cơ hội tương hợp.',
  },
  private_photo: {
    icon: '▣',
    title: 'Xem ảnh riêng tư!',
    description: 'Nâng cấp Premium để gửi yêu cầu xem ảnh riêng tư. Chủ hồ sơ vẫn là người quyết định chấp thuận hoặc từ chối.',
  },
};

export function LuxyUpgradeGateModal({
  visible,
  busy = false,
  reason = 'message',
  onClose,
  onUpgrade,
}: {
  visible: boolean;
  busy?: boolean;
  reason?: LuxyUpgradeGateReason;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const copy = reasonCopy[reason];
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop} testID="luxy-message-upgrade-gate">
        <Pressable accessibilityLabel="Đóng yêu cầu nâng cấp" accessibilityRole="button" onPress={onClose} style={styles.backdropDismiss} />
        <View accessibilityViewIsModal style={styles.card} testID={`luxy-upgrade-gate-${reason}`}>
          <Pressable accessibilityLabel="Đóng" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text accessibilityElementsHidden style={styles.icon}>{copy.icon}</Text>
          <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
          <Text style={styles.description}>{copy.description}</Text>

          <Text style={styles.benefitTitle}>
            Quyền lợi của <Text style={styles.premiumAccent}>Premium</Text>
          </Text>
          <View style={styles.benefitGrid}>
            {benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <View style={styles.checkCircle}><Text accessibilityElementsHidden style={styles.check}>✓</Text></View>
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
    backgroundColor: 'rgba(8,23,38,0.78)',
    flex: 1,
    justifyContent: 'center',
    padding: luxySpacing.lg,
  },
  backdropDismiss: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  card: {
    backgroundColor: luxyColors.surface,
    borderRadius: 18,
    maxWidth: 440,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 38,
    position: 'relative',
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 9,
    top: 7,
    width: 44,
  },
  closeText: { color: '#63666A', fontSize: 36, fontWeight: '300', lineHeight: 38 },
  icon: { color: '#D8B874', fontSize: 43, lineHeight: 50, marginBottom: 2, textAlign: 'center' },
  title: {
    color: luxyColors.text,
    fontFamily: luxyTypography.families.display,
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 31,
    marginTop: 4,
    textAlign: 'center',
  },
  description: { color: luxyColors.muted, fontSize: 15, lineHeight: 22, marginTop: 9 },
  benefitTitle: { color: luxyColors.text, fontSize: 18, fontWeight: '700', marginTop: 25 },
  premiumAccent: { color: luxyColors.actionRed, fontWeight: '500' },
  benefitGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 8, marginTop: 12 },
  benefitRow: { alignItems: 'center', flexBasis: '48%', flexDirection: 'row', gap: 8, minHeight: 32 },
  checkCircle: { alignItems: 'center', borderColor: luxyColors.ink, borderRadius: 9, borderWidth: 1.3, height: 17, justifyContent: 'center', width: 17 },
  check: { color: luxyColors.ink, fontSize: 10, fontWeight: '800', lineHeight: 12 },
  benefitText: { color: luxyColors.text, flex: 1, fontSize: 12.5, lineHeight: 17 },
  upgradeButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.actionRed,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    marginTop: 26,
    minHeight: 50,
    paddingHorizontal: 24,
  },
  upgradeText: { color: luxyColors.surface, fontSize: 15, fontWeight: '700' },
  notNowButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 4 },
  notNowText: { color: luxyColors.text, fontSize: 13.5, textDecorationLine: 'underline' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
