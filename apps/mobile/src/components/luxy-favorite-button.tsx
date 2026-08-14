import { setProfileFavorite } from '@myfan/supabase';
import { luxyColors } from '@myfan/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';

export function LuxyFavoriteButton({
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
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [favoritedBy, setFavoritedBy] = useState(initialFavoritedBy);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => setFavorited(initialFavorited), [initialFavorited]);
  useEffect(() => setFavoritedBy(initialFavoritedBy), [initialFavoritedBy]);

  const match = favorited && favoritedBy;
  const accessibilityLabel = favorited
    ? `Bỏ yêu thích ${name}${match ? ', đang tương hợp' : ''}`
    : `Yêu thích ${name}${favoritedBy ? ', người này đã yêu thích bạn' : ''}`;

  async function toggleFavorite() {
    if (!client || busy) return;
    const next = !favorited;
    const previous = favorited;
    setBusy(true);
    setFailed(false);
    setFavorited(next);
    onChanged?.(next);

    try {
      const state = await setProfileFavorite(client, profileId, next);
      setFavorited(state.is_favorited);
      setFavoritedBy(state.is_favorited_by);
      onChanged?.(state.is_favorited);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['luxy-search', 'profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['luxy-interests'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-interest-state', profileId] }),
      ]);
    } catch {
      setFavorited(previous);
      onChanged?.(previous);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      accessibilityHint={failed ? 'Không thể cập nhật yêu thích. Chạm để thử lại.' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy, selected: favorited }}
      disabled={!client || busy}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPress={() => void toggleFavorite()}
      style={({ pressed }) => [
        styles.button,
        favorited && styles.buttonFavorited,
        hovered && styles.buttonHovered,
        pressed && styles.pressed,
        busy && styles.busy,
      ]}
      testID={`luxy-favorite-${profileId}`}
    >
      <Text style={[styles.heart, favorited && styles.heartFavorited, hovered && styles.heartHovered]}>{favorited ? '♥' : '♡'}</Text>
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
  buttonFavorited: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: luxyColors.surface,
  },
  buttonHovered: {
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.actionRed,
    transform: [{ scale: 1.04 }],
  },
  heart: {
    color: luxyColors.surface,
    fontSize: 22,
    lineHeight: 25,
  },
  heartFavorited: {
    color: luxyColors.actionRed,
  },
  heartHovered: {
    color: luxyColors.actionRed,
  },
  matchMark: {
    backgroundColor: luxyColors.ink,
    borderRadius: 7,
    color: luxyColors.surface,
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