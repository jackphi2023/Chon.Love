import { createLuxyUpgradeIntent, getLuxyProfileConversation, getReadableLuxyMailboxError } from '@myfan/supabase';
import { luxyColors, luxyRadii } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { LuxyUpgradeGateModal } from './luxy-upgrade-gate-modal';

export function LuxySeekingMessageButton({ profileId, name }: { profileId: string; name: string }) {
  const client = getMobileSupabaseClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openConversation() {
    if (!client || busy) return;
    setBusy(true);
    setError(null);
    try {
      const conversationId = await getLuxyProfileConversation(client, profileId);
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId } });
    } catch (cause) {
      const raw = typeof cause === 'object' && cause !== null && 'message' in cause
        ? String((cause as { message?: unknown }).message ?? '')
        : String(cause ?? '');
      if (raw.includes('premium_membership_required')) setShowUpgrade(true);
      else setError(getReadableLuxyMailboxError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function openPremiumUpgrade() {
    if (!client || upgradeBusy) return;
    setUpgradeBusy(true);
    try {
      await createLuxyUpgradeIntent(client, 'premium', 'interests_message');
      setShowUpgrade(false);
      router.push({ pathname: '/settings/membership', params: { plan: 'premium', source: 'interests_message' } });
    } finally {
      setUpgradeBusy(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityHint={error ?? undefined}
        accessibilityLabel={`Nhắn tin cho ${name}`}
        accessibilityRole="button"
        disabled={!client || busy}
        onPress={() => void openConversation()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.busy]}
        testID={`luxy-interests-message-${profileId}`}
      >
        <Text style={styles.text}>{busy ? 'Đang mở…' : 'Nhắn tin'}</Text>
      </Pressable>
      <LuxyUpgradeGateModal
        busy={upgradeBusy}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => void openPremiumUpgrade()}
        reason="message"
        visible={showUpgrade}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: luxyColors.ink,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 102,
    paddingHorizontal: 18,
  },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  pressed: { opacity: 0.76 },
  busy: { opacity: 0.6 },
});
