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
import {
  luxyColors,
  luxyLayout,
  luxyRadii,
  luxySpacing,
  luxyTypography,
} from '@myfan/ui';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  const languages = draft.languagesText
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 8);
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
    languages,
    hasPhoto: draft.hasPhoto ? true : null,
    onlineNow: draft.onlineNow ? true : null,
    occupationText: draft.occupationText.trim() || null,
    profileText: draft.profileText.trim() || null,
  };
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function LuxySearchDesktop() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DraftFilters>(DEFAULT_DRAFT);
  const [sort, setSort] = useState<LuxySearchSort>('distance');
  const [applied, setApplied] = useState<SearchLuxyProfilesInput>(() => toSearchInput(DEFAULT_DRAFT, 'distance'));
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
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
  const activeSort = SORT_OPTIONS.find((item) => item.value === sort) ?? SORT_OPTIONS[0];

  function applyFilters(nextDraft = draft, nextSort = sort) {
    try {
      setFilterError(null);
      setApplied(toSearchInput(nextDraft, nextSort));
    } catch {
      setFilterError('Một số bộ lọc chưa hợp lệ. Vui lòng kiểm tra lại khoảng giá trị.');
    }
  }

  function resetFilters() {
    const next = { ...DEFAULT_DRAFT };
    setDraft(next);
    setSort('distance');
    setProvinceOpen(false);
    setSortOpen(false);
    setFilterError(null);
    setApplied(toSearchInput(next, 'distance'));
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
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator
      testID="luxy-search-desktop"
    >
      <View style={styles.frame}>
        <View style={styles.sidebar} testID="luxy-search-filter-rail">
          <Text accessibilityRole="header" style={styles.filterTitle}>Bộ lọc tìm kiếm</Text>

          <View style={styles.savedSearchRow}>
            <Text style={styles.savedSearchText}>Tìm kiếm đã lưu</Text>
            <Text style={styles.chevron}>⌄</Text>
          </View>

          <Pressable accessibilityRole="button" onPress={() => applyFilters()} style={styles.viewResultsButton}>
            <Text style={styles.viewResultsText}>Xem kết quả</Text>
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityHint="Tính năng lưu bộ lọc sẽ được kích hoạt trong phiên Yêu thích"
              accessibilityRole="button"
              disabled
              style={[styles.secondaryAction, styles.disabledAction]}
            >
              <Text style={styles.secondaryActionText}>Lưu tìm kiếm</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.resetAction}>
              <Text style={styles.resetActionText}>Đặt lại</Text>
            </Pressable>
          </View>

          <FilterSection title="Khu vực">
            <Pressable
              accessibilityRole="button"
              onPress={() => setProvinceOpen((value) => !value)}
              style={styles.selectControl}
            >
              <Text style={selectedProvince ? styles.selectValue : styles.selectPlaceholder}>
                {selectedProvince?.name ?? 'Toàn Việt Nam'}
              </Text>
              <Text style={styles.chevron}>⌄</Text>
            </Pressable>
            {provinceOpen ? (
              <View style={styles.dropdownPanel}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setDraft((current) => ({ ...current, provinceId: null }));
                    setProvinceOpen(false);
                  }}
                  style={styles.dropdownOption}
                >
                  <Text style={styles.dropdownOptionText}>Toàn Việt Nam</Text>
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
            <Pressable accessibilityRole="button" disabled={locationBusy} onPress={updateLocation} style={styles.locationButton}>
              <Text style={styles.locationButtonText}>{locationBusy ? 'Đang cập nhật…' : '⌖  Cập nhật vị trí của tôi'}</Text>
            </Pressable>
            <Text style={styles.helperText}>
              {contextQuery.data?.has_fresh_location
                ? 'Vị trí đang hoạt động; hệ thống chỉ trả khoảng cách làm tròn.'
                : 'Bật vị trí để xếp thành viên gần → xa trên toàn Việt Nam.'}
            </Text>
            {locationMessage ? <Text accessibilityRole="alert" style={styles.successText}>{locationMessage}</Text> : null}
            {locationError ? <Text accessibilityRole="alert" style={styles.errorText}>{locationError}</Text> : null}
          </FilterSection>

          <FilterSection title="Khoảng cách">
            <View style={styles.chipRow}>
              {DISTANCE_OPTIONS.map((distance) => (
                <FilterChip
                  key={distance}
                  active={draft.maxDistanceKm === distance}
                  label={`${distance} km`}
                  onPress={() => setDraft((current) => ({ ...current, maxDistanceKm: distance }))}
                />
              ))}
              <FilterChip
                active={draft.maxDistanceKm === null}
                label="Tất cả"
                onPress={() => setDraft((current) => ({ ...current, maxDistanceKm: null }))}
              />
            </View>
          </FilterSection>

          <FilterSection title="Tùy chọn">
            <CheckRow
              checked={draft.hasPhoto}
              label="Có ảnh"
              onPress={() => setDraft((current) => ({ ...current, hasPhoto: !current.hasPhoto }))}
            />
            <CheckRow
              checked={draft.onlineNow}
              label="Đang online"
              onPress={() => setDraft((current) => ({ ...current, onlineNow: !current.onlineNow }))}
            />
            <DisabledCheckRow label="Đã xác thực ảnh" suffix="LX-20" />
            <DisabledCheckRow label="Đã xác thực CCCD" suffix="LX-20" />
            <DisabledCheckRow label="Chưa xem / Đã xem" suffix="LX-12" />
            <DisabledCheckRow label="Yêu thích / Yêu thích tôi" suffix="LX-12" />
          </FilterSection>

          <FilterSection title="Tuổi">
            <RangeInputs
              leftLabel="Từ"
              leftValue={draft.minAge}
              rightLabel="Đến"
              rightValue={draft.maxAge}
              onLeftChange={(value) => setDraft((current) => ({ ...current, minAge: value }))}
              onRightChange={(value) => setDraft((current) => ({ ...current, maxAge: value }))}
            />
          </FilterSection>

          <FilterSection title="Thành viên đang tìm">
            <View style={styles.tagWrap}>
              {LIFESTYLE_OPTIONS.map((item) => (
                <TagButton
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
          </FilterSection>

          <FilterSection title="Cân nặng">
            <RangeInputs
              leftLabel="Từ kg"
              leftValue={draft.minWeightKg}
              rightLabel="Đến kg"
              rightValue={draft.maxWeightKg}
              onLeftChange={(value) => setDraft((current) => ({ ...current, minWeightKg: value }))}
              onRightChange={(value) => setDraft((current) => ({ ...current, maxWeightKg: value }))}
            />
          </FilterSection>

          <FilterSection title="Tình trạng quan hệ">
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
          </FilterSection>

          <FilterSection title="Chiều cao">
            <RangeInputs
              leftLabel="Từ cm"
              leftValue={draft.minHeightCm}
              rightLabel="Đến cm"
              rightValue={draft.maxHeightCm}
              onLeftChange={(value) => setDraft((current) => ({ ...current, minHeightCm: value }))}
              onRightChange={(value) => setDraft((current) => ({ ...current, maxHeightCm: value }))}
            />
          </FilterSection>

          <FilterSection title="Hút thuốc">
            {SMOKING_OPTIONS.map((item) => (
              <CheckRow
                key={item.value}
                checked={draft.smokingStatuses.includes(item.value)}
                label={item.label}
                onPress={() => setDraft((current) => ({
                  ...current,
                  smokingStatuses: toggleValue(current.smokingStatuses, item.value),
                }))}
              />
            ))}
          </FilterSection>

          <FilterSection title="Uống rượu/bia">
            {DRINKING_OPTIONS.map((item) => (
              <CheckRow
                key={item.value}
                checked={draft.drinkingStatuses.includes(item.value)}
                label={item.label}
                onPress={() => setDraft((current) => ({
                  ...current,
                  drinkingStatuses: toggleValue(current.drinkingStatuses, item.value),
                }))}
              />
            ))}
          </FilterSection>

          <FilterSection title="Học vấn">
            {EDUCATION_OPTIONS.map((item) => (
              <CheckRow
                key={item.value}
                checked={draft.educationLevels.includes(item.value)}
                label={item.label}
                onPress={() => setDraft((current) => ({
                  ...current,
                  educationLevels: toggleValue(current.educationLevels, item.value),
                }))}
              />
            ))}
          </FilterSection>

          <FilterSection title="Con cái">
            {CHILDREN_OPTIONS.map((item) => (
              <CheckRow
                key={item.value}
                checked={draft.childrenStatuses.includes(item.value)}
                label={item.label}
                onPress={() => setDraft((current) => ({
                  ...current,
                  childrenStatuses: toggleValue(current.childrenStatuses, item.value),
                }))}
              />
            ))}
          </FilterSection>

          <FilterSection title="Ngôn ngữ">
            <TextInput
              accessibilityLabel="Ngôn ngữ, phân tách bằng dấu phẩy"
              onChangeText={(value) => setDraft((current) => ({ ...current, languagesText: value }))}
              placeholder="Tiếng Việt, English"
              placeholderTextColor={luxyColors.softMuted}
              style={styles.textControl}
              value={draft.languagesText}
            />
          </FilterSection>

          <FilterSection title="Nghề nghiệp">
            <TextInput
              accessibilityLabel="Tìm theo nghề nghiệp"
              onChangeText={(value) => setDraft((current) => ({ ...current, occupationText: value }))}
              placeholder="Ví dụ: kiến trúc sư"
              placeholderTextColor={luxyColors.softMuted}
              style={styles.textControl}
              value={draft.occupationText}
            />
          </FilterSection>

          <FilterSection title="Tìm trong hồ sơ" last>
            <TextInput
              accessibilityLabel="Tìm trong nội dung hồ sơ"
              multiline
              onChangeText={(value) => setDraft((current) => ({ ...current, profileText: value }))}
              placeholder="Ví dụ: du lịch, ẩm thực…"
              placeholderTextColor={luxyColors.softMuted}
              style={[styles.textControl, styles.profileTextControl]}
              value={draft.profileText}
            />
          </FilterSection>

          {filterError ? <Text accessibilityRole="alert" style={styles.errorText}>{filterError}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => applyFilters()} style={styles.viewResultsButton}>
            <Text style={styles.viewResultsText}>Xem kết quả</Text>
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable disabled style={[styles.secondaryAction, styles.disabledAction]}>
              <Text style={styles.secondaryActionText}>Lưu tìm kiếm</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.resetAction}>
              <Text style={styles.resetActionText}>Đặt lại</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.results} testID="luxy-search-results">
          <View style={styles.resultsToolbar}>
            <Text style={styles.loadedCount}>{profiles.length ? `${profiles.length} thành viên` : 'Tìm kiếm thành viên'}</Text>
            <View style={styles.sortWrap}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSortOpen((value) => !value)}
                style={styles.sortButton}
              >
                <Text style={styles.sortButtonText}>{activeSort.label}</Text>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
              {sortOpen ? (
                <View style={styles.sortPanel}>
                  {SORT_OPTIONS.map((option) => (
                    <Pressable
                      accessibilityRole="button"
                      key={option.value}
                      onPress={() => {
                        setSort(option.value);
                        setSortOpen(false);
                        applyFilters(draft, option.value);
                      }}
                      style={[styles.sortOption, option.value === sort && styles.sortOptionActive]}
                    >
                      <Text style={styles.sortOptionText}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
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
              <Pressable accessibilityRole="button" onPress={() => void profilesQuery.refetch()} style={styles.retryButton}>
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : profiles.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>Chưa có thành viên phù hợp</Text>
              <Text style={styles.stateText}>Hãy nới khoảng cách hoặc đặt lại một vài bộ lọc.</Text>
            </View>
          ) : (
            <View style={styles.memberGrid} testID="luxy-search-member-grid">
              {profiles.map((profile) => <LuxyDesktopMemberCard key={profile.id} profile={profile} />)}
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
        </View>
      </View>
    </ScrollView>
  );
}

function FilterSection({
  title,
  children,
  last = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.filterSection, last && styles.filterSectionLast]}>
      <View style={styles.filterHeadingRow}>
        <Text style={styles.filterHeading}>{title}</Text>
        <Text style={styles.sectionChevron}>⌃</Text>
      </View>
      <View style={styles.filterBody}>{children}</View>
    </View>
  );
}

function ProvinceRow({
  province,
  selected,
  onPress,
}: {
  province: ProvinceOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.dropdownOption, selected && styles.dropdownOptionActive]}>
      <Text style={styles.dropdownOptionText}>{province.name}</Text>
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

function TagButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tagButton, active && styles.tagButtonActive]}
    >
      <Text style={[styles.tagText, active && styles.tagTextActive]}>{label}</Text>
    </Pressable>
  );
}

function CheckRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.checkRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
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
        <TextInput
          keyboardType="number-pad"
          onChangeText={onLeftChange}
          style={styles.rangeInput}
          value={leftValue}
        />
      </View>
      <Text style={styles.rangeDash}>–</Text>
      <View style={styles.rangeField}>
        <Text style={styles.rangeLabel}>{rightLabel}</Text>
        <TextInput
          keyboardType="number-pad"
          onChangeText={onRightChange}
          style={styles.rangeInput}
          value={rightValue}
        />
      </View>
    </View>
  );
}

function LuxyDesktopMemberCard({ profile }: { profile: LuxySearchProfile }) {
  const router = useRouter();
  const client = getMobileSupabaseClient();
  const name = profile.display_name || profile.username || 'Thành viên Luxy';
  const distance = formatLuxyDistance(profile.distance_km);
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

  const location = [profile.province_name, distance].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityLabel={`Xem hồ sơ ${name}, ${profile.age} tuổi${location ? `, ${location}` : ''}`}
      accessibilityRole="button"
      disabled={!profile.username}
      onPress={() => profile.username && router.push({ pathname: '/profile/[username]', params: { username: profile.username } })}
      style={({ pressed }) => [styles.memberCard, pressed && styles.memberCardPressed]}
      testID="luxy-search-member-card"
    >
      <View style={styles.photoFrame}>
        {imageQuery.data ? (
          <Image accessibilityLabel={`Ảnh hồ sơ của ${name}`} resizeMode="cover" source={{ uri: imageQuery.data }} style={styles.memberPhoto} />
        ) : (
          <View style={styles.photoFallback}>
            <Text style={styles.photoInitial}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.photoCountBadge}>
          <Text style={styles.photoCountText}>▣ {profile.photo_count}</Text>
        </View>

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
  page: {
    minHeight: '100%',
    backgroundColor: luxyColors.background,
    paddingHorizontal: luxyLayout.contentHorizontalPaddingDesktop,
    paddingTop: luxySpacing.lg,
    paddingBottom: luxySpacing.huge,
  },
  frame: {
    width: '100%',
    maxWidth: luxyLayout.contentMaxWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: luxyLayout.searchGap,
  },
  sidebar: {
    width: luxyLayout.searchSidebarWidth,
    flexShrink: 0,
    paddingRight: luxySpacing.xl,
    borderRightWidth: 1,
    borderRightColor: luxyColors.border,
  },
  filterTitle: {
    color: luxyColors.text,
    fontFamily: luxyTypography.families.display,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '400',
    marginBottom: luxySpacing.lg,
  },
  savedSearchRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: luxyColors.border,
    marginBottom: luxySpacing.md,
  },
  savedSearchText: { color: luxyColors.text, fontSize: 13 },
  chevron: { color: luxyColors.muted, fontSize: 15 },
  viewResultsButton: {
    minHeight: 44,
    borderRadius: luxyRadii.pill,
    backgroundColor: luxyColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: luxySpacing.sm,
  },
  viewResultsText: { color: luxyColors.surface, fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: luxySpacing.sm, marginBottom: luxySpacing.md },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    borderColor: luxyColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledAction: { opacity: 0.58 },
  secondaryActionText: { color: luxyColors.text, fontSize: 12, fontWeight: '500' },
  resetAction: {
    minWidth: 82,
    minHeight: 44,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    borderColor: luxyColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: luxySpacing.md,
  },
  resetActionText: { color: luxyColors.text, fontSize: 12, fontWeight: '500' },
  filterSection: {
    paddingVertical: luxySpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: luxyColors.border,
  },
  filterSectionLast: { borderBottomWidth: 0 },
  filterHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterHeading: { color: luxyColors.text, fontSize: 13, fontWeight: '600' },
  sectionChevron: { color: luxyColors.softMuted, fontSize: 11 },
  filterBody: { gap: 5, paddingTop: luxySpacing.sm },
  selectControl: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: luxySpacing.md,
    backgroundColor: luxyColors.surface,
  },
  selectValue: { color: luxyColors.text, fontSize: 13 },
  selectPlaceholder: { color: luxyColors.muted, fontSize: 13 },
  dropdownPanel: {
    borderWidth: 1,
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.xs,
    backgroundColor: luxyColors.surface,
  },
  provinceList: { maxHeight: 260 },
  dropdownOption: { minHeight: 40, justifyContent: 'center', paddingHorizontal: luxySpacing.md },
  dropdownOptionActive: { backgroundColor: luxyColors.elevatedSubtle },
  dropdownOptionText: { color: luxyColors.text, fontSize: 13 },
  locationButton: {
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  locationButtonText: { color: luxyColors.text, fontSize: 12, fontWeight: '600' },
  helperText: { color: luxyColors.softMuted, fontSize: 11, lineHeight: 16 },
  successText: { color: '#166534', fontSize: 11, lineHeight: 16 },
  errorText: { color: luxyColors.danger, fontSize: 12, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: {
    minHeight: 32,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.xs,
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  filterChipActive: { borderColor: luxyColors.ink, backgroundColor: luxyColors.elevatedSubtle },
  filterChipText: { color: luxyColors.muted, fontSize: 11 },
  filterChipTextActive: { color: luxyColors.text, fontWeight: '600' },
  checkRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: luxyColors.surface,
  },
  checkboxChecked: { backgroundColor: luxyColors.ink, borderColor: luxyColors.ink },
  checkboxDisabled: { backgroundColor: luxyColors.elevatedSubtle },
  checkmark: { color: luxyColors.surface, fontSize: 11, lineHeight: 12, fontWeight: '700' },
  checkLabel: { flex: 1, color: luxyColors.text, fontSize: 12 },
  disabledLabel: { flex: 1, color: luxyColors.softMuted, fontSize: 12 },
  comingSoon: { color: luxyColors.softMuted, fontSize: 9 },
  rangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rangeField: { flex: 1, gap: 4 },
  rangeLabel: { color: luxyColors.softMuted, fontSize: 10 },
  rangeInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.xs,
    paddingHorizontal: luxySpacing.sm,
    color: luxyColors.text,
    fontSize: 12,
    backgroundColor: luxyColors.surface,
  },
  rangeDash: { color: luxyColors.softMuted, paddingBottom: 12 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tagButton: {
    minHeight: 30,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: 2,
    justifyContent: 'center',
    paddingHorizontal: 7,
    backgroundColor: luxyColors.surface,
  },
  tagButtonActive: { borderColor: luxyColors.ink, backgroundColor: luxyColors.elevatedSubtle },
  tagText: { color: luxyColors.muted, fontSize: 10 },
  tagTextActive: { color: luxyColors.text, fontWeight: '600' },
  textControl: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.xs,
    paddingHorizontal: luxySpacing.sm,
    paddingVertical: 8,
    color: luxyColors.text,
    fontSize: 12,
    backgroundColor: luxyColors.surface,
  },
  profileTextControl: { minHeight: 70, textAlignVertical: 'top' },
  results: { flex: 1, minWidth: 0 },
  resultsToolbar: {
    minHeight: 48,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: luxySpacing.sm,
  },
  loadedCount: { color: luxyColors.muted, fontSize: 12, paddingTop: 12 },
  sortWrap: { width: 196, position: 'relative', zIndex: 10 },
  sortButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: luxySpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: luxyColors.border,
    backgroundColor: luxyColors.surface,
  },
  sortButtonText: { color: luxyColors.text, fontSize: 12 },
  sortPanel: {
    position: 'absolute',
    top: 44,
    right: 0,
    left: 0,
    borderWidth: 1,
    borderColor: luxyColors.border,
    backgroundColor: luxyColors.surface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 4,
  },
  sortOption: { minHeight: 40, justifyContent: 'center', paddingHorizontal: luxySpacing.md },
  sortOptionActive: { backgroundColor: luxyColors.elevatedSubtle },
  sortOptionText: { color: luxyColors.text, fontSize: 12 },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  memberCard: { flexBasis: '32%', maxWidth: '32.7%', flexGrow: 1, minWidth: 0 },
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
  photoInitial: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 52 },
  photoCountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    minHeight: 22,
    borderRadius: luxyRadii.xs,
    backgroundColor: 'rgba(8,23,38,0.76)',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  photoCountText: { color: luxyColors.surface, fontSize: 10, fontWeight: '600' },
  photoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 78,
    justifyContent: 'flex-end',
    paddingHorizontal: 9,
    paddingTop: 24,
    paddingBottom: 8,
    backgroundColor: 'rgba(8,23,38,0.60)',
  },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: luxyColors.online },
  memberName: { maxWidth: '72%', color: luxyColors.surface, fontSize: 13, fontWeight: '600' },
  memberAge: { color: luxyColors.surface, fontSize: 12 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 3 },
  memberLocation: { flex: 1, color: '#F1F1F1', fontSize: 10 },
  cardIcons: { flexDirection: 'row', gap: 4 },
  cardIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  cardIconText: { color: luxyColors.surface, fontSize: 12 },
  centerState: { minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: luxySpacing.md },
  stateText: { color: luxyColors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyTitle: { color: luxyColors.text, fontSize: 17, fontWeight: '600' },
  retryButton: { minHeight: 44, borderRadius: luxyRadii.pill, backgroundColor: luxyColors.ink, justifyContent: 'center', paddingHorizontal: luxySpacing.xl },
  retryText: { color: luxyColors.surface, fontSize: 12, fontWeight: '600' },
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
});
