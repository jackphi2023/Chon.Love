import { chonColors, luxyColors, luxyRadii } from '@myfan/ui';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useChonFavorite } from '@/hooks/use-chon-favorite';

export function LuxySeekingFavoriteButton({
  profileId,
  name,
  initialFavorited,
}: {
  profileId: string;
  name: string;
  initialFavorited: boolean;
}) {
  const {
    available,
    busy,
    failed,
    favorited,
    toggleFavorite,
  } = useChonFavorite({
    profileId,
    initialFavorited,
    invalidateKeys: [
      ['luxy-interests'],
      ['profile-interest-state', profileId],
      ['luxy-nav-interests'],
    ],
  });

  return (
    <Pressable
      accessibilityHint={failed ? 'Không thể cập nhật Yêu thích. Chạm để thử lại.' : undefined}
      accessibilityLabel={favorited ? `Bỏ yêu thích ${name}` : `Yêu thích ${name}`}
      accessibilityRole="button"
      accessibilityState={{ busy, selected: favorited }}
      disabled={!available || busy}
      onPress={() => void toggleFavorite()}
      style={({ pressed }) => [
        styles.button,
        favorited && styles.buttonFavorited,
        pressed && styles.pressed,
        busy && styles.busy,
      ]}
      testID={`luxy-interests-favorite-${profileId}`}
    >
      <Text style={[styles.heart, favorited && styles.heartActive]}>{favorited ? '♥' : '♡'}</Text>
      <Text style={styles.text}>{favorited ? 'Đã yêu thích' : 'Yêu thích'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: luxyColors.ink,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 122,
    paddingHorizontal: 14,
  },
  buttonFavorited: { borderColor: chonColors.gold },
  heart: { color: luxyColors.ink, fontSize: 18, lineHeight: 19 },
  heartActive: { color: chonColors.gold },
  text: { color: luxyColors.ink, fontSize: 14, fontWeight: '500' },
  pressed: { backgroundColor: chonColors.warmSurfaceStrong, opacity: 0.78 },
  busy: { opacity: 0.55 },
});
