import { recordProfileViewByUsername } from '@myfan/supabase';
import { Slot, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useAuth } from '@/providers/auth-provider';

function normalizeUsername(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function PublicProfileRouteLayout() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = normalizeUsername(params.username).trim();
  const recordedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.userId || !username) return;
    const key = `${auth.userId}:${username.toLowerCase()}`;
    if (recordedKey.current === key) return;
    recordedKey.current = key;

    const client = getMobileSupabaseClient();
    if (!client) return;
    void recordProfileViewByUsername(client, username).catch((error) => {
      // Profile rendering must not fail because the non-critical view signal could not be recorded.
      logger.warn('Unable to record Luxy profile view', error);
    });
  }, [auth.userId, username]);

  return <Slot />;
}
