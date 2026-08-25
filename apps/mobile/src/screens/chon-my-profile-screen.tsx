import {
  createPrivateMediaUrl,
  getLuxyMemberVerificationBadges,
  getMediaById,
  getMyProfile,
  isMediaVisibleToOwner,
  listActiveProvinces,
  listMyMedia,
  resolveChonMemberRoute,
  setMyProfilePhotoVisibility,
  toPublicMemberPath,
  updateMyLuxyProfile,
  uploadProfileImage,
  VN_FEATURED_PROVINCE_COUNT,
  type ChildrenStatus,
  type DatingInterest,
  type DrinkingStatus,
  type EducationLevel,
  type GenderIdentity,
  type MyMediaItem,
  type ProfileLifestyleTag,
  type ProvinceOption,
  type RelationshipStatus,
  type SmokingStatus,
} from '@myfan/supabase';
import { chonBreakpoints, chonColors, chonLayout, chonShadows, chonTypography } from '@myfan/ui';
import {
  luxyProfileEditorSchema,
  signupBioSchema,
  signupDisplayNameSchema,
  signupHeadlineSchema,
  signupHeightCmSchema,
  signupLifestyleTagsSchema,
  signupLookingForTextSchema,
  weightKgSchema,
} from '@myfan/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, type Href, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { ChonAuthenticatedPageChrome } from '@/components/chon-authenticated-page-chrome';
import { ChonVerificationIcon } from '@/components/chon-verification-icon';
import {
  SIGNUP_CHILDREN_OPTIONS,
  SIGNUP_DRINKING_OPTIONS,
  SIGNUP_EDUCATION_OPTIONS,
  SIGNUP_RELATIONSHIP_OPTIONS,
  SIGNUP_SMOKING_OPTIONS,
} from '@/lib/signup-profile-contract';
import {
  getReadableProfileMediaError,
  pickAndPrepareProfileImage,
  pickAndPrepareProfileImages,
  type ProfileImageSource,
} from '@/lib/profile-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type ManagedPhoto = MyMediaItem & { url: string };
type UploadMode = 'avatar' | 'public';
type ChoiceOption<T extends string> = { value: T; label: string };

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
};

const PRODUCTION_ORIGIN = 'https://www.chon.love';
const MAX_LIFESTYLE_TAGS = 7;

const interestedInOptions: ChoiceOption<DatingInterest>[] = [
  { value: 'female', label: 'Nữ' },
  { value: 'male', label: 'Nam' },
  { value: 'everyone', label: 'Mọi người' },
];

function signupChoices<T extends string>(options: readonly { value: string; label: string }[]): ChoiceOption<T>[] {
  return options
    .filter((option) => option.value !== '')
    .map((option) => ({ value: option.value as T, label: option.label }));
}

const relationshipOptions = signupChoices<RelationshipStatus>(SIGNUP_RELATIONSHIP_OPTIONS);
const childrenOptions = signupChoices<ChildrenStatus>(SIGNUP_CHILDREN_OPTIONS);
const smokingOptions = signupChoices<SmokingStatus>(SIGNUP_SMOKING_OPTIONS);
const drinkingOptions = signupChoices<DrinkingStatus>(SIGNUP_DRINKING_OPTIONS);
const educationOptions = signupChoices<EducationLevel>(SIGNUP_EDUCATION_OPTIONS);

const lifestyleTagOptions: ChoiceOption<ProfileLifestyleTag>[] = [
  { value: 'true_love', label: 'Tình yêu thật sự' },
  { value: 'long_term', label: 'Lâu dài' },
  { value: 'marriage_minded', label: 'Hướng tới hôn nhân' },
  { value: 'monogamous', label: 'Một vợ một chồng' },
  { value: 'emotional_connection', label: 'Kết nối cảm xúc' },
  { value: 'romantic', label: 'Lãng mạn' },
  { value: 'friendship', label: 'Bạn bè' },
  { value: 'platonic', label: 'Kết nối trong sáng' },
  { value: 'luxury_lifestyle', label: 'Phong cách sống cao cấp' },
  { value: 'refined', label: 'Tinh tế' },
  { value: 'active_lifestyle', label: 'Sống năng động' },
  { value: 'flexible_schedule', label: 'Lịch trình linh hoạt' },
  { value: 'ready_to_travel', label: 'Sẵn sàng du lịch' },
  { value: 'travel_companion', label: 'Bạn đồng hành du lịch' },
  { value: 'vacation', label: 'Kỳ nghỉ' },
  { value: 'fine_dining', label: 'Ẩm thực cao cấp' },
  { value: 'entertainment_events', label: 'Sự kiện / giải trí' },
];

const profileQueryKey = (userId: string | null) => ['profile', 'me', userId] as const;
const mediaQueryKey = (userId: string | null) => ['profile', 'media', userId] as const;

function parseNullableInteger(value: string): number | null {
  const normalized = value.trim();
  return normalized ? Number(normalized) : null;
}

function parseRequiredInteger(value: string): number {
  return Number(value.trim());
}

function formatMemberSince(createdAt?: string): string {
  if (!createdAt) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(createdAt));
  } catch {
    return createdAt.slice(0, 10);
  }
}

function genderLabel(value: GenderIdentity): string {
  if (value === 'female') return 'Nữ';
  if (value === 'male') return 'Nam';
  if (value === 'non_binary') return 'Phi nhị nguyên';
  if (value === 'other') return 'Khác';
  return 'Không chia sẻ';
}

function sameTags(left: readonly ProfileLifestyleTag[], right: readonly ProfileLifestyleTag[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

function resolveEditError(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  if (raw && /[À-ỹ]/u.test(raw)) return raw;
  return getReadableProfileMediaError(error);
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') throw new Error('clipboard_unavailable');
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('clipboard_unavailable');
}

export default function ChonMyProfileScreen() {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const client = getMobileSupabaseClient();
  const { width } = useWindowDimensions();
  const desktop = width >= chonBreakpoints.desktop;
  const compact = width < chonBreakpoints.mobile;
  const [provinceSearch, setProvinceSearch] = useState('');
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const [uploading, setUploading] = useState<UploadMode | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { control, handleSubmit, reset, setValue, watch } = useForm<ProfileFormValues>({
    defaultValues: {
      username: '', displayName: '', headline: '', bio: '', gender: 'prefer_not_to_say', provinceId: null,
      interestsText: '', discoveryEnabled: true, nearbyEnabled: false, interestedIn: 'everyone',
      heightCmText: '', weightKgText: '', relationshipStatus: 'prefer_not_to_say', childrenStatus: 'prefer_not_to_say',
      smokingStatus: 'prefer_not_to_say', drinkingStatus: 'prefer_not_to_say', educationLevel: 'prefer_not_to_say',
      occupation: '', lookingFor: '', agePreferenceMinText: '18', agePreferenceMaxText: '99', lifestyleTags: [],
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

  const mediaQuery = useQuery({
    queryKey: mediaQueryKey(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) return [] as ManagedPhoto[];
      const rows = await listMyMedia(client);
      const eligible = rows.filter((item) =>
        (item.visibility === 'public' || item.visibility === 'private') && isMediaVisibleToOwner(item),
      );
      return Promise.all(eligible.map(async (item) => ({ ...item, url: await createPrivateMediaUrl(client, item) })));
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

  const publicRouteQuery = useQuery({
    queryKey: ['profile', 'public-route', auth.userId, profileQuery.data?.username],
    enabled: Boolean(client && auth.userId && profileQuery.data?.username),
    staleTime: 60_000,
    queryFn: async () => {
      if (!client || !profileQuery.data?.username) return null;
      return resolveChonMemberRoute(client, profileQuery.data.username);
    },
  });

  const verificationQuery = useQuery({
    queryKey: ['profile', 'verification-badges', auth.userId],
    enabled: Boolean(client && profileQuery.data?.id),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client || !profileQuery.data?.id) throw new Error('profile_not_available');
      return getLuxyMemberVerificationBadges(client, profileQuery.data.id);
    },
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
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
    });
  }, [profileQuery.data, reset]);

  const selectedProvinceId = watch('provinceId');
  const selectedTags = watch('lifestyleTags');
  const minimumAge = watch('agePreferenceMinText');
  const maximumAge = watch('agePreferenceMaxText');
  const normalizedSearch = provinceSearch.trim().toLocaleLowerCase('vi');
  const filteredProvinces = useMemo(
    () => (provincesQuery.data ?? []).filter((province) =>
      !normalizedSearch || province.name.toLocaleLowerCase('vi').includes(normalizedSearch)),
    [normalizedSearch, provincesQuery.data],
  );
  const featuredProvinces = normalizedSearch
    ? filteredProvinces
    : filteredProvinces.filter((province) => province.sortOrder <= VN_FEATURED_PROVINCE_COUNT);
  const otherProvinces = normalizedSearch
    ? []
    : filteredProvinces.filter((province) => province.sortOrder > VN_FEATURED_PROVINCE_COUNT);
  const selectedProvince = (provincesQuery.data ?? []).find((province) => province.id === selectedProvinceId);

  const publicCode = publicRouteQuery.data?.public_profile_code ?? null;
  const publicPath = publicCode ? toPublicMemberPath(publicCode) : null;
  const publicUrl = publicPath ? `${PRODUCTION_ORIGIN}${publicPath}` : null;

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!client) throw new Error('supabase_not_configured');
      const baseline = profileQuery.data;
      if (!baseline) throw new Error('profile_not_available');

      const heightCm = parseNullableInteger(values.heightCmText);
      const weightKg = parseNullableInteger(values.weightKgText);
      const displayName = values.displayName.trim();
      const headline = values.headline.trim();
      const bio = values.bio.trim();
      const lookingFor = values.lookingFor.trim();
      const lifestyleTags = values.lifestyleTags;

      // Existing members may have values created under older profile rules. Preserve an
      // unchanged legacy value so editing another field does not lock the account. The
      // moment a shared signup/profile field changes, apply the current Signup V2 rule.
      if (displayName !== (baseline.display_name ?? '').trim()) signupDisplayNameSchema.parse(displayName);
      if (headline !== (baseline.headline ?? '').trim()) signupHeadlineSchema.parse(headline);
      if (bio !== (baseline.bio ?? '').trim()) signupBioSchema.parse(bio);
      if (lookingFor !== (baseline.looking_for ?? '').trim()) signupLookingForTextSchema.parse(lookingFor);
      if (!sameTags(lifestyleTags, baseline.lifestyle_tags ?? [])) signupLifestyleTagsSchema.parse(lifestyleTags);
      if (heightCm !== baseline.height_cm && heightCm !== null) signupHeightCmSchema.parse(heightCm);
      if (weightKg !== null) weightKgSchema.parse(weightKg);

      const parsed = luxyProfileEditorSchema.safeParse({
        username: values.username,
        displayName,
        headline,
        bio,
        gender: values.gender,
        provinceId: values.provinceId,
        interests: values.interestsText.split(',').map((item) => item.trim()).filter(Boolean),
        discoveryEnabled: values.discoveryEnabled,
        nearbyEnabled: values.nearbyEnabled,
        interestedIn: values.interestedIn,
        heightCm,
        weightKg,
        relationshipStatus: values.relationshipStatus,
        childrenStatus: values.childrenStatus,
        smokingStatus: values.smokingStatus,
        drinkingStatus: values.drinkingStatus,
        educationLevel: values.educationLevel,
        occupation: values.occupation,
        lookingFor,
        agePreferenceMin: parseRequiredInteger(values.agePreferenceMinText),
        agePreferenceMax: parseRequiredInteger(values.agePreferenceMaxText),
        lifestyleTags,
        languages: baseline.languages ?? [],
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'invalid_profile');
      return updateMyLuxyProfile(client, parsed.data);
    },
    onSuccess: async () => {
      setErrorMessage(null);
      setNotice('Đã lưu thay đổi hồ sơ Chọn.Love.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['luxy-member-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['public-chon-profile'] }),
      ]);
    },
    onError: (error) => {
      setNotice(null);
      setErrorMessage(resolveEditError(error));
    },
  });

  async function refreshMedia() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: profileQueryKey(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: mediaQueryKey(auth.userId) }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'album', auth.userId] }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'avatar-url'] }),
      queryClient.invalidateQueries({ queryKey: ['luxy-member-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['private-photo-media'] }),
      queryClient.invalidateQueries({ queryKey: ['private-photo-access'] }),
    ]);
  }

  async function handleAvatar(source: ProfileImageSource) {
    if (!client) return;
    setUploading('avatar');
    setNotice(null);
    setErrorMessage(null);
    try {
      const prepared = await pickAndPrepareProfileImage(source, 'avatar');
      if (!prepared) return;
      await uploadProfileImage(client, prepared);
      await refreshMedia();
      setNotice('Ảnh chính đã được cập nhật.');
    } catch (error) {
      setErrorMessage(resolveEditError(error));
    } finally {
      setUploading(null);
    }
  }

  async function handlePublicPhotos() {
    if (!client) return;
    setUploading('public');
    setNotice(null);
    setErrorMessage(null);
    try {
      const preparedImages = await pickAndPrepareProfileImages('public');
      if (!preparedImages.length) return;
      for (const image of preparedImages) await uploadProfileImage(client, image);
      await refreshMedia();
      setNotice(`Đã thêm ${preparedImages.length} ảnh công khai.`);
    } catch (error) {
      setErrorMessage(resolveEditError(error));
    } finally {
      setUploading(null);
    }
  }

  async function handlePhotoVisibility(photo: ManagedPhoto) {
    if (!client || (photo.visibility !== 'public' && photo.visibility !== 'private')) return;
    const next = photo.visibility === 'public' ? 'private' : 'public';
    setTogglingId(photo.id);
    setNotice(null);
    setErrorMessage(null);
    try {
      await setMyProfilePhotoVisibility(client, photo.id, next);
      await refreshMedia();
      setNotice(next === 'private' ? 'Ảnh đã chuyển sang riêng tư.' : 'Ảnh đã hiển thị công khai.');
    } catch (error) {
      setErrorMessage(resolveEditError(error));
    } finally {
      setTogglingId(null);
    }
  }

  function toggleLifestyleTag(tag: ProfileLifestyleTag) {
    const current = selectedTags ?? [];
    if (current.includes(tag)) {
      setValue('lifestyleTags', current.filter((item) => item !== tag), { shouldDirty: true });
      return;
    }
    if (current.length >= MAX_LIFESTYLE_TAGS) {
      setErrorMessage('Chọn tối đa 7 mục tiêu / phong cách.');
      return;
    }
    setErrorMessage(null);
    setValue('lifestyleTags', [...current, tag], { shouldDirty: true });
  }

  function openPublicProfile() {
    if (!publicPath) return;
    router.push(publicPath as Href);
  }

  async function copyPublicProfile() {
    if (!publicUrl) return;
    setErrorMessage(null);
    try {
      await copyTextToClipboard(publicUrl);
      setNotice('Đã sao chép liên kết hồ sơ.');
    } catch {
      setErrorMessage('Không thể sao chép tự động. Hãy dùng nút Chia sẻ hồ sơ.');
    }
  }

  async function sharePublicProfile() {
    if (!publicUrl) return;
    setErrorMessage(null);
    try {
      if (Platform.OS === 'web' && globalThis.navigator?.share) {
        await globalThis.navigator.share({ title: 'Hồ sơ Chọn.Love', text: 'Xem hồ sơ của tôi trên Chọn.Love', url: publicUrl });
      } else {
        await Share.share({ message: `Xem hồ sơ của tôi trên Chọn.Love: ${publicUrl}` });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (Platform.OS === 'web') await copyPublicProfile();
      else setErrorMessage('Không thể mở chia sẻ lúc này.');
    }
  }

  if (auth.isRestoring) return <FullPageLoading />;
  if (!auth.userId) return <Redirect href="/(auth)" />;

  return (
    <ChonAuthenticatedPageChrome footer="always" testID="chon-my-profile-page">
      <SafeAreaView style={styles.safeArea} testID="lx08-edit-profile-page">
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.pageInner}>
            <View style={[styles.pageHeader, compact && styles.pageHeaderCompact]}>
              <View style={styles.pageHeadingCopy}>
                <Text accessibilityRole="header" style={styles.pageTitle}>Hồ sơ của tôi</Text>
                <Text style={styles.pageSubtitle}>Thông tin bạn chỉnh sửa ở đây là nguồn dữ liệu cho hồ sơ công khai. Vị trí chính xác và dữ liệu xác minh riêng tư không được công khai.</Text>
              </View>
              <View style={[styles.publicActions, compact && styles.publicActionsCompact]}>
                <Pressable accessibilityRole="button" disabled={!publicPath} onPress={openPublicProfile} style={({ pressed }) => [styles.primaryButton, !publicPath && styles.disabled, pressed && styles.pressed]} testID="lx08-view-profile">
                  <Text style={styles.primaryButtonText}>Xem hồ sơ</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={!publicUrl} onPress={() => void sharePublicProfile()} style={({ pressed }) => [styles.outlineButton, !publicUrl && styles.disabled, pressed && styles.pressed]} testID="chon-share-profile">
                  <Text style={styles.outlineButtonText}>Chia sẻ hồ sơ</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.linkCard} testID="chon-public-profile-link-card">
              <View style={styles.linkCopy}>
                <Text style={styles.linkLabel}>Liên kết hồ sơ công khai</Text>
                <Text selectable style={styles.linkValue} testID="chon-public-profile-url">{publicUrl ?? 'Đang tạo liên kết hồ sơ…'}</Text>
              </View>
              {Platform.OS === 'web' ? (
                <Pressable accessibilityRole="button" disabled={!publicUrl} onPress={() => void copyPublicProfile()} style={({ pressed }) => [styles.copyButton, !publicUrl && styles.disabled, pressed && styles.pressed]} testID="chon-copy-profile-link">
                  <Text style={styles.copyButtonText}>Sao chép</Text>
                </Pressable>
              ) : null}
            </View>

            {profileQuery.isLoading ? (
              <View style={styles.loadingBlock}><ActivityIndicator color={chonColors.ink} size="large" /><Text style={styles.mutedText}>Đang tải hồ sơ…</Text></View>
            ) : (
              <View style={[styles.contentGrid, desktop && styles.contentGridDesktop]}>
                <View style={[styles.mediaColumn, desktop && styles.mediaColumnDesktop]}>
                  <AvatarCard
                    avatarUrl={avatarUrlQuery.data ?? null}
                    busy={uploading !== null}
                    displayName={profileQuery.data?.display_name ?? 'Chọn.Love'}
                    onCamera={() => void handleAvatar('camera')}
                    onLibrary={() => void handleAvatar('library')}
                  />
                  <MediaManager
                    busyId={togglingId}
                    loading={mediaQuery.isLoading}
                    onAdd={() => void handlePublicPhotos()}
                    onToggle={(photo) => void handlePhotoVisibility(photo)}
                    photos={mediaQuery.data ?? []}
                    uploading={uploading === 'public'}
                  />
                </View>

                <View style={styles.formColumn} testID="lx08-profile-form">
                  <Section title="Thông tin hồ sơ">
                    <Field label="Tên hiển thị" helper="Giống bước đăng ký: 6–50 ký tự.">
                      <Controller control={control} name="displayName" render={({ field }) => <TextInput accessibilityLabel="Tên hiển thị" maxLength={50} onBlur={field.onBlur} onChangeText={field.onChange} placeholder="Tên hiển thị" placeholderTextColor={chonColors.softMuted} style={styles.input} value={field.value} />} />
                    </Field>
                    {!profileQuery.data?.username ? (
                      <Field label="Tên người dùng">
                        <Controller control={control} name="username" render={({ field }) => <TextInput accessibilityLabel="Tên người dùng" autoCapitalize="none" autoCorrect={false} maxLength={30} onBlur={field.onBlur} onChangeText={field.onChange} placeholder="chon_member" placeholderTextColor={chonColors.softMuted} style={styles.input} value={field.value} />} />
                      </Field>
                    ) : <InfoLine label="Tên người dùng" value={`@${profileQuery.data.username}`} />}
                    <Field label="Tiêu đề" helper="Có thể để trống; nếu nhập cần 10–50 ký tự.">
                      <Controller control={control} name="headline" render={({ field }) => <TextInput accessibilityLabel="Tiêu đề" maxLength={50} onBlur={field.onBlur} onChangeText={field.onChange} placeholder="Một câu ngắn thể hiện bạn là ai" placeholderTextColor={chonColors.softMuted} style={styles.input} value={field.value} />} />
                    </Field>
                    <InfoLine label="Giới tính" value={genderLabel(profileQuery.data?.gender ?? 'prefer_not_to_say')} />
                    <Field label="Tỉnh / thành phố" helper="Chỉ tỉnh/thành được công khai; tọa độ chính xác luôn riêng tư.">
                      <ProvincePicker
                        featured={featuredProvinces}
                        normalizedSearch={normalizedSearch}
                        onSearch={setProvinceSearch}
                        onSelect={(province) => { setValue('provinceId', province.id, { shouldDirty: true }); setProvincePickerOpen(false); setProvinceSearch(''); }}
                        open={provincePickerOpen}
                        others={otherProvinces}
                        search={provinceSearch}
                        selected={selectedProvince}
                        selectedId={selectedProvinceId}
                        setOpen={setProvincePickerOpen}
                      />
                    </Field>
                    <View style={styles.twoColumns}>
                      <Controller control={control} name="heightCmText" render={({ field }) => <Field label="Chiều cao"><TextInput accessibilityLabel="Chiều cao" keyboardType="number-pad" onChangeText={field.onChange} placeholder="175" placeholderTextColor={chonColors.softMuted} style={styles.input} value={field.value} /></Field>} />
                      <Controller control={control} name="weightKgText" render={({ field }) => <Field label="Cân nặng"><TextInput accessibilityLabel="Cân nặng" keyboardType="number-pad" onChangeText={field.onChange} placeholder="70" placeholderTextColor={chonColors.softMuted} style={styles.input} value={field.value} /></Field>} />
                    </View>
                  </Section>

                  <Section title="Thông tin cá nhân">
                    <Controller control={control} name="relationshipStatus" render={({ field }) => <ChoiceField label="Tình trạng mối quan hệ" onChange={field.onChange} options={relationshipOptions} value={field.value} />} />
                    <Controller control={control} name="childrenStatus" render={({ field }) => <ChoiceField label="Con cái" onChange={field.onChange} options={childrenOptions} value={field.value} />} />
                    <Controller control={control} name="smokingStatus" render={({ field }) => <ChoiceField label="Hút thuốc" onChange={field.onChange} options={smokingOptions} value={field.value} />} />
                    <Controller control={control} name="drinkingStatus" render={({ field }) => <ChoiceField label="Uống rượu / bia" onChange={field.onChange} options={drinkingOptions} value={field.value} />} />
                    <Controller control={control} name="educationLevel" render={({ field }) => <ChoiceField label="Học vấn" onChange={field.onChange} options={educationOptions} value={field.value} />} />
                    <Field label="Nghề nghiệp"><Controller control={control} name="occupation" render={({ field }) => <TextInput accessibilityLabel="Nghề nghiệp" maxLength={120} onChangeText={field.onChange} placeholder="Nghề nghiệp" placeholderTextColor={chonColors.softMuted} style={styles.input} value={field.value} />} /></Field>
                  </Section>

                  <Section title="Giới thiệu về bạn">
                    <Controller control={control} name="bio" render={({ field }) => <TextArea accessibilityLabel="Giới thiệu về bạn" helper="Tối thiểu 50 ký tự khi chỉnh sửa; dữ liệu legacy không đổi vẫn được giữ nguyên." maxLength={4000} onChangeText={field.onChange} value={field.value} />} />
                  </Section>

                  <Section title="Tôi đang tìm kiếm">
                    <Controller control={control} name="lookingFor" render={({ field }) => <TextArea accessibilityLabel="Tôi đang tìm kiếm" helper="Tối thiểu 50 ký tự khi chỉnh sửa; dữ liệu legacy không đổi vẫn được giữ nguyên." maxLength={4000} onChangeText={field.onChange} value={field.value} />} />
                    <Controller control={control} name="interestedIn" render={({ field }) => <ChoiceField label="Bạn quan tâm đến" onChange={field.onChange} options={interestedInOptions} value={field.value} />} />
                    <AgeRange maximum={maximumAge} minimum={minimumAge} onMaximum={(value) => setValue('agePreferenceMaxText', value, { shouldDirty: true })} onMinimum={(value) => setValue('agePreferenceMinText', value, { shouldDirty: true })} />
                  </Section>

                  <Section title="Mong muốn tìm kiếm" testID="chon-profile-looking-for-tags">
                    <Text style={styles.helper}>Chọn 1–7 mục tiêu / phong cách khi chỉnh sửa, đồng nhất với bước đăng ký.</Text>
                    <TagPicker onToggle={toggleLifestyleTag} selected={selectedTags ?? []} />
                  </Section>

                  <Section title="Sở thích">
                    <Field label="Sở thích" helper="Ngăn cách bằng dấu phẩy; tối đa 12 mục.">
                      <Controller control={control} name="interestsText" render={({ field }) => <TextInput accessibilityLabel="Sở thích" onChangeText={field.onChange} placeholder="Du lịch, Ẩm thực, Nghệ thuật" placeholderTextColor={chonColors.softMuted} style={styles.input} value={field.value} />} />
                    </Field>
                  </Section>

                  <Section title="Hiển thị & vị trí">
                    <Controller control={control} name="discoveryEnabled" render={({ field }) => <ToggleRow description="Cho phép thành viên phù hợp tìm thấy hồ sơ của bạn." label="Hiển thị trong Kết nối" onValueChange={field.onChange} value={field.value} />} />
                    <Controller control={control} name="nearbyEnabled" render={({ field }) => <ToggleRow description="Dùng vị trí chính xác ở lớp riêng tư để xếp hạng gần → xa; không công khai tọa độ." label="Cho phép tìm người xung quanh" onValueChange={field.onChange} value={field.value} />} />
                  </Section>

                  <Section title="Xác minh Chọn.Love">
                    <VerificationSummary badges={verificationQuery.data ?? null} loading={verificationQuery.isLoading} onOpen={() => router.push('/settings/verification')} />
                  </Section>

                  <InfoLine label="Thành viên từ" value={formatMemberSince(profileQuery.data?.created_at)} />

                  <View style={[styles.saveRow, compact && styles.saveRowCompact]}>
                    <Pressable accessibilityRole="button" disabled={mutation.isPending} onPress={handleSubmit((values) => { setNotice(null); setErrorMessage(null); mutation.mutate(values); })} style={({ pressed }) => [styles.saveButton, mutation.isPending && styles.disabled, pressed && styles.pressed]} testID="lx08-save">
                      {mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Lưu thay đổi</Text>}
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {notice ? <Text accessibilityRole="alert" style={styles.success}>{notice}</Text> : null}
            {errorMessage || profileQuery.error || provincesQuery.error || mediaQuery.error || publicRouteQuery.error ? (
              <Text accessibilityRole="alert" style={styles.error}>{errorMessage ?? 'Không thể tải đầy đủ dữ liệu hồ sơ. Hãy thử lại.'}</Text>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ChonAuthenticatedPageChrome>
  );
}

function FullPageLoading() {
  return <View style={styles.fullLoading}><ActivityIndicator accessibilityLabel="Đang tải" color={chonColors.ink} size="large" /></View>;
}

function AvatarCard({ avatarUrl, busy, displayName, onCamera, onLibrary }: { avatarUrl: string | null; busy: boolean; displayName: string; onCamera: () => void; onLibrary: () => void }) {
  return (
    <View style={styles.card} testID="lx08-photo-rail">
      <Text style={styles.cardTitle}>Ảnh chính</Text>
      <View style={styles.avatarFrame}>
        {avatarUrl ? <Image accessibilityLabel={`Ảnh chính của ${displayName}`} source={{ uri: avatarUrl }} style={styles.photoFill} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{displayName.slice(0, 1).toUpperCase()}</Text></View>}
      </View>
      <View style={styles.buttonRow}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onLibrary} style={({ pressed }) => [styles.outlineButton, styles.flexButton, pressed && styles.pressed]}><Text style={styles.outlineButtonText}>Đổi ảnh</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onCamera} style={({ pressed }) => [styles.outlineButton, styles.flexButton, pressed && styles.pressed]}><Text style={styles.outlineButtonText}>Chụp ảnh</Text></Pressable>
      </View>
    </View>
  );
}

function MediaManager({ busyId, loading, onAdd, onToggle, photos, uploading }: { busyId: string | null; loading: boolean; onAdd: () => void; onToggle: (photo: ManagedPhoto) => void; photos: ManagedPhoto[]; uploading: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}><Text style={styles.cardTitle}>Ảnh hồ sơ</Text><Text style={styles.cardHint}>Công khai hoặc riêng tư</Text></View>
        <Pressable accessibilityRole="button" disabled={uploading} onPress={onAdd} style={({ pressed }) => [styles.smallGoldButton, pressed && styles.pressed]} testID="luxy-add-public-photo"><Text style={styles.smallGoldButtonText}>{uploading ? 'Đang thêm…' : '+ Thêm ảnh'}</Text></Pressable>
      </View>
      {loading ? <ActivityIndicator color={chonColors.ink} /> : null}
      {!loading && photos.length ? (
        <View style={styles.gallery} testID="luxy-owned-photo-management">
          {photos.map((photo) => {
            const privatePhoto = photo.visibility === 'private';
            return (
              <View key={photo.id} style={styles.photoCard} testID={`luxy-owned-photo-${photo.id}`}>
                <View style={styles.photoFrame}><Image accessibilityLabel={privatePhoto ? 'Ảnh riêng tư' : 'Ảnh công khai'} source={{ uri: photo.url }} style={styles.photoFill} /><View style={[styles.visibilityBadge, privatePhoto && styles.visibilityBadgePrivate]}><Text style={styles.visibilityBadgeText}>{privatePhoto ? 'Riêng tư' : 'Công khai'}</Text></View></View>
                <Pressable accessibilityRole="button" disabled={busyId === photo.id} onPress={() => onToggle(photo)} style={({ pressed }) => [styles.visibilityButton, pressed && styles.pressed]}>{busyId === photo.id ? <ActivityIndicator color={chonColors.ink} size="small" /> : <Text style={styles.visibilityButtonText}>{privatePhoto ? 'Hiện công khai' : 'Chuyển riêng tư'}</Text>}</Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
      {!loading && !photos.length ? <Text style={styles.mutedText}>Chưa có ảnh bổ sung.</Text> : null}
      <Text style={styles.helper}>Ảnh riêng tư chỉ được mở theo entitlement Premium/Diamond hiện hành; quà tặng không mở khóa ảnh.</Text>
    </View>
  );
}

function Section({ children, title, testID }: { children: React.ReactNode; title: string; testID?: string }) {
  return <View style={styles.section} testID={testID}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Field({ children, helper, label }: { children: React.ReactNode; helper?: string; label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}{helper ? <Text style={styles.helper}>{helper}</Text> : null}</View>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoLine}><Text style={styles.label}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function ChoiceField<T extends string>({ label, onChange, options, value }: { label: string; onChange: (value: T) => void; options: ChoiceOption<T>[]; value: T }) {
  return (
    <Field label={label}>
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const selected = option.value === value;
          return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={option.value} onPress={() => onChange(option.value)} style={({ pressed }) => [styles.choiceChip, selected && styles.choiceChipSelected, pressed && styles.pressed]}><Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{option.label}</Text></Pressable>;
        })}
      </View>
    </Field>
  );
}

function TextArea({ accessibilityLabel, helper, maxLength, onChangeText, value }: { accessibilityLabel: string; helper: string; maxLength: number; onChangeText: (value: string) => void; value: string }) {
  return <View><TextInput accessibilityLabel={accessibilityLabel} maxLength={maxLength} multiline onChangeText={onChangeText} placeholder="Nhập nội dung…" placeholderTextColor={chonColors.softMuted} style={styles.textArea} textAlignVertical="top" value={value} /><View style={styles.textMeta}><Text style={styles.helper}>{helper}</Text><Text style={styles.counter}>{value.length}/{maxLength}</Text></View></View>;
}

function AgeRange({ maximum, minimum, onMaximum, onMinimum }: { maximum: string; minimum: string; onMaximum: (value: string) => void; onMinimum: (value: string) => void }) {
  return <Field label="Độ tuổi mong muốn"><View style={styles.ageRow}><TextInput accessibilityLabel="Tuổi tối thiểu" keyboardType="number-pad" onChangeText={onMinimum} style={[styles.input, styles.ageInput]} value={minimum} /><Text style={styles.ageDash}>–</Text><TextInput accessibilityLabel="Tuổi tối đa" keyboardType="number-pad" onChangeText={onMaximum} style={[styles.input, styles.ageInput]} value={maximum} /></View></Field>;
}

function TagPicker({ onToggle, selected }: { onToggle: (tag: ProfileLifestyleTag) => void; selected: ProfileLifestyleTag[] }) {
  return <View style={styles.choiceWrap}>{lifestyleTagOptions.map((option) => { const active = selected.includes(option.value); return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={option.value} onPress={() => onToggle(option.value)} style={({ pressed }) => [styles.choiceChip, active && styles.tagSelected, pressed && styles.pressed]}><Text style={[styles.choiceChipText, active && styles.tagSelectedText]}>{option.label}</Text></Pressable>; })}</View>;
}

function ToggleRow({ description, label, onValueChange, value }: { description: string; label: string; onValueChange: (value: boolean) => void; value: boolean }) {
  return <View style={styles.toggleRow}><View style={styles.toggleCopy}><Text style={styles.label}>{label}</Text><Text style={styles.helper}>{description}</Text></View><Switch onValueChange={onValueChange} value={value} /></View>;
}

function VerificationSummary({ badges, loading, onOpen }: { badges: { selfie_verified: boolean; identity_verified: boolean; linkedin_verified: boolean } | null; loading: boolean; onOpen: () => void }) {
  const items = [
    { key: 'selfie' as const, label: 'Ảnh chụp cá nhân', verified: badges?.selfie_verified ?? false },
    { key: 'identity' as const, label: 'CCCD', verified: badges?.identity_verified ?? false },
    { key: 'linkedin' as const, label: 'LinkedIn', verified: badges?.linkedin_verified ?? false },
  ];
  return <View><Text style={styles.helper}>Chỉ trạng thái xác minh được hiển thị công khai; giấy tờ, dữ liệu KYC và thông tin riêng tư không xuất hiện trên hồ sơ.</Text>{loading ? <ActivityIndicator color={chonColors.ink} /> : <View style={styles.verificationRow}>{items.map((item) => <View key={item.key} style={styles.verificationItem}><ChonVerificationIcon height={28} type={item.key} verified={item.verified} /><Text style={styles.verificationLabel}>{item.label}</Text><Text style={[styles.verificationState, item.verified && styles.verified]}>{item.verified ? 'Đã xác minh' : 'Chưa xác minh'}</Text></View>)}</View>}<Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}><Text style={styles.inlineButtonText}>Quản lý xác minh</Text></Pressable></View>;
}

function ProvincePicker({ featured, normalizedSearch, onSearch, onSelect, open, others, search, selected, selectedId, setOpen }: { featured: ProvinceOption[]; normalizedSearch: string; onSearch: (value: string) => void; onSelect: (province: ProvinceOption) => void; open: boolean; others: ProvinceOption[]; search: string; selected: ProvinceOption | undefined; selectedId: number | null; setOpen: (value: boolean | ((current: boolean) => boolean)) => void }) {
  return <View testID="lx08-primary-location"><Pressable accessibilityLabel="Chọn tỉnh thành" accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={({ pressed }) => [styles.input, styles.selectButton, pressed && styles.pressed]}><Text style={selected ? styles.selectText : styles.placeholder}>{selected?.name ?? 'Chọn tỉnh/thành'}</Text><Text style={styles.selectChevron}>⌄</Text></Pressable>{open ? <View style={styles.provincePanel}><TextInput accessibilityLabel="Tìm tỉnh thành" onChangeText={onSearch} placeholder="Tìm trong 34 tỉnh/thành" placeholderTextColor={chonColors.softMuted} style={styles.input} value={search} /><ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.provinceScroll}>{normalizedSearch ? <ProvinceList onSelect={onSelect} provinces={featured} selectedId={selectedId} title="Kết quả" /> : <><ProvinceList onSelect={onSelect} provinces={featured} selectedId={selectedId} title="Ưu tiên" /><ProvinceList onSelect={onSelect} provinces={others} selectedId={selectedId} title="Các địa phương khác" /></>}</ScrollView></View> : null}</View>;
}

function ProvinceList({ onSelect, provinces, selectedId, title }: { onSelect: (province: ProvinceOption) => void; provinces: ProvinceOption[]; selectedId: number | null; title: string }) {
  return <View><Text style={styles.provinceTitle}>{title}</Text>{provinces.length ? provinces.map((province) => <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedId === province.id }} key={province.id} onPress={() => onSelect(province)} style={({ pressed }) => [styles.provinceItem, selectedId === province.id && styles.provinceSelected, pressed && styles.pressed]}><Text style={styles.provinceText}>{province.name}</Text></Pressable>) : <Text style={styles.mutedText}>Không tìm thấy địa phương phù hợp.</Text>}</View>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: chonColors.warmSurface, flex: 1 },
  scrollContent: { flexGrow: 1 },
  pageInner: { alignSelf: 'center', maxWidth: chonLayout.contentMaxWidth, paddingBottom: 40, paddingHorizontal: chonLayout.contentHorizontalPaddingMobile, width: '100%' },
  pageHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 20, justifyContent: 'space-between', paddingBottom: 18, paddingTop: 24 },
  pageHeaderCompact: { flexDirection: 'column' },
  pageHeadingCopy: { flex: 1, maxWidth: 760 },
  pageTitle: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '700', lineHeight: chonTypography.lineHeights.h2 },
  pageSubtitle: { color: chonColors.muted, fontSize: 12, lineHeight: 20, marginTop: 6 },
  publicActions: { flexDirection: 'row', gap: 8 },
  publicActionsCompact: { width: '100%' },
  primaryButton: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderRadius: 999, justifyContent: 'center', minHeight: chonLayout.primaryActionHeight, paddingHorizontal: 20 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  outlineButton: { alignItems: 'center', backgroundColor: chonColors.surface, borderColor: chonColors.gold, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: chonLayout.minimumTouchTarget, paddingHorizontal: 16 },
  outlineButtonText: { color: chonColors.text, fontSize: 12, fontWeight: '700' },
  flexButton: { flex: 1 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  linkCard: { alignItems: 'center', backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 20, padding: 14, ...chonShadows.card },
  linkCopy: { flex: 1, minWidth: 0 },
  linkLabel: { color: chonColors.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  linkValue: { color: chonColors.text, fontSize: 12, lineHeight: 18, marginTop: 3 },
  copyButton: { alignItems: 'center', backgroundColor: chonColors.gold, borderRadius: 999, justifyContent: 'center', minHeight: 40, paddingHorizontal: 16 },
  copyButtonText: { color: chonColors.text, fontSize: 11, fontWeight: '800' },
  contentGrid: { gap: 18 },
  contentGridDesktop: { alignItems: 'flex-start', flexDirection: 'row', gap: 24 },
  mediaColumn: { gap: 14 },
  mediaColumnDesktop: { width: 380 },
  formColumn: { flex: 1, gap: 14, minWidth: 0 },
  card: { backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: 12, borderWidth: 1, gap: 12, padding: 14, ...chonShadows.card },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardHeaderCopy: { flex: 1 },
  cardTitle: { color: chonColors.text, fontSize: 16, fontWeight: '700' },
  cardHint: { color: chonColors.muted, fontSize: 10, marginTop: 2 },
  avatarFrame: { aspectRatio: 3 / 4, backgroundColor: chonColors.warmSurface, borderRadius: 10, overflow: 'hidden', width: '100%' },
  avatarFallback: { alignItems: 'center', backgroundColor: chonColors.warmSurfaceStrong, flex: 1, justifyContent: 'center' },
  avatarInitial: { color: chonColors.primaryRed, fontFamily: chonTypography.families.display, fontSize: 54, fontWeight: '700' },
  photoFill: { height: '100%', width: '100%' },
  smallGoldButton: { alignItems: 'center', backgroundColor: chonColors.warmSurfaceStrong, borderColor: chonColors.gold, borderRadius: 999, borderWidth: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 12 },
  smallGoldButtonText: { color: chonColors.goldStrong, fontSize: 10, fontWeight: '800' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCard: { gap: 5, width: '31%' },
  photoFrame: { aspectRatio: 3 / 4, backgroundColor: chonColors.warmSurface, borderRadius: 8, overflow: 'hidden', position: 'relative', width: '100%' },
  visibilityBadge: { backgroundColor: 'rgba(8,23,38,0.72)', borderRadius: 999, left: 5, paddingHorizontal: 6, paddingVertical: 3, position: 'absolute', top: 5 },
  visibilityBadgePrivate: { backgroundColor: 'rgba(217,45,42,0.9)' },
  visibilityBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  visibilityButton: { alignItems: 'center', borderColor: chonColors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 34, paddingHorizontal: 6 },
  visibilityButtonText: { color: chonColors.text, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  section: { backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: 12, borderWidth: 1, gap: 12, padding: 16, ...chonShadows.card },
  sectionTitle: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: 16, fontWeight: '700' },
  field: { gap: 6 },
  label: { color: chonColors.text, fontSize: 12, fontWeight: '700' },
  helper: { color: chonColors.muted, fontSize: 10, lineHeight: 15 },
  input: { backgroundColor: chonColors.surface, borderColor: chonColors.borderStrong, borderRadius: 8, borderWidth: 1, color: chonColors.text, fontSize: 12, minHeight: chonLayout.formControlHeight, paddingHorizontal: 12, paddingVertical: 9 },
  placeholder: { color: chonColors.softMuted, flex: 1, fontSize: 12 },
  selectButton: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  selectText: { color: chonColors.text, flex: 1, fontSize: 12 },
  selectChevron: { color: chonColors.muted, fontSize: 18 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceChip: { alignItems: 'center', backgroundColor: chonColors.surface, borderColor: chonColors.borderStrong, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 36, paddingHorizontal: 11 },
  choiceChipSelected: { backgroundColor: chonColors.ink, borderColor: chonColors.ink },
  choiceChipText: { color: chonColors.text, fontSize: 10 },
  choiceChipTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  tagSelected: { backgroundColor: chonColors.warmSurfaceStrong, borderColor: chonColors.gold },
  tagSelectedText: { color: chonColors.goldStrong, fontWeight: '800' },
  textArea: { backgroundColor: chonColors.surface, borderColor: chonColors.borderStrong, borderRadius: 8, borderWidth: 1, color: chonColors.text, fontSize: 12, lineHeight: 20, minHeight: 160, padding: 12 },
  textMeta: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginTop: 5 },
  counter: { color: chonColors.muted, fontSize: 10 },
  ageRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  ageInput: { width: 90 },
  ageDash: { color: chonColors.muted },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  toggleCopy: { flex: 1 },
  infoLine: { alignItems: 'center', borderBottomColor: chonColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, justifyContent: 'space-between', minHeight: 44 },
  infoValue: { color: chonColors.muted, fontSize: 11, textAlign: 'right' },
  provincePanel: { backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: 8, borderWidth: 1, marginTop: 6, padding: 8 },
  provinceScroll: { maxHeight: 280 },
  provinceTitle: { color: chonColors.softMuted, fontSize: 9, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 8, textTransform: 'uppercase' },
  provinceItem: { borderRadius: 6, minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  provinceSelected: { backgroundColor: chonColors.warmSurfaceStrong },
  provinceText: { color: chonColors.text, fontSize: 11 },
  verificationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  verificationItem: { alignItems: 'center', borderColor: chonColors.border, borderRadius: 8, borderWidth: 1, flex: 1, minWidth: 110, padding: 10 },
  verificationLabel: { color: chonColors.text, fontSize: 10, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  verificationState: { color: chonColors.muted, fontSize: 9, marginTop: 2 },
  verified: { color: chonColors.goldStrong, fontWeight: '800' },
  inlineButton: { alignSelf: 'flex-start', marginTop: 10, minHeight: 36, justifyContent: 'center' },
  inlineButtonText: { color: chonColors.primaryRed, fontSize: 11, fontWeight: '800' },
  saveRow: { alignItems: 'flex-end', paddingVertical: 8 },
  saveRowCompact: { alignItems: 'stretch' },
  saveButton: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderRadius: 999, justifyContent: 'center', minHeight: 50, minWidth: 190, paddingHorizontal: 22 },
  saveButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  loadingBlock: { alignItems: 'center', minHeight: 320, justifyContent: 'center' },
  mutedText: { color: chonColors.muted, fontSize: 11, lineHeight: 17 },
  success: { backgroundColor: '#F0FDF4', borderRadius: 8, color: '#166534', fontSize: 11, marginTop: 12, padding: 10 },
  error: { backgroundColor: '#FEF2F2', borderRadius: 8, color: chonColors.danger, fontSize: 11, marginTop: 12, padding: 10 },
  fullLoading: { alignItems: 'center', backgroundColor: chonColors.warmSurface, flex: 1, justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.76 },
});
