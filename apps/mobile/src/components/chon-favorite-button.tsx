import { chonColors, chonShadows } from '@myfan/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ChonBrandIcon } from '@/components/chon-brand-icon';
import { useChonFavorite } from '@/hooks/use-chon-favorite';

export function ChonFavoriteButton({
  profileId,
  name,
  initialFavorited,
  initialFavoritedBy = false,
  onChanged,
}: {
  profileId: string;
  name: string;
  initialFavorited: boolean;
  initialFavoritedBy?: boolean;
  onChanged?: (favorited: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { available, busy, failed, favorited, favoritedBy, match, toggleFavorite } = useChonFavorite({
    profileId,
    initialFavorited,
    initialFavoritedBy,
    invalidateKeys: [
      ['luxy-search', 'profiles'],
      ['luxy-interests'],
      ['profile-interest-state', profileId],
    ],
    onChanged,
  });

  const accessibilityLabel = favorited
    ? `Bỏ yêu thích ${name}${match ? ', đang tương hợp' : ''}`
    : `Yêu thích ${name}${favoritedBy ? ', người này đã yêu thích bạn' : ''}`;

  return (
    <Pressable
      aria-pressed={favorited}
      accessibilityHint={failed ? 'Không thể cập nhật yêu thích. Chạm để thử lại.' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy }}
      disabled={!available || busy}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPress={() => void toggleFavorite()}
      style={({ pressed }) => [
        styles.button,
        favorited && styles.buttonFavorited,
        hovered && !favorited && styles.buttonHovered,
        hovered && favorited && styles.buttonFavoritedHovered,
        pressed && styles.pressed,
        busy && styles.busy,
      ]}
      testID={`chon-favorite-${profileId}`}
    >
      <ChonBrandIcon name="favorite" size={22} style={{ tintColor: favorited ? chonColors.gold : '#FFFFFF' }} />
      {match ? <Text style={styles.matchMark}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,23,38,0.56)',
    borderColor: 'rgba(255,255,255,0.82)',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44,
  },
  buttonFavorited: { backgroundColor: chonColors.primaryRed, borderColor: chonColors.primaryRed },
  buttonHovered: {
    backgroundColor: 'rgba(8,23,38,0.72)',
    borderColor: chonColors.gold,
    ...chonShadows.hover,
    transform: [{ scale: 1.04 }],
  },
  buttonFavoritedHovered: {
    backgroundColor: chonColors.primaryRedHover,
    borderColor: chonColors.gold,
    ...chonShadows.hover,
    transform: [{ scale: 1.04 }],
  },
  matchMark: {
    backgroundColor: chonColors.ink,
    borderRadius: 7,
    color: chonColors.gold,
    fontSize: 8,
    fontWeight: '700',
    height: 14,
    lineHeight: 14,
    position: 'absolute',
    right: -2,
    textAlign: 'center',
    top: -2,
    width: 14,
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.96 }] },
  busy: { opacity: 0.62 },
});
