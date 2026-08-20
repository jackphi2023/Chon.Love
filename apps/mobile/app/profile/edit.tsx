import {
  createPrivateMediaUrl,
  getMediaById,
  getMyProfile,
  listActiveProvinces,
  listProfileAlbumMedia,
  updateMyLuxyProfile,
  uploadProfileImage,
  VN_FEATURED_PROVINCE_COUNT,
  type AlbumMediaItem,
  type ChildrenStatus,
  type DatingInterest,
  type DrinkingStatus,
  type EducationLevel,
  type GenderIdentity,
  type ProfileLifestyleTag,
  type ProvinceOption,
  type RelationshipStatus,
  type SmokingStatus,
} from '@myfan/supabase';
import {
  luxyBreakpoints,
  luxyColors,
  luxyLayout,
  luxyRadii,
  luxyShadows,
  luxySpacing,
  luxyTypography,
} from '@myfan/ui';
import { luxyProfileEditorSchema } from '@myfan/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LuxyShellNavigation } from '@/components/luxy-shell-navigation';
import {
  getReadableProfileMediaError,
  pickAndPrepareProfileImage,
  pickAndPrepareProfileImages,
} from '@/lib/profile-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type AlbumItemWithUrl = AlbumMediaItem & { url: string };
type UploadMode = 'avatar' | 'public';

type ProfileFormValues = {
  username: string;
  displayName: string;
  headline: string;
  bio: string;
  gender: GenderIdentity;
  provinceId: number | null;
  interestsText: string;
  discoveryEnabled: boolean;
  nearbyEnabled: boolean;
  interestedIn: DatingInterest;
  heightCmText: string;
  weightKgText: string;
  relationshipStatus: RelationshipStatus;
  childrenStatus: ChildrenStatus;
  smokingStatus: SmokingStatus;
  drinkingStatus: DrinkingStatus;
  educationLevel: EducationLevel;
  occupation: string;
  lookingFor: string;
  agePreferenceMinText: string;
  agePreferenceMaxText: string;
  lifestyleTags: ProfileLifestyleTag[];
  languagesText: string;
};

type ChoiceOption<T extends string> = { value: T; label: string };

const interestedInOptions: ChoiceOption<DatingInterest>[] = [
  { value: 'female', label: 'Nữ' },
  { value: 'male', label: 'Nam' },
  { value: 'everyone', label: 'Mọi người' },
];

const relationshipOptions: ChoiceOption<RelationshipStatus>[] = [
  { value: 'single', label: 'Độc thân' },
  { value: 'divorced', label: 'Đã ly hôn' },
  { value: 'widowed', label: 'Góa' },
  { value: 'open', label: 'Mối quan hệ mở' },
  { value: 'complicated', label: 'Phức tạp' },
  { value: 'prefer_not_to_say', label: 'Không muốn nêu' },
];

const childrenOptions: ChoiceOption<ChildrenStatus>[] = [
  { value: 'no_children', label: 'Chưa có con' },
  { value: 'has_children', label: 'Có con' },
  { value: 'prefer_not_to_say', label: 'Không muốn nêu' },
];

const smokingOptions: ChoiceOption<SmokingStatus>[] = [
  { value: 'never', label: 'Không hút thuốc' },
  { value: 'socially', label: 'Thỉnh thoảng' },
  { value: 'regularly', label: 'Thường xuyên' },
  { value: 'trying_to_quit', label: 'Đang bỏ thuốc' },
  { value: 'prefer_not_to_say', label: 'Không muốn nêu' },
];

const drinkingOptions: ChoiceOption<DrinkingStatus>[] = [
  { value: 'never', label: 'Không uống' },
  { value: 'socially', label: 'Giao tiếp / thỉnh thoảng' },
  { value: 'regularly', label: 'Thường xuyên' },
  { value: 'prefer_not_to_say', label: 'Không muốn nêu' },
];

const educationOptions: ChoiceOption<EducationLevel>[] = [
  { value: 'high_school', label: 'THPT' },
  { value: 'vocational', label: 'Trung cấp / nghề' },
  { value: 'college', label: 'Cao đẳng' },
  { value: 'bachelors', label: 'Đại học' },
  { value: 'masters', label: 'Thạc sĩ' },
  { value: 'doctorate', label: 'Tiến sĩ' },
  { value: 'other', label: 'Khác' },
  { value: 'prefer_not_to_say', label: 'Không muốn nêu' },
];

const lifestyleTagOptions: ChoiceOption<ProfileLifestyleTag>[] = [
  { value: 'true_love', label: 'Tình yêu thật sự' },
  { value: 'luxury_lifestyle', label: 'Phong cách sống cao cấp' },
  { value: 'active_lifestyle', label: 'Sống năng động' },
  { value: 'flexible_schedule', label: 'Lịch trình linh hoạt' },
  { value: 'emotional_connection', label: 'Kết nối cảm xúc' },
  { value: 'refined', label: 'Tinh tế' },
  { value: 'fine_dining', label: 'Ẩm thực cao cấp' },
  { value: 'friendship', label: 'Bạn bè' },
  { value: 'long_term', label: 'Lâu dài' },
  { value: 'marriage_minded', label: 'Hướng tới hôn nhân' },
  { value: 'monogamous', label: 'Một vợ một chồng' },
  { value: 'romantic', label: 'Lãng mạn' },
  { value: 'ready_to_travel', label: 'Sẵn sàng du lịch' },
  { value: 'travel_companion', label: 'Bạn đồng hành du lịch' },
  { value: 'vacation', label: 'Kỳ nghỉ' },
  { value: 'entertainment_events', label: 'Sự kiện / giải trí' },
  { value: 'platonic', label: 'Kết nối trong sáng' },
];

const profileQueryKey = (userId: string | null) => ['profile', 'me', userId] as const;
const albumQueryKey = (userId: string | null) => ['profile', 'album', userId, 'public'] as const;

function parseNullableInteger(value: string): number | null {
  const normalized = value.trim();
  return normalized ? Number(normalized) : null;
}

function parseRequiredInteger(value: string): number {
  return Number(value.trim());
}

function formatAgeRange(minimum: string, maximum: string): string {
  const min = Number(minimum);
  const max = Number(maximum);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 'Chưa thiết lập';
  return `${min} - ${max >= 60 ? '60+' : max}`;
}

function formatMemberSince(createdAt?: string): string {
  if (!createdAt) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(createdAt));
  } catch {
    return createdAt.slice(0, 10);
  }
}

function resolveEditError(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  if (raw && /[À-ỹ]/u.test(raw)) return raw;
  return getReadableProfileMediaError(error);
}

export default function EditProfilePage() {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const client = getMobileSupabaseClient();
  const { width } = useWindowDimensions();
  const desktop = width >= luxyBreakpoints.desktop;
  const compact = width < luxyBreakpoints.mobile;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const [uploading, setUploading] = useState<UploadMode | null>(null);

  const { control, handleSubmit, reset, watch, setValue } = useForm<ProfileFormValues>({
    defaultValues: {
      username: '',
      displayName: '',
      headline: '',
      bio: '',
      gender: 'prefer_not_to_say',
      provinceId: null,
      interestsText: '',
      discoveryEnabled: true,
      nearbyEnabled: false,
      interestedIn: 'everyone',
      heightCmText: '',
      weightKgText: '',
      relationshipStatus: 'prefer_not_to_say',
      childrenStatus: 'prefer_not_to_say',
      smokingStatus: 'prefer_not_to_say',
      drinkingStatus: 'prefer_not_to_say',
      educationLevel: 'prefer_not_to_say',
      occupation: '',
      lookingFor: '',
      agePreferenceMinText: '18',
      agePreferenceMaxText: '99',
      lifestyleTags: [],
      languagesText: '',
    },
  });

  const profileQuery = useQuery({
    queryKey: profileQueryKey(auth.userId),
    enabled: Boolean(client && auth.userId),
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyProfile(client);
    },
  });

  const provincesQuery = useQuery({
    queryKey: ['administrative-areas', 'VN', 'canonical-34'],
    enabled: Boolean(client && auth.userId),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listActiveProvinces(client);
    },
  });

  const avatarUrlQuery = useQuery({
    queryKey: ['profile', 'avatar-url', profileQuery.data?.avatar_media_id],
    enabled: Boolean(client && profileQuery.data?.avatar_media_id),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client || !profileQuery.data?.avatar_media_id) return null;
      const media = await getMediaById(client, profileQuery.data.avatar_media_id);
      if (!media || !['pending_review', 'approved'].includes(media.moderation_status)) return null;
      return createPrivateMediaUrl(client, media);
    },
  });

  const publicAlbumQuery = useQuery({
    queryKey: albumQueryKey(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client || !auth.userId) return [] as AlbumItemWithUrl[];
      const rows = await listProfileAlbumMedia(client, auth.userId, 'public');
      return Promise.all(rows.map(async (row) => ({
        ...row,
        url: await createPrivateMediaUrl(client, row),
      })));
    },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    const profile = profileQuery.data;
    reset({
      username: profile.username ?? '',
      displayName: profile.display_name ?? '',
      headline: profile.headline ?? '',
      bio: profile.bio ?? '',
      gender: profile.gender,
      provinceId: profile.province_id,
      interestsText: profile.interests.join(', '),
      discoveryEnabled: profile.discovery_enabled,
      nearbyEnabled: profile.nearby_enabled,
      interestedIn: profile.interested_in,
      heightCmText: profile.height_cm?.toString() ?? '',
      weightKgText: profile.weight_kg?.toString() ?? '',
      relationshipStatus: profile.relationship_status,
      childrenStatus: profile.children_status,
      smokingStatus: profile.smoking_status,
      drinkingStatus: profile.drinking_status,
      educationLevel: profile.education_level,
      occupation: profile.occupation ?? '',
      lookingFor: profile.looking_for ?? '',
      agePreferenceMinText: profile.age_preference_min.toString(),
      agePreferenceMaxText: profile.age_preference_max.toString(),
      lifestyleTags: profile.lifestyle_tags,
      languagesText: profile.languages.join(', '),
    });
  }, [profileQuery.data, reset]);

  const selectedProvinceId = watch('provinceId');
  const selectedTags = watch('lifestyleTags');
  const agePreferenceMinText = watch('agePreferenceMinText');
  const agePreferenceMaxText = watch('agePreferenceMaxText');
  const normalizedProvinceSearch = provinceSearch.trim().toLocaleLowerCase('vi');

  const filteredProvinces = useMemo(
    () => (provincesQuery.data ?? []).filter(
      (province) =>
        !normalizedProvinceSearch ||
        province.name.toLocaleLowerCase('vi').includes(normalizedProvinceSearch),
    ),
    [normalizedProvinceSearch, provincesQuery.data],
  );

  const featuredProvinces = normalizedProvinceSearch
    ? filteredProvinces
    : filteredProvinces.filter((province) => province.sortOrder <= VN_FEATURED_PROVINCE_COUNT);
  const otherProvinces = normalizedProvinceSearch
    ? []
    : filteredProvinces.filter((province) => province.sortOrder > VN_FEATURED_PROVINCE_COUNT);
  const selectedProvince = (provincesQuery.data ?? []).find((item) => item.id === selectedProvinceId);

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!client) throw new Error('supabase_not_configured');
      const parsed = luxyProfileEditorSchema.safeParse({
        username: values.username,
        displayName: values.displayName,
        headline: values.headline,
        bio: values.bio,
        gender: values.gender,
        provinceId: values.provinceId,
        interests: values.interestsText.split(',').map((item) => item.trim()).filter(Boolean),
        discoveryEnabled: values.discoveryEnabled,
        nearbyEnabled: values.nearbyEnabled,
        interestedIn: values.interestedIn,
        heightCm: parseNullableInteger(values.heightCmText),
        weightKg: parseNullableInteger(values.weightKgText),
        relationshipStatus: values.relationshipStatus,
        childrenStatus: values.childrenStatus,
        smokingStatus: values.smokingStatus,
        drinkingStatus: values.drinkingStatus,
        educationLevel: values.educationLevel,
        occupation: values.occupation,
        lookingFor: values.lookingFor,
        agePreferenceMin: parseRequiredInteger(values.agePreferenceMinText),
        agePreferenceMax: parseRequiredInteger(values.agePreferenceMaxText),
        lifestyleTags: values.lifestyleTags,
        languages: values.languagesText.split(',').map((item) => item.trim()).filter(Boolean),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'invalid_profile');
      return updateMyLuxyProfile(client, parsed.data);
    },
    onSuccess: async () => {
      setErrorMessage(null);
      setSuccessMessage('Đã lưu thay đổi hồ sơ Luxy.Love.');
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(resolveEditError(error));
    },
  });

  async function refreshMedia() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
      queryClient.invalidateQueries({ queryKey: albumQueryKey(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'avatar-url'] }),
    ]);
  }

  async function handlePrimaryPhoto() {
    if (!client) return;
    setUploading('avatar');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const prepared = await pickAndPrepareProfileImage('library', 'avatar');
      if (!prepared) return;
      await uploadProfileImage(client, prepared);
      await refreshMedia();
      setSuccessMessage('Ảnh chính đã được cập nhật.');
    } catch (error) {
      setErrorMessage(resolveEditError(error));
    } finally {
      setUploading(null);
    }
  }

  async function handleMultiplePhotos() {
    if (!client) return;
    setUploading('public');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const preparedImages = await pickAndPrepareProfileImages('public');
      if (!preparedImages.length) return;
      for (const prepared of preparedImages) {
        await uploadProfileImage(client, prepared);
      }
      await refreshMedia();
      setSuccessMessage(`Đã thêm ${preparedImages.length} ảnh vào hồ sơ.`);
    } catch (error) {
      setErrorMessage(resolveEditError(error));
    } finally {
      setUploading(null);
    }
  }

  function toggleLifestyleTag(tag: ProfileLifestyleTag) {
    const current = selectedTags ?? [];
    const next = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag];
    setValue('lifestyleTags', next, { shouldDirty: true });
  }

  if (auth.isRestoring) return <FullPageLoading />;
  if (!auth.userId) return <Redirect href="/(auth)" />;

  return (
    <View style={styles.shellPage} testID="lx08-edit-profile-page">
      <LuxyShellNavigation />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.pageInner}>
            <View style={styles.topActionRow}>
              <Text accessibilityRole="header" style={styles.srLikeTitle}>Chỉnh sửa hồ sơ</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/profile')}
                style={({ pressed }) => [styles.viewProfileButton, pressed && styles.pressed]}
                testID="lx08-view-profile"
              >
                <Text style={styles.viewProfileText}>Xem hồ sơ</Text>
              </Pressable>
            </View>

            {profileQuery.isLoading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={luxyColors.ink} size="large" />
                <Text style={styles.loadingText}>Đang tải hồ sơ…</Text>
              </View>
            ) : (
              <View style={[styles.editorLayout, desktop && styles.editorLayoutDesktop]}>
                <PhotoRail
                  avatarUrl={avatarUrlQuery.data ?? null}
                  compact={compact}
                  desktop={desktop}
                  displayName={profileQuery.data?.display_name ?? 'Luxy'}
                  items={publicAlbumQuery.data ?? []}
                  loading={avatarUrlQuery.isLoading || publicAlbumQuery.isLoading}
                  onChangePrimary={handlePrimaryPhoto}
                  onSelectMultiple={handleMultiplePhotos}
                  uploading={uploading}
                />

                <View style={styles.profileEditor} testID="lx08-profile-form">
                  <View style={styles.identityPanel} testID="lx08-top-fields">
                    <FieldLabel symbol="▣" text="Tên hiển thị" />
                    <Controller
                      control={control}
                      name="displayName"
                      render={({ field }) => (
                        <TextInput
                          accessibilityLabel="Tên hiển thị"
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          placeholder="Tên bạn muốn thành viên khác nhìn thấy"
                          placeholderTextColor={luxyColors.softMuted}
                          style={styles.input}
                          value={field.value}
                        />
                      )}
                    />

                    {!profileQuery.data?.username ? (
                      <>
                        <FieldLabel symbol="@" text="Tên người dùng" />
                        <Controller
                          control={control}
                          name="username"
                          render={({ field }) => (
                            <TextInput
                              accessibilityLabel="Tên người dùng"
                              autoCapitalize="none"
                              autoCorrect={false}
                              onBlur={field.onBlur}
                              onChangeText={field.onChange}
                              placeholder="luxy_member"
                              placeholderTextColor={luxyColors.softMuted}
                              style={styles.input}
                              value={field.value}
                            />
                          )}
                        />
                      </>
                    ) : null}

                    <FieldLabel symbol="▬" text="Tiêu đề" />
                    <Controller
                      control={control}
                      name="headline"
                      render={({ field }) => (
                        <TextInput
                          accessibilityLabel="Tiêu đề"
                          maxLength={120}
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          placeholder="Một câu ngắn thể hiện bạn là ai"
                          placeholderTextColor={luxyColors.softMuted}
                          style={styles.input}
                          value={field.value}
                        />
                      )}
                    />

                    <FieldLabel symbol="⌂" text="Địa điểm chính" />
                    <Controller
                      control={control}
                      name="provinceId"
                      render={({ field }) => (
                        <ProvincePicker
                          featuredProvinces={featuredProvinces}
                          normalizedSearch={normalizedProvinceSearch}
                          onSearch={setProvinceSearch}
                          onSelect={(province) => {
                            field.onChange(province.id);
                            setProvincePickerOpen(false);
                            setProvinceSearch('');
                          }}
                          open={provincePickerOpen}
                          otherProvinces={otherProvinces}
                          search={provinceSearch}
                          selectedProvince={selectedProvince}
                          selectedProvinceId={field.value}
                          setOpen={setProvincePickerOpen}
                        />
                      )}
                    />

                    <View style={[styles.lockedLocationPair, !desktop && styles.lockedLocationPairStacked]}>
                      <LockedLocationField label="Địa điểm thứ hai" />
                      <LockedLocationField label="Địa điểm khác" />
                    </View>

                    <Controller
                      control={control}
                      name="heightCmText"
                      render={({ field }) => (
                        <NumericRow
                          label="Chiều cao"
                          onChangeText={field.onChange}
                          placeholder="175"
                          suffix="cm"
                          symbol="↕"
                          value={field.value}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="weightKgText"
                      render={({ field }) => (
                        <NumericRow
                          label="Cân nặng"
                          onChangeText={field.onChange}
                          placeholder="70"
                          suffix="kg"
                          symbol="■"
                          value={field.value}
                        />
                      )}
                    />
                  </View>

                  <Controller
                    control={control}
                    name="relationshipStatus"
                    render={({ field }) => (
                      <ChoiceRow
                        label="Tình trạng quan hệ"
                        onChange={field.onChange}
                        options={relationshipOptions}
                        symbol="♥"
                        value={field.value}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="childrenStatus"
                    render={({ field }) => (
                      <ChoiceRow
                        label="Con cái"
                        onChange={field.onChange}
                        options={childrenOptions}
                        symbol="♟"
                        value={field.value}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="smokingStatus"
                    render={({ field }) => (
                      <ChoiceRow
                        label="Bạn có hút thuốc?"
                        onChange={field.onChange}
                        options={smokingOptions}
                        symbol="≈"
                        value={field.value}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="drinkingStatus"
                    render={({ field }) => (
                      <ChoiceRow
                        label="Bạn có uống rượu/bia?"
                        onChange={field.onChange}
                        options={drinkingOptions}
                        symbol="◇"
                        value={field.value}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="educationLevel"
                    render={({ field }) => (
                      <ChoiceRow
                        label="Học vấn"
                        onChange={field.onChange}
                        options={educationOptions}
                        symbol="◆"
                        value={field.value}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="occupation"
                    render={({ field }) => (
                      <EditableTextRow
                        label="Nghề nghiệp"
                        maxLength={120}
                        onChangeText={field.onChange}
                        placeholder="Nhập nghề nghiệp"
                        symbol="▰"
                        value={field.value}
                      />
                    )}
                  />

                  <LongTextSection
                    control={control}
                    helper="Chia sẻ bạn là ai, điều bạn yêu thích và điều khiến bạn nổi bật. Nội dung này xuất hiện trên hồ sơ của bạn."
                    maxLength={4000}
                    name="bio"
                    title="Giới thiệu về bạn"
                  />

                  <LongTextSection
                    control={control}
                    helper="Mô tả kiểu mối quan hệ bạn mong muốn, điều quan trọng với bạn và những giới hạn rõ ràng."
                    maxLength={4000}
                    name="lookingFor"
                    title="Tôi đang tìm kiếm"
                  />

                  <Controller
                    control={control}
                    name="interestedIn"
                    render={({ field }) => (
                      <ChoiceRow
                        label="Bạn quan tâm đến"
                        onChange={field.onChange}
                        options={interestedInOptions}
                        value={field.value}
                      />
                    )}
                  />

                  <AgePreferenceRow
                    maximum={agePreferenceMaxText}
                    minimum={agePreferenceMinText}
                    onMaximumChange={(value) => setValue('agePreferenceMaxText', value, { shouldDirty: true })}
                    onMinimumChange={(value) => setValue('agePreferenceMinText', value, { shouldDirty: true })}
                  />

                  <TagsRow
                    onToggle={toggleLifestyleTag}
                    selected={selectedTags ?? []}
                  />

                  <Controller
                    control={control}
                    name="interestsText"
                    render={({ field }) => (
                      <EditableTextRow
                        label="Sở thích"
                        onChangeText={field.onChange}
                        placeholder="Du lịch, Ẩm thực, Nghệ thuật"
                        value={field.value}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="languagesText"
                    render={({ field }) => (
                      <EditableTextRow
                        label="Ngôn ngữ"
                        onChangeText={field.onChange}
                        placeholder="Tiếng Việt, English"
                        value={field.value}
                      />
                    )}
                  />

                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsTitle}>Hiển thị & vị trí</Text>
                    <Controller
                      control={control}
                      name="discoveryEnabled"
                      render={({ field }) => (
                        <SettingRow
                          description="Cho phép thành viên phù hợp tìm thấy hồ sơ của bạn."
                          label="Hiển thị trong Tìm kiếm"
                          onValueChange={field.onChange}
                          value={field.value}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="nearbyEnabled"
                      render={({ field }) => (
                        <SettingRow
                          description="Dùng vị trí chính xác ở lớp dữ liệu riêng tư để xếp hạng gần → xa; không công khai tọa độ."
                          label="Cho phép tìm người xung quanh"
                          onValueChange={field.onChange}
                          value={field.value}
                        />
                      )}
                    />
                  </View>

                  <InfoRow label="Thành viên từ" symbol="♣" value={formatMemberSince(profileQuery.data?.created_at)} />
                  <VerificationSection />

                  <View style={[styles.saveRow, compact && styles.saveRowCompact]}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={mutation.isPending}
                      onPress={handleSubmit((values) => {
                        setErrorMessage(null);
                        setSuccessMessage(null);
                        mutation.mutate(values);
                      })}
                      style={({ pressed }) => [
                        styles.saveButton,
                        compact && styles.saveButtonCompact,
                        mutation.isPending && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                      testID="lx08-save"
                    >
                      {mutation.isPending ? (
                        <ActivityIndicator color={luxyColors.surface} />
                      ) : (
                        <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {successMessage ? (
              <Text accessibilityRole="alert" style={styles.success}>{successMessage}</Text>
            ) : null}
            {errorMessage || profileQuery.error || provincesQuery.error || publicAlbumQuery.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errorMessage ?? 'Không thể tải đầy đủ dữ liệu hồ sơ. Hãy thử lại.'}
              </Text>
            ) : null}

            <View style={styles.footer}>
              <Text style={styles.footerLinks}>QUYỀN RIÊNG TƯ   ĐIỀU KHOẢN   AN TOÀN HẸN HÒ   HỖ TRỢ</Text>
              <Text style={styles.footerCopyright}>© 2026 Luxy.Love · Hồ sơ người thật, trải nghiệm hẹn hò có chọn lọc.</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function FullPageLoading() {
  return (
    <View style={styles.fullLoading}>
      <ActivityIndicator accessibilityLabel="Đang tải" color={luxyColors.ink} size="large" />
    </View>
  );
}

function PhotoRail({
  avatarUrl,
  compact,
  desktop,
  displayName,
  items,
  loading,
  onChangePrimary,
  onSelectMultiple,
  uploading,
}: {
  avatarUrl: string | null;
  compact: boolean;
  desktop: boolean;
  displayName: string;
  items: AlbumItemWithUrl[];
  loading: boolean;
  onChangePrimary: () => void;
  onSelectMultiple: () => void;
  uploading: UploadMode | null;
}) {
  const visibleItems = items.slice(0, 5);
  const placeholderCount = Math.max(0, 4 - visibleItems.length);
  return (
    <View style={[styles.photoRail, desktop && styles.photoRailDesktop]} testID="lx08-photo-rail">
      <Pressable
        accessibilityLabel="Thay ảnh chính"
        accessibilityRole="button"
        disabled={uploading !== null}
        onPress={onChangePrimary}
        style={({ pressed }) => [styles.primaryPhoto, compact && styles.primaryPhotoCompact, pressed && styles.pressed]}
      >
        {avatarUrl ? (
          <Image accessibilityLabel={`Ảnh chính của ${displayName}`} source={{ uri: avatarUrl }} style={styles.primaryPhotoImage} />
        ) : (
          <ProfilePhotoPlaceholder initial={displayName.slice(0, 1).toUpperCase()} />
        )}
        <View style={styles.photoHelpBadge}><Text style={styles.photoHelpText}>?</Text></View>
        <View style={styles.primaryPhotoAction}><Text style={styles.primaryPhotoActionText}>Thay ảnh chính</Text></View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={uploading !== null}
        onPress={onSelectMultiple}
        style={({ pressed }) => [styles.selectPhotosButton, pressed && styles.pressed]}
      >
        {uploading === 'public' ? (
          <ActivityIndicator color={luxyColors.ink} />
        ) : (
          <Text style={styles.selectPhotosText}>Chọn nhiều ảnh</Text>
        )}
      </Pressable>

      {loading ? <ActivityIndicator color={luxyColors.ink} style={styles.photoLoader} /> : null}
      <View style={styles.photoGrid}>
        {visibleItems.map((item) => (
          <Image
            accessibilityLabel="Ảnh hồ sơ công khai"
            key={item.media_id}
            source={{ uri: item.url }}
            style={styles.photoTile}
          />
        ))}
        {Array.from({ length: placeholderCount }, (_, index) => (
          <Pressable
            accessibilityLabel="Thêm ảnh hồ sơ"
            accessibilityRole="button"
            disabled={uploading !== null}
            key={`photo-add-${index}`}
            onPress={onSelectMultiple}
            style={({ pressed }) => [styles.photoAddTile, pressed && styles.pressed]}
          >
            <Text style={styles.photoAddPlus}>＋</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ProfilePhotoPlaceholder({ initial }: { initial: string }) {
  return (
    <View style={styles.placeholderPhoto}>
      <View style={styles.placeholderHead} />
      <View style={styles.placeholderShoulders} />
      <Text style={styles.placeholderInitial}>{initial}</Text>
    </View>
  );
}

function FieldLabel({ symbol, text }: { symbol?: string | undefined; text: string }) {
  return (
    <View style={styles.fieldLabel}>
      {symbol ? <Text accessibilityElementsHidden style={styles.fieldSymbol}>{symbol}</Text> : null}
      <Text style={styles.fieldLabelText}>{text}</Text>
    </View>
  );
}

function ProvincePicker({
  featuredProvinces,
  normalizedSearch,
  onSearch,
  onSelect,
  open,
  otherProvinces,
  search,
  selectedProvince,
  selectedProvinceId,
  setOpen,
}: {
  featuredProvinces: ProvinceOption[];
  normalizedSearch: string;
  onSearch: (value: string) => void;
  onSelect: (province: ProvinceOption) => void;
  open: boolean;
  otherProvinces: ProvinceOption[];
  search: string;
  selectedProvince: ProvinceOption | undefined;
  selectedProvinceId: number | null;
  setOpen: (value: boolean | ((current: boolean) => boolean)) => void;
}) {
  return (
    <View testID="lx08-primary-location">
      <Pressable
        accessibilityLabel="Chọn địa điểm chính"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.inputButton, pressed && styles.pressed]}
      >
        <Text style={selectedProvince ? styles.inputButtonText : styles.placeholderText}>
          {selectedProvince?.name ?? 'Chọn tỉnh/thành tại Việt Nam'}
        </Text>
        <Text accessibilityElementsHidden style={styles.locateSymbol}>⌖</Text>
      </Pressable>
      {open ? (
        <View style={styles.provincePanel}>
          <TextInput
            accessibilityLabel="Tìm tỉnh thành"
            onChangeText={onSearch}
            placeholder="Tìm trong 34 tỉnh/thành"
            placeholderTextColor={luxyColors.softMuted}
            style={styles.provinceSearch}
            value={search}
          />
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.provinceScroll}>
            {normalizedSearch ? (
              <ProvinceSection
                emptyText="Không tìm thấy địa phương phù hợp."
                onSelect={onSelect}
                provinces={featuredProvinces}
                selectedProvinceId={selectedProvinceId}
                title="Kết quả"
              />
            ) : (
              <>
                <ProvinceSection
                  onSelect={onSelect}
                  provinces={featuredProvinces}
                  selectedProvinceId={selectedProvinceId}
                  title="Ưu tiên"
                />
                <ProvinceSection
                  onSelect={onSelect}
                  provinces={otherProvinces}
                  selectedProvinceId={selectedProvinceId}
                  title="Các địa phương khác"
                />
              </>
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function ProvinceSection({
  title,
  provinces,
  selectedProvinceId,
  onSelect,
  emptyText,
}: {
  title: string;
  provinces: ProvinceOption[];
  selectedProvinceId: number | null;
  onSelect: (province: ProvinceOption) => void;
  emptyText?: string;
}) {
  return (
    <View style={styles.provinceSection}>
      <Text style={styles.provinceSectionTitle}>{title}</Text>
      {provinces.length ? provinces.map((province) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedProvinceId === province.id }}
          key={province.id}
          onPress={() => onSelect(province)}
          style={({ pressed }) => [
            styles.provinceItem,
            selectedProvinceId === province.id && styles.provinceItemSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.provinceOrder}>{province.sortOrder}.</Text>
          <Text style={styles.provinceText}>{province.name}</Text>
        </Pressable>
      )) : <Text style={styles.provinceEmpty}>{emptyText ?? 'Không có địa phương.'}</Text>}
    </View>
  );
}

function LockedLocationField({ label }: { label: string }) {
  return (
    <View style={styles.lockedLocationField}>
      <View style={styles.lockedLocationLabelRow}>
        <FieldLabel symbol="⌂" text={label} />
        <Text style={styles.lockSymbol}>▣</Text>
      </View>
      <View accessibilityState={{ disabled: true }} style={[styles.inputButton, styles.lockedInput]}>
        <Text style={styles.placeholderText}>Mở với gói thành viên</Text>
        <Text style={styles.locateSymbol}>⌖</Text>
      </View>
    </View>
  );
}

function NumericRow({
  label,
  onChangeText,
  placeholder,
  suffix,
  symbol,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  suffix: string;
  symbol: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.rowContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
      >
        <FieldLabel symbol={symbol} text={label} />
        <View style={styles.rowValueWrap}>
          <Text style={value ? styles.rowValue : styles.rowEmpty}>{value ? `${value} ${suffix}` : 'Chưa có'}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.inlineEditor}>
          <TextInput
            accessibilityLabel={label}
            keyboardType="number-pad"
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={luxyColors.softMuted}
            style={styles.compactInput}
            value={value}
          />
          <Text style={styles.inputSuffix}>{suffix}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ChoiceRow<T extends string>({
  label,
  onChange,
  options,
  symbol,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: ChoiceOption<T>[];
  symbol?: string;
  value: T;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? 'Chưa có';
  return (
    <View style={styles.rowContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
      >
        <FieldLabel symbol={symbol} text={label} />
        <View style={styles.rowValueWrap}>
          <Text style={styles.rowValue}>{selectedLabel}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.choicePanel}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.choiceChip,
                  selected && styles.choiceChipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function EditableTextRow({
  label,
  maxLength,
  onChangeText,
  placeholder,
  symbol,
  value,
}: {
  label: string;
  maxLength?: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  symbol?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.rowContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
      >
        <FieldLabel symbol={symbol} text={label} />
        <View style={styles.rowValueWrap}>
          <Text numberOfLines={1} style={value ? styles.rowValue : styles.rowEmpty}>{value || 'Chưa có'}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.inlineEditor}>
          <TextInput
            accessibilityLabel={label}
            maxLength={maxLength}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={luxyColors.softMuted}
            style={[styles.compactInput, styles.flexInput]}
            value={value}
          />
        </View>
      ) : null}
    </View>
  );
}

function LongTextSection({
  control,
  helper,
  maxLength,
  name,
  title,
}: {
  control: ReturnType<typeof useForm<ProfileFormValues>>['control'];
  helper: string;
  maxLength: number;
  name: 'bio' | 'lookingFor';
  title: string;
}) {
  return (
    <View style={styles.longTextSection}>
      <Text style={styles.editorialHeading}>{title}</Text>
      <Text style={styles.longTextHelper}>{helper}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <>
            <TextInput
              accessibilityLabel={title}
              maxLength={maxLength}
              multiline
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Nhập nội dung…"
              placeholderTextColor={luxyColors.softMuted}
              style={styles.textArea}
              textAlignVertical="top"
              value={field.value}
            />
            <View style={styles.characterRow}>
              <Text style={styles.characterHint}>Thông tin nên rõ ràng và tôn trọng.</Text>
              <Text style={styles.characterCount}>{field.value.length}/{maxLength}</Text>
            </View>
          </>
        )}
      />
    </View>
  );
}

function AgePreferenceRow({
  maximum,
  minimum,
  onMaximumChange,
  onMinimumChange,
}: {
  maximum: string;
  minimum: string;
  onMaximumChange: (value: string) => void;
  onMinimumChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.rowContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
      >
        <FieldLabel text="Độ tuổi mong muốn" />
        <View style={styles.rowValueWrap}>
          <Text style={styles.rowValue}>{formatAgeRange(minimum, maximum)}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.ageEditor}>
          <View style={styles.ageField}>
            <Text style={styles.ageLabel}>Từ</Text>
            <TextInput
              accessibilityLabel="Tuổi tối thiểu"
              keyboardType="number-pad"
              onChangeText={onMinimumChange}
              style={styles.ageInput}
              value={minimum}
            />
          </View>
          <View style={styles.ageField}>
            <Text style={styles.ageLabel}>Đến</Text>
            <TextInput
              accessibilityLabel="Tuổi tối đa"
              keyboardType="number-pad"
              onChangeText={onMaximumChange}
              style={styles.ageInput}
              value={maximum}
            />
          </View>
          <Text style={styles.ageNote}>Giá trị từ 60 trở lên được hiển thị là 60+.</Text>
        </View>
      ) : null}
    </View>
  );
}

function TagsRow({
  onToggle,
  selected,
}: {
  onToggle: (tag: ProfileLifestyleTag) => void;
  selected: ProfileLifestyleTag[];
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = lifestyleTagOptions
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);
  return (
    <View style={styles.rowContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.tagsHeader, pressed && styles.pressed]}
      >
        <FieldLabel text="Luxy tags" />
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {selectedLabels.length ? (
        <View style={styles.selectedTagRow}>
          {selectedLabels.map((label) => <View key={label} style={styles.selectedTag}><Text style={styles.selectedTagText}>{label}</Text></View>)}
        </View>
      ) : <Text style={styles.tagEmpty}>Chưa chọn tag.</Text>}
      {open ? (
        <View style={styles.choicePanel}>
          {lifestyleTagOptions.map((option) => {
            const active = selected.includes(option.value);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={option.value}
                onPress={() => onToggle(option.value)}
                style={({ pressed }) => [
                  styles.choiceChip,
                  active && styles.choiceChipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.choiceChipText, active && styles.choiceChipTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function SettingRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch onValueChange={onValueChange} value={value} />
    </View>
  );
}

function InfoRow({ label, symbol, value }: { label: string; symbol?: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <FieldLabel symbol={symbol} text={label} />
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function VerificationSection() {
  const items = [
    { label: 'Xác minh selfie', note: 'Sẽ kích hoạt ở phiên xác minh', symbol: '◎' },
    { label: 'Xác minh CCCD', note: 'Dữ liệu danh tính luôn ở vùng riêng tư', symbol: '▣' },
    { label: 'Xác minh LinkedIn', note: 'Hồ sơ mạng xã hội không công khai', symbol: 'in' },
  ];
  return (
    <View style={styles.verificationSection}>
      <View style={styles.verificationHeadingRow}>
        <View style={styles.verificationBadge}><Text style={styles.verificationBadgeText}>✓</Text></View>
        <Text style={styles.verificationTitle}>Xác minh</Text>
      </View>
      <Text style={styles.verificationDescription}>
        Luxy.Love chỉ dùng xác minh để tăng độ tin cậy của cộng đồng. Không hiển thị CCCD, dữ liệu KYC hay thông tin tài chính trên hồ sơ.
      </Text>
      <View style={styles.verificationList}>
        {items.map((item) => (
          <View key={item.label} style={styles.verificationItem}>
            <View style={styles.verificationIcon}><Text style={styles.verificationIconText}>{item.symbol}</Text></View>
            <View style={styles.verificationTextWrap}>
              <Text style={styles.verificationItemLabel}>{item.label}</Text>
              <Text style={styles.verificationItemNote}>{item.note}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shellPage: { backgroundColor: luxyColors.background, flex: 1 },
  safeArea: { backgroundColor: luxyColors.background, flex: 1 },
  scrollContent: { flexGrow: 1 },
  pageInner: {
    alignSelf: 'center',
    maxWidth: 1280,
    paddingBottom: luxySpacing.xxl,
    paddingHorizontal: luxySpacing.md,
    width: '100%',
  },
  topActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 72,
    paddingVertical: luxySpacing.sm,
  },
  srLikeTitle: {
    color: luxyColors.text,
    fontSize: 1,
    height: 1,
    opacity: 0.01,
    position: 'absolute',
    width: 1,
  },
  viewProfileButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.ink,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    minHeight: luxyLayout.primaryActionHeight,
    minWidth: 140,
    paddingHorizontal: luxySpacing.xl,
  },
  viewProfileText: { color: luxyColors.surface, fontSize: 15, fontWeight: '600' },
  editorLayout: { gap: luxySpacing.xl, width: '100%' },
  editorLayoutDesktop: { alignItems: 'flex-start', flexDirection: 'row', gap: luxySpacing.xxl },
  photoRail: { alignSelf: 'flex-start', gap: luxySpacing.md, width: '100%' },
  photoRailDesktop: { maxWidth: 408 },
  primaryPhoto: {
    aspectRatio: 0.75,
    backgroundColor: '#BFC5CB',
    borderRadius: luxyRadii.lg,
    maxHeight: 548,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  primaryPhotoCompact: { maxHeight: 460 },
  primaryPhotoImage: { height: '100%', resizeMode: 'cover', width: '100%' },
  placeholderPhoto: { alignItems: 'center', backgroundColor: '#BEC4CA', flex: 1, justifyContent: 'center', overflow: 'hidden' },
  placeholderHead: { backgroundColor: '#929AA3', borderRadius: 76, height: 132, marginBottom: -6, width: 132 },
  placeholderShoulders: { backgroundColor: '#929AA3', borderTopLeftRadius: 120, borderTopRightRadius: 120, height: 230, width: '88%' },
  placeholderInitial: { bottom: 18, color: '#DDE1E5', fontFamily: luxyTypography.families.display, fontSize: 30, position: 'absolute' },
  photoHelpBadge: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.66)', borderRadius: luxyRadii.pill, height: 42, justifyContent: 'center', position: 'absolute', right: 16, top: 16, width: 42 },
  photoHelpText: { color: luxyColors.surface, fontSize: 18, fontWeight: '700' },
  primaryPhotoAction: { backgroundColor: 'rgba(8,23,38,0.74)', bottom: 0, left: 0, paddingVertical: 11, position: 'absolute', right: 0 },
  primaryPhotoActionText: { color: luxyColors.surface, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  selectPhotosButton: { alignItems: 'center', borderColor: luxyColors.ink, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 48, width: '100%' },
  selectPhotosText: { color: luxyColors.ink, fontSize: 15, fontWeight: '500' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.md },
  photoTile: { aspectRatio: 0.78, backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.sm, width: '47.8%' },
  photoAddTile: { alignItems: 'center', aspectRatio: 0.78, justifyContent: 'center', width: '47.8%' },
  photoAddPlus: { color: '#66717B', fontSize: 42, fontWeight: '300' },
  photoLoader: { marginVertical: luxySpacing.sm },
  profileEditor: { flex: 1, minWidth: 0, width: '100%' },
  identityPanel: { backgroundColor: '#FCFBF9', marginBottom: 0, paddingBottom: 0, paddingHorizontal: 0 },
  fieldLabel: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.md, minWidth: 0 },
  fieldSymbol: { color: luxyColors.ink, fontSize: 15, fontWeight: '700', minWidth: 18, textAlign: 'center' },
  fieldLabelText: { color: luxyColors.text, fontSize: 16, fontWeight: '500' },
  input: { backgroundColor: luxyColors.surface, borderColor: '#AEB4BA', borderRadius: 7, borderWidth: 1, color: luxyColors.text, fontSize: 15, marginBottom: luxySpacing.lg, marginTop: 8, minHeight: luxyLayout.formControlHeight, paddingHorizontal: luxySpacing.lg, paddingVertical: 10 },
  inputButton: { alignItems: 'center', backgroundColor: luxyColors.surface, borderColor: '#AEB4BA', borderRadius: 7, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: luxyLayout.formControlHeight, paddingHorizontal: luxySpacing.lg },
  inputButtonText: { color: luxyColors.text, flex: 1, fontSize: 15 },
  placeholderText: { color: luxyColors.softMuted, flex: 1, fontSize: 15 },
  locateSymbol: { color: '#69747E', fontSize: 21, marginLeft: luxySpacing.sm },
  provincePanel: { backgroundColor: luxyColors.surface, borderColor: luxyColors.borderStrong, borderRadius: luxyRadii.sm, borderWidth: 1, marginBottom: luxySpacing.lg, marginTop: luxySpacing.sm, padding: luxySpacing.sm, ...luxyShadows.card },
  provinceSearch: { borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, color: luxyColors.text, fontSize: 14, minHeight: 44, paddingHorizontal: luxySpacing.md },
  provinceScroll: { maxHeight: 320 },
  provinceSection: { paddingBottom: luxySpacing.md },
  provinceSectionTitle: { color: luxyColors.softMuted, fontSize: 11, fontWeight: '700', paddingHorizontal: luxySpacing.sm, paddingTop: luxySpacing.md, textTransform: 'uppercase' },
  provinceItem: { alignItems: 'center', borderRadius: luxyRadii.xs, flexDirection: 'row', minHeight: 44, paddingHorizontal: luxySpacing.sm },
  provinceItemSelected: { backgroundColor: luxyColors.selectedAccentSurface },
  provinceOrder: { color: luxyColors.softMuted, fontSize: 12, width: 30 },
  provinceText: { color: luxyColors.text, flex: 1, fontSize: 14 },
  provinceEmpty: { color: luxyColors.muted, fontSize: 13, padding: luxySpacing.md },
  lockedLocationPair: { flexDirection: 'row', gap: luxySpacing.lg, marginBottom: luxySpacing.sm, marginTop: luxySpacing.lg },
  lockedLocationPairStacked: { flexDirection: 'column' },
  lockedLocationField: { flex: 1, gap: 7, minWidth: 0 },
  lockedLocationLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  lockSymbol: { color: luxyColors.brandCoral, fontSize: 14 },
  lockedInput: { opacity: 0.68 },
  rowContainer: { borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  infoRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 80, paddingVertical: luxySpacing.md },
  rowValueWrap: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: luxySpacing.sm, justifyContent: 'flex-end', marginLeft: luxySpacing.md, maxWidth: '58%' },
  rowValue: { color: luxyColors.text, fontSize: 15, textAlign: 'right' },
  rowEmpty: { color: '#B3B8BD', fontSize: 15, fontStyle: 'italic', textAlign: 'right' },
  chevron: { color: '#8E989F', fontSize: 26, fontWeight: '300' },
  inlineEditor: { alignItems: 'center', backgroundColor: luxyColors.subtleSurface, flexDirection: 'row', gap: luxySpacing.sm, marginBottom: luxySpacing.md, padding: luxySpacing.md },
  compactInput: { backgroundColor: luxyColors.surface, borderColor: luxyColors.borderStrong, borderRadius: luxyRadii.sm, borderWidth: 1, color: luxyColors.text, fontSize: 15, minHeight: 44, minWidth: 120, paddingHorizontal: luxySpacing.md },
  flexInput: { flex: 1, minWidth: 0 },
  inputSuffix: { color: luxyColors.muted, fontSize: 14 },
  choicePanel: { backgroundColor: luxyColors.subtleSurface, flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.sm, padding: luxySpacing.md },
  choiceChip: { alignItems: 'center', backgroundColor: luxyColors.surface, borderColor: luxyColors.borderStrong, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 14 },
  choiceChipSelected: { backgroundColor: luxyColors.ink, borderColor: luxyColors.ink },
  choiceChipText: { color: luxyColors.text, fontSize: 13 },
  choiceChipTextSelected: { color: luxyColors.surface, fontWeight: '600' },
  longTextSection: { paddingBottom: luxySpacing.sm, paddingTop: 34 },
  editorialHeading: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 24, lineHeight: 30 },
  longTextHelper: { color: luxyColors.muted, fontSize: 15, lineHeight: 22, marginBottom: luxySpacing.sm, marginTop: 4 },
  textArea: { backgroundColor: luxyColors.surface, borderColor: '#AEB4BA', borderRadius: 7, borderWidth: 1, color: luxyColors.text, fontSize: 15, lineHeight: 22, minHeight: 220, padding: luxySpacing.lg },
  characterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  characterHint: { color: luxyColors.muted, flex: 1, fontSize: 12 },
  characterCount: { color: luxyColors.muted, fontSize: 12, marginLeft: luxySpacing.sm },
  ageEditor: { alignItems: 'flex-end', backgroundColor: luxyColors.subtleSurface, flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.lg, padding: luxySpacing.md },
  ageField: { gap: 5 },
  ageLabel: { color: luxyColors.muted, fontSize: 12 },
  ageInput: { backgroundColor: luxyColors.surface, borderColor: luxyColors.borderStrong, borderRadius: luxyRadii.sm, borderWidth: 1, color: luxyColors.text, fontSize: 15, minHeight: 44, paddingHorizontal: luxySpacing.md, width: 92 },
  ageNote: { color: luxyColors.muted, flexBasis: '100%', fontSize: 12 },
  tagsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 70, paddingTop: luxySpacing.md },
  selectedTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.sm, paddingBottom: luxySpacing.md },
  selectedTag: { backgroundColor: '#E9ECEF', borderRadius: luxyRadii.xs, paddingHorizontal: 12, paddingVertical: 7 },
  selectedTagText: { color: luxyColors.text, fontSize: 13 },
  tagEmpty: { color: luxyColors.softMuted, fontSize: 13, paddingBottom: luxySpacing.md },
  settingsSection: { borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: luxySpacing.sm, paddingTop: luxySpacing.xl },
  settingsTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 21, marginBottom: luxySpacing.sm },
  settingRow: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.lg, minHeight: 72, paddingVertical: luxySpacing.sm },
  settingText: { flex: 1 },
  settingLabel: { color: luxyColors.text, fontSize: 15, fontWeight: '600' },
  settingDescription: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  verificationSection: { paddingBottom: luxySpacing.xl, paddingTop: luxySpacing.xl },
  verificationHeadingRow: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.sm },
  verificationBadge: { alignItems: 'center', backgroundColor: luxyColors.brandCoral, borderRadius: luxyRadii.pill, height: 24, justifyContent: 'center', width: 24 },
  verificationBadgeText: { color: luxyColors.surface, fontSize: 14, fontWeight: '800' },
  verificationTitle: { color: luxyColors.text, fontSize: 17, fontWeight: '600' },
  verificationDescription: { color: luxyColors.muted, fontSize: 14, lineHeight: 22, marginTop: luxySpacing.sm, maxWidth: 760 },
  verificationList: { gap: luxySpacing.sm, marginTop: luxySpacing.lg, paddingLeft: luxySpacing.xl },
  verificationItem: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.md },
  verificationIcon: { alignItems: 'center', backgroundColor: '#ECEEEF', borderRadius: luxyRadii.pill, height: 28, justifyContent: 'center', width: 28 },
  verificationIconText: { color: '#848B91', fontSize: 12, fontWeight: '700' },
  verificationTextWrap: { flex: 1 },
  verificationItemLabel: { color: luxyColors.text, fontSize: 14, fontWeight: '600' },
  verificationItemNote: { color: luxyColors.muted, fontSize: 11.5, marginTop: 2 },
  saveRow: { alignItems: 'flex-end', paddingTop: luxySpacing.xl },
  saveRowCompact: { alignItems: 'stretch' },
  saveButton: { alignItems: 'center', backgroundColor: luxyColors.ink, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 50, minWidth: 180, paddingHorizontal: luxySpacing.xl },
  saveButtonCompact: { width: '100%' },
  saveButtonText: { color: luxyColors.surface, fontSize: 15, fontWeight: '700' },
  loadingBlock: { alignItems: 'center', gap: luxySpacing.md, justifyContent: 'center', minHeight: 360 },
  loadingText: { color: luxyColors.muted, fontSize: 14 },
  success: { color: '#166534', fontSize: 14, marginTop: luxySpacing.lg },
  error: { color: luxyColors.danger, fontSize: 14, marginTop: luxySpacing.lg },
  footer: { borderTopColor: luxyColors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: luxySpacing.sm, marginHorizontal: -luxySpacing.md, marginTop: luxySpacing.xxl, paddingHorizontal: luxySpacing.xl, paddingTop: luxySpacing.lg },
  footerLinks: { color: luxyColors.text, fontSize: 11, fontWeight: '700' },
  footerCopyright: { color: luxyColors.muted, fontSize: 11, lineHeight: 16 },
  fullLoading: { alignItems: 'center', backgroundColor: luxyColors.background, flex: 1, justifyContent: 'center' },
  disabled: { opacity: 0.58 },
  pressed: { opacity: 0.72 },
});
