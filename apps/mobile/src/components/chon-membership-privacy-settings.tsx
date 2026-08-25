import {
  getMyLuxyMembershipPrivacy,
  updateMyLuxyMembershipPrivacy,
} from '@myfan/supabase';
import { chonColors, luxySpacing } from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { SettingsSection } from '@/components/chon-settings-layout';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const privacyKey = (userId: string | null | undefined) => ['chon-membership-privacy', userId] as const;

export function ChonMembershipPrivacySettings() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();

  const privacyQuery = useQuery({
    queryKey: privacyKey(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyLuxyMembershipPrivacy(client);
    },
  });

  const mutation = useMutation({
    mutationFn: async (input: { hideOnline: boolean; hideFromListing: boolean }) => {
      if (!client) throw new Error('supabase_not_configured');
      return updateMyLuxyMembershipPrivacy(client, input);
    },
    onSuccess: async (next) => {
      queryClient.setQueryData(privacyKey(auth.userId), next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['luxy-member-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['luxy-interests'] }),
        queryClient.invalidateQueries({ queryKey: ['luxy-mailbox'] }),
      ]);
    },
  });

  const privacy = privacyQuery.data;
  const hideOnline = privacy?.hide_online ?? false;
  const hideFromListing = privacy?.hide_from_listing ?? false;

  function update(next: { hideOnline?: boolean; hideFromListing?: boolean }) {
    mutation.mutate({
      hideOnline: next.hideOnline ?? hideOnline,
      hideFromListing: next.hideFromListing ?? hideFromListing,
    });
  }

  return (
    <SettingsSection
      description="Điều chỉnh cách hồ sơ của bạn xuất hiện với thành viên khác theo quyền của gói hiện tại."
      testID="settings-privacy-section"
      title="Quyền riêng tư"
    >
      {privacyQuery.isLoading ? (
        <View style={styles.state} testID="settings-privacy-loading">
          <ActivityIndicator color={chonColors.primaryRed} />
          <Text style={styles.stateText}>Đang tải quyền riêng tư…</Text>
        </View>
      ) : privacyQuery.isError ? (
        <View style={styles.state} testID="settings-privacy-error">
          <Text accessibilityRole="alert" style={styles.errorText}>Không tải được cài đặt quyền riêng tư.</Text>
        </View>
      ) : (
        <>
          <PrivacyRow
            disabled={!privacy?.can_hide_online || mutation.isPending}
            label="Ẩn trạng thái online"
            note="Premium và Diamond"
            onChange={(value) => update({ hideOnline: value })}
            testID="settings-hide-online"
            value={hideOnline}
          />
          <PrivacyRow
            disabled={!privacy?.can_hide_from_listing || mutation.isPending}
            label="Ẩn khỏi danh sách thành viên"
            note="Chỉ Diamond"
            onChange={(value) => update({ hideFromListing: value })}
            testID="settings-hide-from-listing"
            value={hideFromListing}
          />
          {mutation.isError ? (
            <Text accessibilityRole="alert" style={styles.mutationError}>Không thể cập nhật quyền riêng tư. Vui lòng thử lại.</Text>
          ) : null}
        </>
      )}
    </SettingsSection>
  );
}

function PrivacyRow({
  label,
  note,
  value,
  disabled,
  onChange,
  testID,
}: {
  label: string;
  note: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  testID: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: chonColors.borderStrong, true: chonColors.gold }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: luxySpacing.md, minHeight: 72, paddingHorizontal: luxySpacing.lg, paddingVertical: luxySpacing.md },
  copy: { flex: 1, minWidth: 0 },
  label: { color: chonColors.text, fontSize: 14, fontWeight: '700' },
  note: { color: chonColors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  state: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.sm, minHeight: 68, paddingHorizontal: luxySpacing.lg },
  stateText: { color: chonColors.muted, fontSize: 12 },
  errorText: { color: chonColors.danger, fontSize: 12 },
  mutationError: { color: chonColors.danger, fontSize: 11, lineHeight: 16, paddingHorizontal: luxySpacing.lg, paddingVertical: luxySpacing.sm },
});
