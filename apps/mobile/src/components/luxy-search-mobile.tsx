import {
  createPrivateMediaUrl,
  formatLuxyDistance,
  getMyDiscoveryContext,
  getNextLuxySearchOffset,
  listActiveProvinces,
  LUXY_SEARCH_DEFAULT_PAGE_SIZE,
  LUXY_SEARCH_MAX_RESULTS,
  searchLuxyProfilesV2,
  setMyDiscoveryLocation,
  type ChildrenStatus,
  type DrinkingStatus,
  type EducationLevel,
  type LuxySearchProfile,
  type LuxySearchSort,
  type ProfileLifestyleTag,
  type ProvinceOption,
  type RelationshipStatus,
  type SearchLuxyProfilesInput,
  type SmokingStatus,
} from '@myfan/supabase';
import { luxyColors, luxyLayout, luxyRadii, luxySpacing, luxyTypography } from '@myfan/ui';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { requestDiscoveryLocation } from '@/lib/location';
import { getReadableLocationError } from '@/lib/location-errors';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const LIFESTYLE_OPTIONS: Array<{ value: ProfileLifestyleTag; label: string }> = [
  { value: 'true_love', label: 'Tình yêu đích thực' },
  { value: 'luxury_lifestyle', label: 'Phong cách sống cao cấp' },
  { value: 'active_lifestyle', label: 'Năng động' },
  { value: 'flexible_schedule', label: 'Lịch trình linh hoạt' },
  { value: 'emotional_connection', label: 'Kết nối cảm xúc' },
  { value: 'refined', label: 'Tinh tế' },
  { value: 'fine_dining', label: 'Ẩm thực cao cấp' },
  { value: 'friendship', label: 'Bạn bè' },
  { value: 'long_term', label: 'Lâu dài' },
  { value: 'marriage_minded', label: 'Hướng đến hôn nhân' },
  { value: 'monogamous', label: 'Một vợ một chồng' },
  { value: 'romantic', label: 'Lãng mạn' },
  { value: 'ready_to_travel', label: 'Sẵn sàng du lịch' },
  { value: 'travel_companion', label: 'Bạn đồng hành du lịch' },
  { value: 'vacation', label: 'Kỳ nghỉ' },
  { value: 'entertainment_events', label: 'Giải trí & sự kiện' },
  { value: 'platonic', label: 'Thuần bạn bè' },
];

const RELATIONSHIP_OPTIONS: Array<{ value: RelationshipStatus; label: string }> = [
  { value: 'single', label: 'Độc thân' },
  { value: 'divorced', label: 'Đã ly hôn' },
  { value: 'widowed', label: 'Goá' },
  { value: 'open', label: 'Mối quan hệ mở' },
  { value: 'complicated', label: 'Phức tạp' },
];

const SMOKING_OPTIONS: Array<{ value: SmokingStatus; label: string }> = [
  { value: 'never', label: 'Không hút thuốc' },
  { value: 'socially', label: 'Hút xã giao' },
  { value: 'regularly', label: 'Hút thường xuyên' },
  { value: 'trying_to_quit', label: 'Đang cố bỏ' },
];

const DRINKING_OPTIONS: Array<{ value: DrinkingStatus; label: string }> = [
  { value: 'never', label: 'Không uống' },
  { value: 'socially', label: 'Uống xã giao' },
  { value: 'regularly', label: 'Uống thường xuyên' },
];

const EDUCATION_OPTIONS: Array<{ value: EducationLevel; label: string }> = [
  { value: 'high_school', label: 'THPT' },
  { value: 'vocational', label: 'Trung cấp / nghề' },
  { value: 'college', label: 'Cao đẳng' },
  { value: 'bachelors', label: 'Đại học' },
  { value: 'masters', label: 'Thạc sĩ' },
  { value: 'doctorate', label: 'Tiến sĩ' },
  { value: 'other', label: 'Khác' },
];

const CHILDREN_OPTIONS: Array<{ value: ChildrenStatus; label: string }> = [
  { value: 'no_children', label: 'Chưa có con' },
  { value: 'has_children', label: 'Đã có con' },
];

const DISTANCE_OPTIONS = [5, 25, 50, 100, 500] as const;

const SORT_OPTIONS: Array<{ value: LuxySearchSort; label: string }> = [
  { value: 'distance', label: 'Gần nhất' },
  { value: 'recent', label: 'Hoạt động gần đây' },
  { value: 'newest', label: 'Mới tham gia' },
];

type DraftFilters = {
  provinceId: number | null;
  maxDistanceKm: number | null;
  minAge: string;
  maxAge: string;
  minHeightCm: string;
  maxHeightCm: string;
  minWeightKg: string;
  maxWeightKg: string;
  relationshipStatuses: RelationshipStatus[];
  childrenStatuses: ChildrenStatus[];
  smokingStatuses: SmokingStatus[];
  drinkingStatuses: DrinkingStatus[];
  educationLevels: EducationLevel[];
  lifestyleTags: ProfileLifestyleTag[];
  languagesText: string;
  occupationText: string;
  profileText: string;
  hasPhoto: boolean;
  onlineNow: boolean;
};

const DEFAULT_DRAFT: DraftFilters = {
  provinceId: null,
  maxDistanceKm: null,
  minAge: '18',
  maxAge: '99',
  minHeightCm: '',
  maxHeightCm: '',
  minWeightKg: '',
  maxWeightKg: '',
  relationshipStatuses: [],
  childrenStatuses: [],
  smokingStatuses: [],
  drinkingStatuses: [],
  educationLevels: [],
  lifestyleTags: [],
  languagesText: '',
  occupationText: '',
  profileText: '',
  hasPhoto: false,
  onlineNow: false,
};

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toSearchInput(draft: DraftFilters, sort: LuxySearchSort): SearchLuxyProfilesInput {
  return {
    sort,
    provinceId: draft.provinceId,
    maxDistanceKm: draft.maxDistanceKm,
    minAge: optionalNumber(draft.minAge) ?? 18,
    maxAge: optionalNumber(draft.maxAge) ?? 99,
    minHeightCm: optionalNumber(draft.minHeightCm),
    maxHeightCm: optionalNumber(draft.maxHeightCm),
    minWeightKg: optionalNumber(draft.minWeightKg),
    maxWeightKg: optionalNumber(draft.maxWeightKg),
    relationshipStatuses: draft.relationshipStatuses,
    childrenStatuses: draft.childrenStatuses,
    smokingStatuses: draft.smokingStatuses,
    drinkingStatuses: draft.drinkingStatuses,
    educationLevels: draft.educationLevels,
    lifestyleTags: draft.lifestyleTags,
    languages: draft.languagesText
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)
      .slice(0, 8),
    hasPhoto: draft.hasPhoto ? true : null,
    onlineNow: draft.onlineNow ? true : null,
    occupationText: draft.occupationText.trim() || null,
    profileText: draft.profileText.trim() || null,
  };
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function activeFilterCount(input: SearchLuxyProfilesInput): number {
  let count = 0;
  if (input.provinceId) count += 1;
  if (input.maxDistanceKm) count += 1;
  if ((input.minAge ?? 18) !== 18 || (input.maxAge ?? 99) !== 99) count += 1;
  if (input.minHeightCm || input.maxHeightCm) count += 1;
  if (input.minWeightKg || input.maxWeightKg) count += 1;
  if (input.relationshipStatuses?.length) count += 1;
  if (input.childrenStatuses?.length) count += 1;
  if (input.smokingStatuses?.length) count += 1;
  if (input.drinkingStatuses?.length) count += 1;
  if (input.educationLevels?.length) count += 1;
  if (input.lifestyleTags?.length) count += 1;
  if (input.languages?.length) count += 1;
  if (input.hasPhoto) count += 1;
  if (input.onlineNow) count += 1;
  if (input.occupationText) count += 1;
  if (input.profileText) count += 1;
  return count;
}

export function LuxySearchMobile() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DraftFilters>(DEFAULT_DRAFT);
  const [sort, setSort] = useState<LuxySearchSort>('distance');
  const [applied, setApplied] = useState<SearchLuxyProfilesInput>(() => toSearchInput(DEFAULT_DRAFT, 'distance'));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const provincesQuery = useQuery({
    queryKey: ['luxy-search', 'provinces', 'VN'],
    enabled: Boolean(client),
    staleTime: 24 * 60 * 60 * 1_000,
    gcTime: 24 * 60 * 60 * 1_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listActiveProvinces(client);
    },
  });

  const contextQuery = useQuery({
    queryKey: ['luxy-search', 'context', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyDiscoveryContext(client);
    },
  });

  const profilesQuery = useInfiniteQuery({
    queryKey: ['luxy-search', 'profiles', auth.userId, applied],
    enabled: Boolean(client && auth.userId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!client) throw new Error('supabase_not_configured');
      return searchLuxyProfilesV2(client, {
        ...applied,
        limit: LUXY_SEARCH_DEFAULT_PAGE_SIZE,
        offset: pageParam,
      });
    },
    getNextPageParam: (_lastPage, pages) => getNextLuxySearchOffset(
      pages.map((page) => page.length),
      LUXY_SEARCH_DEFAULT_PAGE_SIZE,
      LUXY_SEARCH_MAX_RESULTS,
    ),
  });

  const profiles = useMemo(() => {
    const seen = new Set<string>();
    return (profilesQuery.data?.pages.flat() ?? []).filter((profile) => {
      if (seen.has(profile.id)) return false;
      seen.add(profile.id);
      return true;
    });
  }, [profilesQuery.data?.pages]);

  const selectedProvince = (provincesQuery.data ?? []).find((item) => item.id === draft.provinceId) ?? null;
  const activeSort = SORT_OPTIONS.find((item) => item.value === sort) ?? SORT_OPTIONS[0]!;
  const appliedCount = activeFilterCount(applied);

  function applyFilters() {
    try {
      setFilterError(null);
      setApplied(toSearchInput(draft, sort));
      setFiltersOpen(false);
      setProvinceOpen(false);
    } catch {
      setFilterError('Một số bộ lọc chưa hợp lệ. Vui lòng kiểm tra lại khoảng giá trị.');
    }
  }

  function resetFilters() {
    const next = { ...DEFAULT_DRAFT };
    setDraft(next);
    setSort('distance');
    setFilterError(null);
    setProvinceOpen(false);
    setApplied(toSearchInput(next, 'distance'));
  }

  function changeSort(nextSort: LuxySearchSort) {
    setSort(nextSort);
    setApplied((current) => ({ ...current, sort: nextSort }));
    setSortOpen(false);
  }

  async function updateLocation() {
    if (!client) return;
    setLocationBusy(true);
    setLocationError(null);
    setLocationMessage(null);
    try {
      const location = await requestDiscoveryLocation();
      await setMyDiscoveryLocation(client, location);
      await contextQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ['luxy-search', 'profiles', auth.userId] });
      setLocationMessage('Đã cập nhật vị trí. Kết quả Gần nhất đã được làm mới.');
    } catch (error) {
      setLocationError(getReadableLocationError(error));
    } finally {
      setLocationBusy(false);
    }
  }

  return (
    <View style={styles.screen} testID="luxy-search-mobile">
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator>
        <View style={styles.toolbar} testID="luxy-search-mobile-toolbar">
          <View style={styles.toolbarTitleBlock}>
            <Text accessibilityRole="header" style={styles.title}>Tìm kiếm</Text>
            <Text style={styles.resultCount}>{profiles.length ? `${profiles.length} thành viên` : 'Khám phá thành viên Luxy'}</Text>
          </View>
          <View style={styles.toolbarActions}>
            <Pressable
              accessibilityLabel={`Bộ lọc${appliedCount ? `, ${appliedCount} đang áp dụng` : ''}`}
              accessibilityRole="button"
              onPress={() => setFiltersOpen(true)}
              style={styles.toolbarButton}
              testID="luxy-search-mobile-filter-button"
            >
              <Text style={styles.toolbarButtonIcon}>≡</Text>
              <Text style={styles.toolbarButtonText}>Bộ lọc</Text>
              {appliedCount ? (
                <View style={styles.filterCountBadge}><Text style={styles.filterCountText}>{appliedCount}</Text></View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityLabel={`Sắp xếp: ${activeSort.label}`}
              accessibilityRole="button"
              onPress={() => setSortOpen(true)}
              style={styles.toolbarButton}
              testID="luxy-search-mobile-sort-button"
            >
              <Text style={styles.toolbarButtonIcon}>↕</Text>
              <Text numberOfLines={1} style={styles.toolbarButtonText}>Sắp xếp</Text>
            </Pressable>
          </View>
        </View>

        {profilesQuery.isLoading && profiles.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={luxyColors.ink} size="large" />
            <Text style={styles.stateText}>Đang tìm thành viên phù hợp…</Text>
          </View>
        ) : profilesQuery.error ? (
          <View style={styles.centerState}>
            <Text accessibilityRole="alert" style={styles.errorText}>Không thể tải kết quả tìm kiếm.</Text>
            <Pressable accessibilityRole="button" onPress={() => void profilesQuery.refetch()} style={styles.primaryPill}>
              <Text style={styles.primaryPillText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>Chưa có thành viên phù hợp</Text>
            <Text style={styles.stateText}>Hãy nới khoảng cách hoặc đặt lại một vài bộ lọc.</Text>
            <Pressable accessibilityRole="button" onPress={() => setFiltersOpen(true)} style={styles.secondaryPill}>
              <Text style={styles.secondaryPillText}>Mở bộ lọc</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.memberGrid} testID="luxy-search-mobile-grid">
            {profiles.map((profile) => <LuxyMobileMemberCard key={profile.id} profile={profile} />)}
          </View>
        )}

        {profilesQuery.isFetchingNextPage ? (
          <View style={styles.loadMoreState}>
            <ActivityIndicator color={luxyColors.ink} />
            <Text style={styles.stateText}>Đang tải thêm…</Text>
          </View>
        ) : profilesQuery.hasNextPage ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void profilesQuery.fetchNextPage()}
            style={styles.loadMoreButton}
          >
            <Text style={styles.loadMoreText}>Xem thêm thành viên</Text>
          </Pressable>
        ) : profiles.length > 0 ? (
          <Text style={styles.endText}>Bạn đã xem hết kết quả hiện có.</Text>
        ) : null}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
        transparent
        visible={filtersOpen}
      >
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="Đóng bộ lọc" accessibilityRole="button" onPress={() => setFiltersOpen(false)} style={styles.backdropDismiss} />
          <View style={styles.filterSheet} testID="luxy-search-mobile-filter-sheet">
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Pressable accessibilityRole="button" onPress={() => setFiltersOpen(false)} style={styles.sheetHeaderAction}>
                <Text style={styles.sheetHeaderActionText}>Đóng</Text>
              </Pressable>
              <Text accessibilityRole="header" style={styles.sheetTitle}>Bộ lọc tìm kiếm</Text>
              <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.sheetHeaderAction}>
                <Text style={styles.sheetResetText}>Đặt lại</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.filterContent} showsVerticalScrollIndicator>
              <MobileFilterSection title="Khu vực">
                <Pressable accessibilityRole="button" onPress={() => setProvinceOpen((value) => !value)} style={styles.selectControl}>
                  <Text style={styles.selectText}>{selectedProvince?.name ?? 'Toàn Việt Nam'}</Text>
                  <Text style={styles.chevron}>⌄</Text>
                </Pressable>
                {provinceOpen ? (
                  <View style={styles.provincePanel}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setDraft((current) => ({ ...current, provinceId: null }));
                        setProvinceOpen(false);
                      }}
                      style={styles.provinceOption}
                    >
                      <Text style={styles.provinceOptionText}>Toàn Việt Nam</Text>
                    </Pressable>
                    <ScrollView nestedScrollEnabled style={styles.provinceList}>
                      {(provincesQuery.data ?? []).map((province) => (
                        <ProvinceRow
                          key={province.id}
                          province={province}
                          selected={draft.provinceId === province.id}
                          onPress={() => {
                            setDraft((current) => ({ ...current, provinceId: province.id }));
                            setProvinceOpen(false);
                          }}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                <Pressable accessibilityRole="button" disabled={locationBusy} onPress={updateLocation} style={styles.locationAction}>
                  <Text style={styles.locationActionText}>{locationBusy ? 'Đang cập nhật…' : '⌖  Cập nhật vị trí của tôi'}</Text>
                </Pressable>
                <Text style={styles.helperText}>
                  {contextQuery.data?.has_fresh_location
                    ? 'Vị trí đang hoạt động; chỉ hiển thị khoảng cách làm tròn.'
                    : 'Bật vị trí để xếp thành viên gần → xa trên toàn Việt Nam.'}
                </Text>
                {locationMessage ? <Text accessibilityRole="alert" style={styles.successText}>{locationMessage}</Text> : null}
                {locationError ? <Text accessibilityRole="alert" style={styles.errorText}>{locationError}</Text> : null}
              </MobileFilterSection>

              <MobileFilterSection title="Khoảng cách">
                <View style={styles.chipWrap}>
                  {DISTANCE_OPTIONS.map((distance) => (
                    <FilterChip
                      key={distance}
                      active={draft.maxDistanceKm === distance}
                      label={`${distance} km`}
                      onPress={() => setDraft((current) => ({ ...current, maxDistanceKm: distance }))}
                    />
                  ))}
                  <FilterChip active={draft.maxDistanceKm === null} label="Tất cả" onPress={() => setDraft((current) => ({ ...current, maxDistanceKm: null }))} />
                </View>
              </MobileFilterSection>

              <MobileFilterSection title="Tùy chọn">
                <CheckRow checked={draft.hasPhoto} label="Có ảnh" onPress={() => setDraft((current) => ({ ...current, hasPhoto: !current.hasPhoto }))} />
                <CheckRow checked={draft.onlineNow} label="Đang online" onPress={() => setDraft((current) => ({ ...current, onlineNow: !current.onlineNow }))} />
                <DisabledCheckRow label="Đã xác thực ảnh" suffix="LX-20" />
                <DisabledCheckRow label="Đã xác thực CCCD" suffix="LX-20" />
                <DisabledCheckRow label="Chưa xem / Đã xem" suffix="LX-12" />
                <DisabledCheckRow label="Yêu thích / Yêu thích tôi" suffix="LX-12" />
              </MobileFilterSection>

              <MobileFilterSection title="Tuổi">
                <RangeInputs
                  leftLabel="Từ"
                  leftValue={draft.minAge}
                  rightLabel="Đến"
                  rightValue={draft.maxAge}
                  onLeftChange={(value) => setDraft((current) => ({ ...current, minAge: value }))}
                  onRightChange={(value) => setDraft((current) => ({ ...current, maxAge: value }))}
                />
              </MobileFilterSection>

              <MobileFilterSection title="Thành viên đang tìm">
                <View style={styles.chipWrap}>
                  {LIFESTYLE_OPTIONS.map((item) => (
                    <FilterChip
                      key={item.value}
                      active={draft.lifestyleTags.includes(item.value)}
                      label={item.label}
                      onPress={() => setDraft((current) => ({
                        ...current,
                        lifestyleTags: toggleValue(current.lifestyleTags, item.value),
                      }))}
                    />
                  ))}
                </View>
              </MobileFilterSection>

              <MobileFilterSection title="Tình trạng quan hệ">
                {RELATIONSHIP_OPTIONS.map((item) => (
                  <CheckRow
                    key={item.value}
                    checked={draft.relationshipStatuses.includes(item.value)}
                    label={item.label}
                    onPress={() => setDraft((current) => ({
                      ...current,
                      relationshipStatuses: toggleValue(current.relationshipStatuses, item.value),
                    }))}
                  />
                ))}
              </MobileFilterSection>

              <MobileFilterSection title="Chiều cao">
                <RangeInputs
                  leftLabel="Từ cm"
                  leftValue={draft.minHeightCm}
                  rightLabel="Đến cm"
                  rightValue={draft.maxHeightCm}
                  onLeftChange={(value) => setDraft((current) => ({ ...current, minHeightCm: value }))}
                  onRightChange={(value) => setDraft((current) => ({ ...current, maxHeightCm: value }))}
                />
              </MobileFilterSection>

              <MobileFilterSection title="Cân nặng">
                <RangeInputs
                  leftLabel="Từ kg"
                  leftValue={draft.minWeightKg}
                  rightLabel="Đến kg"
                  rightValue={draft.maxWeightKg}
                  onLeftChange={(value) => setDraft((current) => ({ ...current, minWeightKg: value }))}
                  onRightChange={(value) => setDraft((current) => ({ ...current, maxWeightKg: value }))}
                />
              </MobileFilterSection>

              <MobileFilterSection title="Hút thuốc">
                {SMOKING_OPTIONS.map((item) => (
                  <CheckRow
                    key={item.value}
                    checked={draft.smokingStatuses.includes(item.value)}
                    label={item.label}
                    onPress={() => setDraft((current) => ({ ...current, smokingStatuses: toggleValue(current.smokingStatuses, item.value) }))}
                  />
                ))}
              </MobileFilterSection>

              <MobileFilterSection title="Uống rượu/bia">
                {DRINKING_OPTIONS.map((item) => (
                  <CheckRow
                    key={item.value}
                    checked={draft.drinkingStatuses.includes(item.value)}
                    label={item.label}
                    onPress={() => setDraft((current) => ({ ...current, drinkingStatuses: toggleValue(current.drinkingStatuses, item.value) }))}
                  />
                ))}
              </MobileFilterSection>

              <MobileFilterSection title="Học vấn">
                {EDUCATION_OPTIONS.map((item) => (
                  <CheckRow
                    key={item.value}
                    checked={draft.educationLevels.includes(item.value)}
                    label={item.label}
                    onPress={() => setDraft((current) => ({ ...current, educationLevels: toggleValue(current.educationLevels, item.value) }))}
                  />
                ))}
              </MobileFilterSection>

              <MobileFilterSection title="Con cái">
                {CHILDREN_OPTIONS.map((item) => (
                  <CheckRow
                    key={item.value}
                    checked={draft.childrenStatuses.includes(item.value)}
                    label={item.label}
                    onPress={() => setDraft((current) => ({ ...current, childrenStatuses: toggleValue(current.childrenStatuses, item.value) }))}
                  />
                ))}
              </MobileFilterSection>

              <MobileFilterSection title="Ngôn ngữ">
                <TextInput
                  accessibilityLabel="Ngôn ngữ, phân tách bằng dấu phẩy"
                  onChangeText={(value) => setDraft((current) => ({ ...current, languagesText: value }))}
                  placeholder="Tiếng Việt, English"
                  placeholderTextColor={luxyColors.softMuted}
                  style={styles.textControl}
                  value={draft.languagesText}
                />
              </MobileFilterSection>

              <MobileFilterSection title="Nghề nghiệp">
                <TextInput
                  accessibilityLabel="Tìm theo nghề nghiệp"
                  onChangeText={(value) => setDraft((current) => ({ ...current, occupationText: value }))}
                  placeholder="Ví dụ: kiến trúc sư"
                  placeholderTextColor={luxyColors.softMuted}
                  style={styles.textControl}
                  value={draft.occupationText}
                />
              </MobileFilterSection>

              <MobileFilterSection title="Tìm trong hồ sơ" last>
                <TextInput
                  accessibilityLabel="Tìm trong nội dung hồ sơ"
                  multiline
                  onChangeText={(value) => setDraft((current) => ({ ...current, profileText: value }))}
                  placeholder="Ví dụ: du lịch, ẩm thực…"
                  placeholderTextColor={luxyColors.softMuted}
                  style={[styles.textControl, styles.multilineControl]}
                  value={draft.profileText}
                />
              </MobileFilterSection>

              {filterError ? <Text accessibilityRole="alert" style={styles.errorText}>{filterError}</Text> : null}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable accessibilityRole="button" disabled style={[styles.saveSearchButton, styles.disabledAction]}>
                <Text style={styles.saveSearchText}>Lưu tìm kiếm</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={applyFilters} style={styles.applyButton} testID="luxy-search-mobile-filter-apply">
                <Text style={styles.applyButtonText}>Xem kết quả</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setSortOpen(false)} transparent visible={sortOpen}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="Đóng sắp xếp" accessibilityRole="button" onPress={() => setSortOpen(false)} style={styles.backdropDismiss} />
          <View style={styles.sortSheet} testID="luxy-search-mobile-sort-sheet">
            <View style={styles.sheetHandle} />
            <Text accessibilityRole="header" style={styles.sortTitle}>Sắp xếp</Text>
            {SORT_OPTIONS.map((option) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: option.value === sort }}
                key={option.value}
                onPress={() => changeSort(option.value)}
                style={styles.sortRow}
                testID={`luxy-search-mobile-sort-${option.value}`}
              >
                <Text style={styles.sortRowText}>{option.label}</Text>
                <View style={[styles.radioOuter, option.value === sort && styles.radioOuterActive]}>
                  {option.value === sort ? <View style={styles.radioInner} /> : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MobileFilterSection({ title, children, last = false }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.filterSection, last && styles.filterSectionLast]}>
      <Text style={styles.filterHeading}>{title}</Text>
      <View style={styles.filterBody}>{children}</View>
    </View>
  );
}

function ProvinceRow({ province, selected, onPress }: { province: ProvinceOption; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.provinceOption, selected && styles.provinceOptionActive]}>
      <Text style={styles.provinceOptionText}>{province.name}</Text>
      {selected ? <Text style={styles.selectedMark}>✓</Text> : null}
    </Pressable>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function CheckRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkRow}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Text style={styles.checkmark}>✓</Text> : null}</View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

function DisabledCheckRow({ label, suffix }: { label: string; suffix: string }) {
  return (
    <View accessibilityState={{ disabled: true }} style={styles.checkRow}>
      <View style={[styles.checkbox, styles.checkboxDisabled]} />
      <Text style={styles.disabledLabel}>{label}</Text>
      <Text style={styles.comingSoon}>{suffix}</Text>
    </View>
  );
}

function RangeInputs({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  onLeftChange,
  onRightChange,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
}) {
  return (
    <View style={styles.rangeRow}>
      <View style={styles.rangeField}>
        <Text style={styles.rangeLabel}>{leftLabel}</Text>
        <TextInput keyboardType="number-pad" onChangeText={onLeftChange} style={styles.rangeInput} value={leftValue} />
      </View>
      <Text style={styles.rangeDash}>–</Text>
      <View style={styles.rangeField}>
        <Text style={styles.rangeLabel}>{rightLabel}</Text>
        <TextInput keyboardType="number-pad" onChangeText={onRightChange} style={styles.rangeInput} value={rightValue} />
      </View>
    </View>
  );
}

function LuxyMobileMemberCard({ profile }: { profile: LuxySearchProfile }) {
  const router = useRouter();
  const client = getMobileSupabaseClient();
  const name = profile.display_name || profile.username || 'Thành viên Luxy';
  const distance = formatLuxyDistance(profile.distance_km);
  const location = [profile.province_name, distance].filter(Boolean).join(' · ');
  const imageQuery = useQuery({
    queryKey: ['luxy-search', 'member-photo', profile.avatar_media_id],
    enabled: Boolean(client && profile.avatar_media_id && profile.avatar_storage_bucket && profile.avatar_storage_path),
    staleTime: 35_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!client || !profile.avatar_storage_bucket || !profile.avatar_storage_path) return null;
      return createPrivateMediaUrl(client, {
        storage_bucket: profile.avatar_storage_bucket,
        storage_path: profile.avatar_storage_path,
      });
    },
  });

  return (
    <Pressable
      accessibilityLabel={`Xem hồ sơ ${name}, ${profile.age} tuổi${location ? `, ${location}` : ''}`}
      accessibilityRole="button"
      disabled={!profile.username}
      onPress={() => profile.username && router.push({ pathname: '/profile/[username]', params: { username: profile.username } })}
      style={({ pressed }) => [styles.memberCard, pressed && styles.memberCardPressed]}
      testID="luxy-search-mobile-card"
    >
      <View style={styles.photoFrame}>
        {imageQuery.data ? (
          <Image accessibilityLabel={`Ảnh hồ sơ của ${name}`} resizeMode="cover" source={{ uri: imageQuery.data }} style={styles.memberPhoto} />
        ) : (
          <View style={styles.photoFallback}><Text style={styles.photoInitial}>{name.slice(0, 1).toUpperCase()}</Text></View>
        )}
        <View style={styles.photoCountBadge}><Text style={styles.photoCountText}>▣ {profile.photo_count}</Text></View>
        <View style={styles.photoOverlay}>
          <View style={styles.memberNameRow}>
            {profile.is_online ? <View accessibilityLabel="Đang online" style={styles.onlineDot} /> : null}
            <Text numberOfLines={1} style={styles.memberName}>{name}</Text>
            <Text style={styles.memberAge}>{profile.age}</Text>
          </View>
          <View style={styles.cardBottomRow}>
            <Text numberOfLines={1} style={styles.memberLocation}>{location || 'Việt Nam'}</Text>
            <View style={styles.cardIcons}>
              <View style={styles.cardIcon}><Text style={styles.cardIconText}>▰</Text></View>
              <View style={styles.cardIcon}><Text style={styles.cardIconText}>♡</Text></View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: '100%', backgroundColor: luxyColors.background },
  page: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingTop: luxySpacing.md,
    paddingBottom: luxySpacing.huge,
  },
  toolbar: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: luxyColors.border,
  },
  toolbarTitleBlock: { flex: 1, minWidth: 0 },
  title: {
    color: luxyColors.text,
    fontFamily: luxyTypography.families.display,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '400',
  },
  resultCount: { color: luxyColors.muted, fontSize: 11, marginTop: 2 },
  toolbarActions: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  toolbarButton: {
    minHeight: 44,
    minWidth: 74,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.pill,
    backgroundColor: luxyColors.surface,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    position: 'relative',
  },
  toolbarButtonIcon: { color: luxyColors.text, fontSize: 15, lineHeight: 18 },
  toolbarButtonText: { color: luxyColors.text, fontSize: 11, fontWeight: '600' },
  filterCountBadge: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: luxyColors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { color: luxyColors.surface, fontSize: 9, fontWeight: '700' },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' },
  memberCard: { width: '49%', flexGrow: 1, maxWidth: '49.2%' },
  memberCardPressed: { opacity: 0.84 },
  photoFrame: {
    width: '100%',
    aspectRatio: luxyLayout.memberCardAspectRatio,
    borderRadius: luxyRadii.sm,
    overflow: 'hidden',
    backgroundColor: luxyColors.elevatedSubtle,
    position: 'relative',
  },
  memberPhoto: { width: '100%', height: '100%' },
  photoFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7E5E4' },
  photoInitial: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 42 },
  photoCountBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    minHeight: 22,
    borderRadius: luxyRadii.xs,
    backgroundColor: 'rgba(8,23,38,0.76)',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  photoCountText: { color: luxyColors.surface, fontSize: 9, fontWeight: '600' },
  photoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 74,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 22,
    paddingBottom: 7,
    backgroundColor: 'rgba(8,23,38,0.60)',
  },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: luxyColors.online },
  memberName: { flexShrink: 1, color: luxyColors.surface, fontSize: 12, fontWeight: '600' },
  memberAge: { color: luxyColors.surface, fontSize: 11 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  memberLocation: { flex: 1, minWidth: 0, color: '#F1F1F1', fontSize: 9 },
  cardIcons: { flexDirection: 'row', gap: 3 },
  cardIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' },
  cardIconText: { color: luxyColors.surface, fontSize: 11 },
  centerState: { minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: luxySpacing.md, paddingHorizontal: luxySpacing.xl },
  stateText: { color: luxyColors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyTitle: { color: luxyColors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  errorText: { color: luxyColors.danger, fontSize: 12, lineHeight: 18 },
  successText: { color: '#166534', fontSize: 11, lineHeight: 16 },
  primaryPill: { minHeight: 44, borderRadius: luxyRadii.pill, backgroundColor: luxyColors.ink, justifyContent: 'center', paddingHorizontal: luxySpacing.xl },
  primaryPillText: { color: luxyColors.surface, fontSize: 12, fontWeight: '600' },
  secondaryPill: { minHeight: 44, borderRadius: luxyRadii.pill, borderWidth: 1, borderColor: luxyColors.ink, justifyContent: 'center', paddingHorizontal: luxySpacing.xl },
  secondaryPillText: { color: luxyColors.text, fontSize: 12, fontWeight: '600' },
  loadMoreButton: {
    alignSelf: 'center',
    minHeight: 44,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    borderColor: luxyColors.ink,
    justifyContent: 'center',
    paddingHorizontal: luxySpacing.xl,
    marginTop: luxySpacing.xl,
  },
  loadMoreText: { color: luxyColors.text, fontSize: 12, fontWeight: '600' },
  loadMoreState: { alignItems: 'center', gap: luxySpacing.sm, paddingVertical: luxySpacing.xl },
  endText: { color: luxyColors.softMuted, fontSize: 11, textAlign: 'center', paddingVertical: luxySpacing.xl },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,23,38,0.38)' },
  backdropDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  filterSheet: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: luxyColors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: luxyColors.borderStrong, alignSelf: 'center', marginTop: 8 },
  sheetHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: luxyColors.border,
    paddingHorizontal: 8,
  },
  sheetHeaderAction: { minWidth: 66, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sheetHeaderActionText: { color: luxyColors.muted, fontSize: 12 },
  sheetResetText: { color: luxyColors.actionAccessible, fontSize: 12, fontWeight: '600' },
  sheetTitle: { color: luxyColors.text, fontSize: 16, fontWeight: '600' },
  filterContent: { paddingHorizontal: 16, paddingBottom: 18 },
  filterSection: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: luxyColors.border },
  filterSectionLast: { borderBottomWidth: 0 },
  filterHeading: { color: luxyColors.text, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  filterBody: { gap: 7 },
  selectControl: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.xs,
    backgroundColor: luxyColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  selectText: { color: luxyColors.text, fontSize: 12 },
  chevron: { color: luxyColors.muted, fontSize: 14 },
  provincePanel: { borderWidth: 1, borderColor: luxyColors.border, borderRadius: luxyRadii.xs, overflow: 'hidden' },
  provinceList: { maxHeight: 240 },
  provinceOption: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: luxyColors.surface },
  provinceOptionActive: { backgroundColor: luxyColors.elevatedSubtle },
  provinceOptionText: { color: luxyColors.text, fontSize: 12 },
  selectedMark: { color: luxyColors.ink, fontSize: 12, fontWeight: '700' },
  locationAction: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  locationActionText: { color: luxyColors.text, fontSize: 12, fontWeight: '600' },
  helperText: { color: luxyColors.softMuted, fontSize: 11, lineHeight: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    paddingHorizontal: 11,
    backgroundColor: luxyColors.surface,
  },
  filterChipActive: { borderColor: luxyColors.ink, backgroundColor: luxyColors.elevatedSubtle },
  filterChipText: { color: luxyColors.muted, fontSize: 11 },
  filterChipTextActive: { color: luxyColors.text, fontWeight: '600' },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: luxyColors.borderStrong, borderRadius: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: luxyColors.surface },
  checkboxChecked: { backgroundColor: luxyColors.ink, borderColor: luxyColors.ink },
  checkboxDisabled: { backgroundColor: luxyColors.elevatedSubtle },
  checkmark: { color: luxyColors.surface, fontSize: 12, fontWeight: '700' },
  checkLabel: { flex: 1, color: luxyColors.text, fontSize: 12 },
  disabledLabel: { flex: 1, color: luxyColors.softMuted, fontSize: 12 },
  comingSoon: { color: luxyColors.softMuted, fontSize: 9 },
  rangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  rangeField: { flex: 1, gap: 5 },
  rangeLabel: { color: luxyColors.softMuted, fontSize: 10 },
  rangeInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.xs,
    backgroundColor: luxyColors.surface,
    paddingHorizontal: 10,
    color: luxyColors.text,
    fontSize: 12,
  },
  rangeDash: { color: luxyColors.softMuted, paddingBottom: 13 },
  textControl: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.xs,
    backgroundColor: luxyColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: luxyColors.text,
    fontSize: 12,
  },
  multilineControl: { minHeight: 84, textAlignVertical: 'top' },
  sheetFooter: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: luxyColors.border, backgroundColor: luxyColors.surface },
  saveSearchButton: { minHeight: 48, minWidth: 112, borderRadius: luxyRadii.pill, borderWidth: 1, borderColor: luxyColors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  saveSearchText: { color: luxyColors.text, fontSize: 11, fontWeight: '600' },
  disabledAction: { opacity: 0.5 },
  applyButton: { flex: 1, minHeight: 48, borderRadius: luxyRadii.pill, backgroundColor: luxyColors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  applyButtonText: { color: luxyColors.surface, fontSize: 12, fontWeight: '700' },
  sortSheet: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    backgroundColor: luxyColors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 18,
  },
  sortTitle: { color: luxyColors.text, fontSize: 17, fontWeight: '600', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  sortRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  sortRowText: { color: luxyColors.text, fontSize: 13 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: luxyColors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: luxyColors.ink },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: luxyColors.ink },
});
