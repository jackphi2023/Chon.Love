import { phaseCFeatureFlags } from '@myfan/config';
import {
  formatGiftHeartPrice,
  formatHeartUnitBalance,
  getMyAvailableHeartUnits,
  giftCatalogQueryKeys,
  listActiveGiftCatalog,
  type GiftCatalogItem,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function GiftsPage() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const [selectedGift, setSelectedGift] = useState<GiftCatalogItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: giftCatalogQueryKeys.active,
    enabled: Boolean(client),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listActiveGiftCatalog(client);
    },
  });

  const balanceQuery = useQuery({
    queryKey: giftCatalogQueryKeys.balance(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyAvailableHeartUnits(client);
    },
  });

  const refreshing = catalogQuery.isRefetching || balanceQuery.isRefetching;
  async function refresh() {
    await Promise.all([catalogQuery.refetch(), balanceQuery.refetch()]);
  }

  function confirmSelection() {
    if (!selectedGift || !phaseCFeatureFlags.send_gift) return;
    setNotice(`${selectedGift.name_vi} đã được chọn. Chưa có giao dịch nào được tạo.`);
    setSelectedGift(null);
  }

  const gifts = catalogQuery.data ?? [];
  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        data={gifts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          catalogQuery.isLoading ? (
            <StateCard>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.stateTitle}>Đang tải cửa hàng quà…</Text>
            </StateCard>
          ) : catalogQuery.error ? (
            <StateCard>
              <Text accessibilityRole="alert" style={styles.stateTitle}>Không thể tải danh mục quà</Text>
              <Text style={styles.muted}>Hãy kiểm tra kết nối rồi thử lại.</Text>
              <Pressable accessibilityRole="button" onPress={() => void catalogQuery.refetch()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Thử lại</Text>
              </Pressable>
            </StateCard>
          ) : (
            <StateCard>
              <Text style={styles.stateTitle}>Danh mục đang trống</Text>
              <Text style={styles.muted}>Các quà đang tạm ẩn hoặc chưa được cấu hình.</Text>
            </StateCard>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <Text accessibilityRole="header" style={styles.title}>Cửa hàng quà</Text>
                <Text style={styles.description}>
                  20 quà tặng số dùng để ủng hộ Creator. Giá trên màn hình này chỉ hiển thị bằng ❤️.
                </Text>
              </View>
              <View accessibilityLabel="MyFan chỉ dành cho người dùng từ 18 tuổi" style={styles.ageBadge}>
                <Text style={styles.ageBadgeText}>18+</Text>
              </View>
            </View>

            <View style={styles.balanceCard}>
              <View>
                <Text style={styles.balanceLabel}>Số dư có thể dùng</Text>
                {balanceQuery.isLoading ? (
                  <ActivityIndicator color={colors.primary} style={styles.balanceLoader} />
                ) : balanceQuery.error ? (
                  <Text accessibilityRole="alert" style={styles.balanceError}>Không thể tải số dư</Text>
                ) : (
                  <Text style={styles.balanceValue}>{formatHeartUnitBalance(balanceQuery.data ?? 0)}</Text>
                )}
              </View>
              <Text style={styles.balanceNote}>
                Số dư chỉ tăng sau khi giao dịch mua ❤️ được Google Play xác minh.
              </Text>
            </View>

            {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
            <View style={styles.catalogHeading}>
              <Text style={styles.catalogTitle}>Tất cả quà</Text>
              <Text style={styles.catalogCount}>{gifts.length}/20</Text>
            </View>
          </View>
        }
        numColumns={2}
        refreshControl={
          <RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityHint="Mở chi tiết quà"
            accessibilityLabel={`${item.name_vi}, ${formatGiftHeartPrice(item)}`}
            accessibilityRole="button"
            onPress={() => {
              setNotice(null);
              setSelectedGift(item);
            }}
            style={({ pressed }) => [styles.giftCard, pressed && styles.pressed]}
          >
            <View style={styles.iconFrame}>
              <Text accessibilityElementsHidden style={styles.giftIcon}>{item.icon_emoji}</Text>
            </View>
            <Text numberOfLines={1} style={styles.giftName}>{item.name_vi}</Text>
            <Text style={styles.giftPrice}>{formatGiftHeartPrice(item)}</Text>
          </Pressable>
        )}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedGift(null)}
        transparent
        visible={Boolean(selectedGift)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text accessibilityElementsHidden style={styles.modalIcon}>{selectedGift?.icon_emoji}</Text>
            <Text accessibilityRole="header" style={styles.modalTitle}>{selectedGift?.name_vi}</Text>
            <Text style={styles.modalPrice}>{selectedGift ? formatGiftHeartPrice(selectedGift) : ''}</Text>
            <Text style={styles.modalDescription}>
              Quà tặng số thể hiện sự ủng hộ trong cộng đồng MyFan. Việc chọn quà ở Phiên 19 không trừ số dư và không tạo giao dịch tài chính.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={!phaseCFeatureFlags.send_gift}
              onPress={confirmSelection}
              style={[styles.primaryButton, !phaseCFeatureFlags.send_gift && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {phaseCFeatureFlags.send_gift ? 'Chọn quà' : 'Tặng quà chưa mở'}
              </Text>
            </Pressable>
            {!phaseCFeatureFlags.send_gift ? (
              <Text style={styles.featureNote}>
                Tặng quà sẽ được mở sau khi Google Play Billing và giao dịch server được kiểm thử đầy đủ.
              </Text>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => setSelectedGift(null)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.stateCard}>{children}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  row: { gap: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headingCopy: { flex: 1, gap: spacing.sm },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  ageBadge: { minWidth: 46, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#FCE7F3' },
  ageBadgeText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  balanceCard: { borderRadius: 18, borderWidth: 1, borderColor: '#FBCFE8', backgroundColor: '#FFF1F2', padding: spacing.md, gap: spacing.sm },
  balanceLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  balanceValue: { color: colors.primary, fontSize: 27, fontWeight: '900', marginTop: 3 },
  balanceLoader: { alignSelf: 'flex-start', marginTop: spacing.sm },
  balanceError: { color: colors.danger, fontSize: 13, fontWeight: '700', marginTop: 4 },
  balanceNote: { color: '#9D174D', fontSize: 11, lineHeight: 16 },
  notice: { borderRadius: 12, backgroundColor: '#ECFDF5', color: '#166534', fontSize: 13, lineHeight: 19, padding: spacing.md },
  catalogHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catalogTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  catalogCount: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  giftCard: { flex: 1, minHeight: 184, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  iconFrame: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#FFF1F2' },
  giftIcon: { fontSize: 42 },
  giftName: { maxWidth: '100%', color: colors.text, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  giftPrice: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  stateCard: { minHeight: 260, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.xl, gap: spacing.md },
  stateTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.45)' },
  modalCard: { alignItems: 'center', borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  modalHandle: { width: 48, height: 5, borderRadius: 999, backgroundColor: colors.border },
  modalIcon: { fontSize: 66 },
  modalTitle: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  modalPrice: { color: colors.primary, fontSize: 21, fontWeight: '900' },
  modalDescription: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primaryButton: { alignSelf: 'stretch', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  featureNote: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  secondaryButton: { alignSelf: 'stretch', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
