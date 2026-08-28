import {
  subscribeToLuxyMailboxRealtime,
  unsubscribeFromLuxyMailboxRealtime,
} from '@myfan/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getMobileSupabaseClient } from '@/lib/supabase';

const INVALIDATION_COALESCE_MS = 60;

/**
 * OPT-10 application-level mailbox realtime bridge.
 *
 * One authenticated browser/app session owns one mailbox channel. Database events are
 * coalesced before invalidating the two existing read-model caches so message INSERT +
 * conversation UPDATE bursts do not issue duplicate mailbox RPCs. A successful subscribe
 * also refreshes the read model, which closes the gap for events missed while reconnecting.
 */
export function useLuxyMailboxRealtime(userId: string | null | undefined): void {
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!client || !userId) return;
    let active = true;

    const scheduleRefresh = () => {
      if (!active || refreshTimerRef.current) return;
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        if (!active) return;
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['luxy-mailbox', userId] }),
          queryClient.invalidateQueries({ queryKey: ['luxy-nav-messages', userId] }),
        ]);
      }, INVALIDATION_COALESCE_MS);
    };

    const channel = subscribeToLuxyMailboxRealtime(client, {
      userId,
      onChange: scheduleRefresh,
      onStatus: (status) => {
        // Initial SUBSCRIBED validates the current read model; later SUBSCRIBED callbacks
        // recover changes missed while the socket was offline without a page reload.
        if (status === 'connected') scheduleRefresh();
      },
    });

    return () => {
      active = false;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void unsubscribeFromLuxyMailboxRealtime(client, channel);
    };
  }, [client, queryClient, userId]);
}
