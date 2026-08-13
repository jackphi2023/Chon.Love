import { getConversationDetail } from '@myfan/supabase';
import { luxyColors, luxyRadii, luxyShadows } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { Slot, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LuxyGiftModal } from '@/components/luxy-gift-modal';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function LuxyChatLayout() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationId = normalizeParam(params.conversationId);
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const [giftOpen, setGiftOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['chat', 'detail', auth.userId, conversationId],
    enabled: Boolean(client && auth.userId && conversationId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getConversationDetail(client, conversationId);
    },
  });

  const detail = detailQuery.data;
  const recipientName = detail?.display_name || detail?.username || 'thành viên này';
  const canOfferGift = Boolean(
    detail &&
      detail.other_user_id !== auth.userId &&
      !detail.blocked_by_viewer &&
      !detail.blocked_by_other,
  );

  return (
    <View style={styles.root}>
      <Slot />
      {canOfferGift && detail ? (
        <Pressable
          accessibilityLabel={`Tặng quà cho ${recipientName}`}
          accessibilityRole="button"
          onPress={() => setGiftOpen(true)}
          style={({ pressed }) => [styles.giftButton, pressed && styles.pressed]}
          testID="luxy-chat-gift-button"
        >
          <Text style={styles.giftIcon}>🎁</Text>
          <Text style={styles.giftText}>Quà</Text>
        </Pressable>
      ) : null}
      {detail ? (
        <LuxyGiftModal
          conversationId={conversationId}
          onClose={() => setGiftOpen(false)}
          onSent={() => void detailQuery.refetch()}
          recipientId={detail.other_user_id}
          recipientName={recipientName}
          visible={giftOpen}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  giftButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    bottom: 92,
    flexDirection: 'row',
    gap: 5,
    minHeight: 42,
    paddingHorizontal: 13,
    position: 'absolute',
    right: 14,
    zIndex: 40,
    ...luxyShadows.card,
  },
  giftIcon: { fontSize: 17 },
  giftText: { color: luxyColors.ink, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
