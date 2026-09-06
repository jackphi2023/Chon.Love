import {
  subscribeToLuxyMailboxRealtime,
  unsubscribeFromLuxyMailboxRealtime,
  type LuxyMailboxRealtimeStatus,
} from '@myfan/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { getMobileSupabaseClient } from '@/lib/supabase';

const INVALIDATION_COALESCE_MS = 60;

/**
 * OPT-10 application-level mailbox realtime bridge.
 *
 * One authenticated browser/app session owns one mailbox channel. Database events are
 * coalesced before invalidating the two existing read-model caches so message INSERT +
 * conversation UPDATE bursts do not issue duplicate mailbox RPCs. A successful subscribe
 * also refreshes the read model, which closes the gap for events missed while reconnecting.
 *
 * The returned status is the actual Supabase channel status, not a timer-based readiness
 * approximation. Browser acceptance can therefore wait for SUBSCRIBED before producing a
 * message and avoid racing the initial websocket handshake.
 */
export function useLuxyMailboxRealtime(
  userId: string | null | undefined,
): LuxyMailboxRealtimeStatus {
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<LuxyMailboxRealtimeStatus>('closed');

  useEffect(() => {
    if (!client || !userId) {
      setStatus('closed');
      return;
    }
    let active = true;
    setStatus('connecting');

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
      onStatus: (nextStatus) => {
        if (!active) return;
        setStatus(nextStatus);
        // Initial SUBSCRIBED validates the current read model; later SUBSCRIBED callbacks
        // recover changes missed while the socket was offline without a page reload.
        if (nextStatus === 'connected') scheduleRefresh();
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

  return status;
}
