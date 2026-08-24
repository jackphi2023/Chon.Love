import { setProfileFavorite } from '@myfan/supabase';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getMobileSupabaseClient } from '@/lib/supabase';

export function useChonFavorite({
  profileId,
  initialFavorited,
  initialFavoritedBy = false,
  invalidateKeys,
  onChanged,
}: {
  profileId: string;
  initialFavorited: boolean;
  initialFavoritedBy?: boolean | undefined;
  invalidateKeys: QueryKey[];
  onChanged?: ((favorited: boolean) => void) | undefined;
}) {
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [favoritedBy, setFavoritedBy] = useState(initialFavoritedBy);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFavorited(initialFavorited), [initialFavorited]);
  useEffect(() => setFavoritedBy(initialFavoritedBy), [initialFavoritedBy]);

  async function toggleFavorite() {
    if (!client || busy) return;
    const previous = favorited;
    const next = !previous;
    setBusy(true);
    setFailed(false);
    setFavorited(next);
    onChanged?.(next);

    try {
      const state = await setProfileFavorite(client, profileId, next);
      setFavorited(state.is_favorited);
      setFavoritedBy(state.is_favorited_by);
      onChanged?.(state.is_favorited);
      await Promise.all(invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    } catch {
      setFavorited(previous);
      onChanged?.(previous);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    failed,
    favorited,
    favoritedBy,
    match: favorited && favoritedBy,
    toggleFavorite,
    available: Boolean(client),
  };
}
