import { createLuxyUpgradeIntent, formatLuxyMembershipPrice } from '@myfan/supabase';
import { luxyColors, luxyRadii, luxySpacing, luxyTypography } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';

export type LuxyUpgradeGateReason = 'message' | 'favorite' | 'private_photo';

const reasonCopy: Record<LuxyUpgradeGateReason, { icon: string; title: string; description: string }> = {
  message: {
    icon: '▱ ◇',
    title: 'Bắt đầu nhắn tin ngay!',
    description: 'Thành viên Free vẫn có thể Yêu thích. Để gửi tin nhắn, hãy nâng cấp Premium hoặc Diamond.',
  },
  favorite: {
    icon: '♡',
    title: 'Yêu thích thành viên',
    description: 'Yêu thích là quyền miễn phí của mọi thành viên đã kích hoạt. Bạn không cần nâng cấp để dùng tính năng này.',
  },
  private_photo: {
    icon: '▣',
    title: 'Xem ảnh riêng tư!',
    description: 'Premium hoặc Diamond tự động được xem đầy đủ ảnh riêng tư đủ điều kiện. Quyền truy cập được kiểm tra trực tiếp từ trạng thái gói trên server.',
  },
};

const premiumBenefits = [
  'Gửi và nhận tin nhắn với thành viên',
  'Xem đầy đủ ảnh riêng tư',
  'Huy hiệu thành viên Premium',
] as const;

const diamondBenefits = [
  'Bao gồm toàn bộ quyền tương tác Premium',
  'Tự động xem đầy đủ ảnh riêng tư',
  'Huy hiệu Diamond — hạng thành viên cao nhất',
] as const;

function sourceForReason(reason: LuxyUpgradeGateReason): string {
  if (reason === 'private_photo') return 'member_profile_private_photo';
  if (reason === 'message') return 'member_profile_message';
  return 'member_profile_favorite';
}

function PlanCard({
  name,
  price,
  benefits,
  accent,
  busy,
  onPress,
  testID,
}: {
  name: string;
  price: string;
  benefits: readonly string[];
  accent?: boolean;
  busy: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <View style={[styles.planCard, accent && styles.planCardAccent]} testID={`luxy-upgrade-plan-${name.toLowerCase()}`}>
      <View style={styles.planHeadingRow}>
        <Text style={styles.planName}>{name}</Text>
        {accent ? <Text style={styles.highestBadge}>Hạng cao nhất</Text> : null}
      </View>
      <Text style={styles.planPrice}>{price}</Text>
      <View style={styles.planBenefits}>
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
        onPress={onPress}
        style={({ pressed }) => [styles.planButton, accent && styles.diamondButton, pressed && styles.pressed, busy && styles.disabled]}
        testID={testID}
      >
        <Text style={styles.upgradeText}>{busy ? 'Đang mở nâng cấp…' : `Nâng cấp ${name}`}</Text>
      </Pressable>
    </View>
  );
}

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
  const client = getMobileSupabaseClient();
  const router = useRouter();
  const [diamondBusy, setDiamondBusy] = useState(false);
  const [diamondError, setDiamondError] = useState<string | null>(null);

  async function handleDiamondUpgrade() {
    if (!client || diamondBusy) return;
    setDiamondBusy(true);
    setDiamondError(null);
    try {
      await createLuxyUpgradeIntent(client, 'diamond', sourceForReason(reason));
      onClose();
      router.push({
        pathname: '/settings/membership',
        params: { plan: 'diamond', source: sourceForReason(reason) },
      });
    } catch {
      setDiamondError('Không thể mở luồng nâng cấp Diamond lúc này. Vui lòng thử lại.');
    } finally {
      setDiamondBusy(false);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop} testID="luxy-message-upgrade-gate">
        <Pressable accessibilityLabel="Đóng yêu cầu nâng cấp" accessibilityRole="button" onPress={onClose} style={styles.backdropDismiss} />
        <View accessibilityViewIsModal style={styles.card} testID={`luxy-upgrade-gate-${reason}`}>
          <Pressable accessibilityLabel="Đóng" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text accessibilityElementsHidden style={styles.icon}>{copy.icon}</Text>
            <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
            <Text style={styles.description}>{copy.description}</Text>

            <Text style={styles.compareTitle}>Chọn hạng thành viên phù hợp</Text>
            <Text style={styles.freeNote}>Yêu thích vẫn sử dụng miễn phí với tài khoản Free.</Text>

            <View style={styles.planList}>
              <PlanCard
                benefits={premiumBenefits}
                busy={busy}
                name="Premium"
                onPress={onUpgrade}
                price={formatLuxyMembershipPrice('premium')}
                testID="luxy-message-upgrade-cta"
              />
              <PlanCard
                accent
                benefits={diamondBenefits}
                busy={diamondBusy}
                name="Diamond"
                onPress={() => void handleDiamondUpgrade()}
                price={formatLuxyMembershipPrice('diamond')}
                testID="luxy-diamond-upgrade-cta"
              />
            </View>

            {reason === 'private_photo' ? (
              <Text style={styles.consentNote}>Gift, Fan, friendship và legacy approval request không mở khóa ảnh riêng tư. Block vẫn có ưu tiên cao hơn trạng thái gói.</Text>
            ) : null}
            {diamondError ? <Text accessibilityRole="alert" style={styles.error}>{diamondError}</Text> : null}

            <Pressable accessibilityRole="button" onPress={onClose} style={styles.notNowButton}>
              <Text style={styles.notNowText}>Để sau</Text>
            </Pressable>
          </ScrollView>
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
    maxHeight: '92%',
    maxWidth: 470,
    position: 'relative',
    width: '100%',
  },
  scrollContent: { paddingBottom: 20, paddingHorizontal: 22, paddingTop: 34 },
  closeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 5,
    width: 44,
    zIndex: 5,
  },
  closeText: { color: '#63666A', fontSize: 36, fontWeight: '300', lineHeight: 38 },
  icon: { color: '#D8B874', fontSize: 40, lineHeight: 47, marginBottom: 1, textAlign: 'center' },
  title: {
    color: luxyColors.text,
    fontFamily: luxyTypography.families.display,
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 31,
    marginTop: 3,
    textAlign: 'center',
  },
  description: { color: luxyColors.muted, fontSize: 14.5, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  compareTitle: { color: luxyColors.text, fontSize: 17, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  freeNote: { color: luxyColors.muted, fontSize: 12, lineHeight: 17, marginTop: 5, textAlign: 'center' },
  planList: { gap: 10, marginTop: 13 },
  planCard: {
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.md,
    borderWidth: 1,
    padding: 14,
  },
  planCardAccent: { borderColor: '#D8B874', borderWidth: 1.5 },
  planHeadingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  planName: { color: luxyColors.text, fontSize: 17, fontWeight: '800' },
  highestBadge: { backgroundColor: '#F7EDD5', borderRadius: luxyRadii.pill, color: '#876A2D', fontSize: 10.5, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  planPrice: { color: luxyColors.muted, fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  planBenefits: { gap: 6, marginTop: 9 },
  benefitRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 7 },
  checkCircle: { alignItems: 'center', borderColor: luxyColors.ink, borderRadius: 8, borderWidth: 1.1, height: 16, justifyContent: 'center', marginTop: 1, width: 16 },
  check: { color: luxyColors.ink, fontSize: 9, fontWeight: '800', lineHeight: 11 },
  benefitText: { color: luxyColors.text, flex: 1, fontSize: 12, lineHeight: 17 },
  planButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.actionRed,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 42,
    paddingHorizontal: 18,
  },
  diamondButton: { backgroundColor: luxyColors.ink },
  upgradeText: { color: luxyColors.surface, fontSize: 13.5, fontWeight: '700' },
  consentNote: { color: luxyColors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 12, textAlign: 'center' },
  error: { color: luxyColors.danger, fontSize: 11.5, lineHeight: 16, marginTop: 9, textAlign: 'center' },
  notNowButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42, marginTop: 5 },
  notNowText: { color: luxyColors.text, fontSize: 13.5, textDecorationLine: 'underline' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
