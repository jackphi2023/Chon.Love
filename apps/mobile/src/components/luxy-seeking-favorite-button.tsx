import { setProfileFavorite } from '@myfan/supabase';
import { luxyColors, luxyRadii } from '@myfan/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';

export function LuxySeekingFavoriteButton({
  profileId,
  name,
  initialFavorited,
}: {
  profileId: string;
  name: string;
  initialFavorited: boolean;
}) {
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFavorited(initialFavorited), [initialFavorited]);

  async function toggle() {
    if (!client || busy) return;
    const previous = favorited;
    const next = !previous;
    setFavorited(next);
    setBusy(true);
    setFailed(false);
    try {
      const state = await setProfileFavorite(client, profileId, next);
      setFavorited(state.is_favorited);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['luxy-interests'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-interest-state', profileId] }),
        queryClient.invalidateQueries({ queryKey: ['luxy-nav-interests'] }),
      ]);
    } catch {
      setFavorited(previous);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      accessibilityHint={failed ? 'Không thể cập nhật Yêu thích. Chạm để thử lại.' : undefined}
      accessibilityLabel={favorited ? `Bỏ yêu thích ${name}` : `Yêu thích ${name}`}
      accessibilityRole="button"
      accessibilityState={{ busy, selected: favorited }}
      disabled={!client || busy}
      onPress={() => void toggle()}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.busy]}
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
  heart: { color: luxyColors.ink, fontSize: 18, lineHeight: 19 },
  heartActive: { color: '#5B6470' },
  text: { color: luxyColors.ink, fontSize: 14, fontWeight: '500' },
  pressed: { opacity: 0.72 },
  busy: { opacity: 0.55 },
});
