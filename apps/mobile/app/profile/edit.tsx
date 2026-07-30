import {
  getMyProfile,
  listActiveProvinces,
  updateMyProfile,
  type GenderIdentity,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { profileEditorSchema } from '@myfan/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/screen';
import { getReadableProfileMediaError } from '@/lib/profile-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type ProfileFormValues = {
  username: string;
  displayName: string;
  bio: string;
  gender: GenderIdentity;
  provinceId: number | null;
  interestsText: string;
  discoveryEnabled: boolean;
  nearbyEnabled: boolean;
};

const genderOptions: Array<{ value: GenderIdentity; label: string }> = [
  { value: 'female', label: 'Nữ' },
  { value: 'male', label: 'Nam' },
  { value: 'non_binary', label: 'Phi nhị nguyên' },
  { value: 'other', label: 'Khác' },
  { value: 'prefer_not_to_say', label: 'Không muốn nêu' },
];

export default function EditProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);

  const { control, handleSubmit, reset, watch } = useForm<ProfileFormValues>({
    defaultValues: {
      username: '',
      displayName: '',
      bio: '',
      gender: 'prefer_not_to_say',
      provinceId: null,
      interestsText: '',
      discoveryEnabled: true,
      nearbyEnabled: false,
    },
  });

  const profileQuery = useQuery({
    queryKey: ['profile', 'me', auth.userId],
    enabled: Boolean(client && auth.userId),
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyProfile(client);
    },
  });

  const provincesQuery = useQuery({
    queryKey: ['administrative-areas', 'VN', 'active'],
    enabled: Boolean(client),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listActiveProvinces(client);
    },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    reset({
      username: profileQuery.data.username ?? '',
      displayName: profileQuery.data.display_name ?? '',
      bio: profileQuery.data.bio ?? '',
      gender: profileQuery.data.gender,
      provinceId: profileQuery.data.province_id,
      interestsText: profileQuery.data.interests.join(', '),
      discoveryEnabled: profileQuery.data.discovery_enabled,
      nearbyEnabled: profileQuery.data.nearby_enabled,
    });
  }, [profileQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!client) throw new Error('supabase_not_configured');
      const parsed = profileEditorSchema.safeParse({
        username: values.username,
        displayName: values.displayName,
        bio: values.bio,
        gender: values.gender,
        provinceId: values.provinceId,
        interests: values.interestsText.split(',').map((item) => item.trim()).filter(Boolean),
        discoveryEnabled: values.discoveryEnabled,
        nearbyEnabled: values.nearbyEnabled,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'invalid_profile');
      return updateMyProfile(client, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.back();
    },
    onError: (error) => setErrorMessage(getReadableProfileMediaError(error)),
  });

  const selectedProvinceId = watch('provinceId');
  const filteredProvinces = useMemo(() => {
    const query = provinceSearch.trim().toLocaleLowerCase('vi');
    return (provincesQuery.data ?? [])
      .filter((province) => !query || province.name.toLocaleLowerCase('vi').includes(query))
      .slice(0, 12);
  }, [provinceSearch, provincesQuery.data]);
  const selectedProvince = (provincesQuery.data ?? []).find((item) => item.id === selectedProvinceId);

  if (profileQuery.isLoading) {
    return (
      <Screen title="Chỉnh sửa hồ sơ" description="Đang tải thông tin hiện tại.">
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Chỉnh sửa hồ sơ"
      description="Email, ngày sinh, vị trí chính xác, KYC và ngân hàng không hiển thị trong hồ sơ."
    >
      <FieldLabel text="Username" />
      <Controller
        control={control}
        name="username"
        render={({ field }) => (
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="creator_myfan"
            style={styles.input}
            value={field.value}
          />
        )}
      />

      <FieldLabel text="Tên hiển thị" />
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextInput
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Tên bạn muốn cộng đồng nhìn thấy"
            style={styles.input}
            value={field.value}
          />
        )}
      />

      <FieldLabel text="Giới thiệu" />
      <Controller
        control={control}
        name="bio"
        render={({ field }) => (
          <TextInput
            multiline
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Chia sẻ ngắn về bạn và nội dung bạn quan tâm"
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            value={field.value}
          />
        )}
      />

      <FieldLabel text="Giới tính" />
      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <View style={styles.optionWrap}>
            {genderOptions.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option.value}
                onPress={() => field.onChange(option.value)}
                style={[styles.option, field.value === option.value && styles.optionSelected]}
              >
                <Text style={[styles.optionText, field.value === option.value && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      />

      <FieldLabel text="Tỉnh/thành" />
      <Controller
        control={control}
        name="provinceId"
        render={({ field }) => (
          <View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setProvincePickerOpen((value) => !value)}
              style={styles.inputButton}
            >
              <Text style={selectedProvince ? styles.inputButtonText : styles.placeholderText}>
                {selectedProvince?.name ?? 'Chọn tỉnh/thành'}
              </Text>
            </Pressable>
            {provincePickerOpen ? (
              <View style={styles.provincePanel}>
                <TextInput
                  onChangeText={setProvinceSearch}
                  placeholder="Tìm tỉnh/thành"
                  style={styles.input}
                  value={provinceSearch}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    field.onChange(null);
                    setProvincePickerOpen(false);
                  }}
                  style={styles.provinceItem}
                >
                  <Text style={styles.provinceText}>Không hiển thị tỉnh/thành</Text>
                </Pressable>
                {filteredProvinces.map((province) => (
                  <Pressable
                    accessibilityRole="button"
                    key={province.id}
                    onPress={() => {
                      field.onChange(province.id);
                      setProvincePickerOpen(false);
                    }}
                    style={styles.provinceItem}
                  >
                    <Text style={styles.provinceText}>{province.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        )}
      />

      <FieldLabel text="Sở thích" />
      <Controller
        control={control}
        name="interestsText"
        render={({ field }) => (
          <TextInput
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Âm nhạc, Du lịch, Nhiếp ảnh"
            style={styles.input}
            value={field.value}
          />
        )}
      />
      <Text style={styles.helper}>Tối đa 12 sở thích, ngăn cách bằng dấu phẩy.</Text>

      <Controller
        control={control}
        name="discoveryEnabled"
        render={({ field }) => (
          <SettingRow
            description="Cho phép người dùng đủ 18 tuổi tìm thấy hồ sơ của bạn."
            label="Hiển thị trong Khám phá"
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
            description="Chỉ dùng khoảng cách làm mờ; không hiển thị tọa độ hoặc địa chỉ."
            label="Cho phép Gần đây"
            onValueChange={field.onChange}
            value={field.value}
          />
        )}
      />

      <Pressable
        accessibilityRole="button"
        disabled={mutation.isPending}
        onPress={handleSubmit((values) => {
          setErrorMessage(null);
          mutation.mutate(values);
        })}
        style={[styles.saveButton, mutation.isPending && styles.disabled]}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Lưu hồ sơ</Text>
        )}
      </Pressable>

      {errorMessage || profileQuery.error || provincesQuery.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMessage ?? 'Không thể tải dữ liệu hồ sơ.'}
        </Text>
      ) : null}
    </Screen>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
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
        <Text style={styles.helper}>{description}</Text>
      </View>
      <Switch onValueChange={onValueChange} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15,
  },
  textArea: { minHeight: 112 },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#FCE7F3' },
  optionText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  optionTextSelected: { color: colors.primary },
  inputButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  inputButtonText: { color: colors.text, fontSize: 15 },
  placeholderText: { color: colors.muted, fontSize: 15 },
  provincePanel: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, marginTop: spacing.sm, gap: spacing.xs },
  provinceItem: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.sm },
  provinceText: { color: colors.text, fontSize: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  settingText: { flex: 1 },
  settingLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  saveButton: { minHeight: 50, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.md },
});
