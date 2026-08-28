import { luxyColors, luxyRadii, luxySpacing, luxyTypography } from '@myfan/ui';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ChonBrandIcon } from '@/components/chon-brand-icon';
import { ChonGiftModal } from '@/components/chon-gift-modal';
import { LuxyFavoriteButton } from '@/components/luxy-favorite-button';

export function LuxyProfilePhotoModal({
  visible,
  imageUrl,
  profileId,
  name,
  age,
  initialFavorited,
  initialFavoritedBy,
  onClose,
  onMessage,
}: {
  visible: boolean;
  imageUrl: string | null;
  profileId: string;
  name: string;
  age: number;
  initialFavorited: boolean;
  initialFavoritedBy: boolean;
  onClose: () => void;
  onMessage: (draft: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [draft, setDraft] = useState('');
  const [giftVisible, setGiftVisible] = useState(false);
  const desktop = width >= 768;
  const photoHeight = Math.min(desktop ? height * 0.62 : height * 0.58, desktop ? 620 : 520);

  function openGift() {
    onClose();
    setGiftVisible(true);
  }

  return (
    <>
      <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
        <View style={styles.backdrop} testID="luxy-profile-photo-modal">
          <Pressable accessibilityLabel="Đóng ảnh" accessibilityRole="button" onPress={onClose} style={styles.backdropDismiss} />
          <View accessibilityViewIsModal style={[styles.modalCard, desktop && styles.modalCardDesktop]}>
            <Pressable accessibilityLabel="Đóng" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <Text accessibilityRole="header" style={styles.title}>{name}, {age}</Text>
              <View style={[styles.photoFrame, { height: photoHeight }]}>
                {imageUrl ? (
                  <Image accessibilityLabel={`Ảnh của ${name}`} resizeMode="contain" source={{ uri: imageUrl }} style={styles.photo} />
                ) : (
                  <View style={styles.fallback}><Text style={styles.fallbackText}>{name.slice(0, 1).toUpperCase()}</Text></View>
                )}
                <View style={styles.favoriteOverlay}>
                  <LuxyFavoriteButton
                    initialFavorited={initialFavorited}
                    initialFavoritedBy={initialFavoritedBy}
                    name={name}
                    profileId={profileId}
                  />
                </View>
              </View>

              <Text style={styles.messageLabel}>Gửi lời chào tới {name}</Text>
              <View style={styles.messageRow}>
                <TextInput
                  accessibilityLabel={`Tin nhắn cho ${name}`}
                  maxLength={500}
                  onChangeText={setDraft}
                  placeholder={`Nhắn tin cho ${name}`}
                  placeholderTextColor={luxyColors.softMuted}
                  style={styles.messageInput}
                  value={draft}
                />
                <Pressable
                  accessibilityLabel={`Nhắn tin cho ${name}`}
                  accessibilityRole="button"
                  onPress={() => onMessage(draft)}
                  style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
                >
                  <Text style={styles.sendIcon}>➤</Text>
                </Pressable>
              </View>
              <View style={styles.actionRow}>
                <Pressable accessibilityRole="button" onPress={() => onMessage('')} style={styles.continueButton}>
                  <Text style={styles.continueText}>Tiếp tục tới tin nhắn</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Tặng quà cho ${name}`}
                  accessibilityRole="button"
                  onPress={openGift}
                  style={({ pressed }) => [styles.giftButton, pressed && styles.giftButtonPressed]}
                  testID="chon-profile-photo-gift-button"
                >
                  <ChonBrandIcon name="gift" size={17} />
                  <Text style={styles.giftButtonText}>Tặng quà</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ChonGiftModal
        onClose={() => setGiftVisible(false)}
        recipientId={profileId}
        recipientName={name}
        visible={giftVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.72)', flex: 1, justifyContent: 'center', padding: 12 },
  backdropDismiss: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  modalCard: { backgroundColor: luxyColors.surface, borderRadius: 14, maxHeight: '96%', maxWidth: 520, overflow: 'hidden', position: 'relative', width: '100%' },
  modalCardDesktop: { maxWidth: 610 },
  closeButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 22, height: 44, justifyContent: 'center', position: 'absolute', right: 8, top: 8, width: 44, zIndex: 5 },
  closeText: { color: luxyColors.muted, fontSize: 34, fontWeight: '300', lineHeight: 36 },
  content: { padding: luxySpacing.xl, paddingTop: 34 },
  title: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 26, fontWeight: '400', lineHeight: 32, marginBottom: 16 },
  photoFrame: { backgroundColor: luxyColors.ink, borderRadius: luxyRadii.md, overflow: 'hidden', position: 'relative', width: '100%' },
  photo: { height: '100%', width: '100%' },
  fallback: { alignItems: 'center', backgroundColor: '#E7E5E4', height: '100%', justifyContent: 'center', width: '100%' },
  fallbackText: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 72 },
  favoriteOverlay: { position: 'absolute', right: 12, top: 12 },
  messageLabel: { color: luxyColors.muted, fontSize: 13, marginTop: 20 },
  messageRow: { alignItems: 'center', borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, flexDirection: 'row', marginTop: 8, overflow: 'hidden' },
  messageInput: { color: luxyColors.text, flex: 1, fontSize: 14, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
  sendButton: { alignItems: 'center', height: 48, justifyContent: 'center', width: 52 },
  sendIcon: { color: luxyColors.ink, fontSize: 22 },
  actionRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginTop: 10 },
  continueButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 },
  continueText: { color: luxyColors.text, fontSize: 13, textDecorationLine: 'underline' },
  giftButton: { alignItems: 'center', backgroundColor: luxyColors.brandWarmSurface, borderColor: luxyColors.brandGold, borderRadius: luxyRadii.pill, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  giftButtonPressed: { opacity: 0.8 },
  giftButtonText: { color: luxyColors.text, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
