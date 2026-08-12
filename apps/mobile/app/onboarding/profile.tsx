import { getMyProfile, listActiveProvinces, listMyMedia, updateMyProfile, uploadProfileImage, type GenderIdentity, type ProvinceOption } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/screen';
import { getReadableProfileMediaError, pickAndPrepareProfileImage, type PreparedLocalProfileImage } from '@/lib/profile-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const GENDERS: Array<{ value: GenderIdentity; label: string }> = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'non_binary', label: 'Phi nhị nguyên' },
  { value: 'other', label: 'Khác' },
];

export default function ProfileSetupOnboarding() {
  const router = useRouter();
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<GenderIdentity>('male');
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [photo, setPhoto] = useState<PreparedLocalProfileImage | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isRestoring) return;
    if (!auth.userId) { router.replace('/(auth)'); return; }
    const client = getMobileSupabaseClient();
    if (!client) { setError('Kết nối hồ sơ chưa được cấu hình.'); setBusy(false); return; }
    let active = true;
    void Promise.all([getMyProfile(client), listActiveProvinces(client), listMyMedia(client)])
      .then(([profile, provinceRows, mediaRows]) => {
        if (!active) return;
        if (profile.profile_status === 'active') { router.replace('/(tabs)'); return; }
        setUsername(profile.username ?? '');
        setDisplayName(profile.display_name ?? '');
        if (GENDERS.some((item) => item.value === profile.gender)) setGender(profile.gender);
        setProvinceId(profile.province_id ?? provinceRows[0]?.id ?? null);
        setProvinces(provinceRows);
        setHasPhoto(mediaRows.some((item) => (item.visibility === 'avatar' || item.visibility === 'public') && (item.moderation_status === 'pending_review' || item.moderation_status === 'approved')));
      })
      .catch((cause) => { if (active) setError(getReadableProfileMediaError(cause)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [auth.isRestoring, auth.userId, router]);

  async function choosePhoto() {
    try {
      setError(null);
      const selected = await pickAndPrepareProfileImage('library', 'avatar');
      if (selected) setPhoto(selected);
    } catch (cause) { setError(getReadableProfileMediaError(cause)); }
  }

  async function continueToSelfie() {
    if (username.trim().length < 3 || !displayName.trim() || !provinceId) { setError('Vui lòng nhập tên, tên người dùng và chọn tỉnh/thành phố.'); return; }
    if (!photo && !hasPhoto) { setError('Vui lòng upload ít nhất một ảnh hồ sơ trước khi chụp selfie.'); return; }
    const client = getMobileSupabaseClient();
    if (!client) return;
    setBusy(true); setError(null);
    try {
      await updateMyProfile(client, { username: username.trim().toLowerCase(), displayName: displayName.trim(), bio: '', gender, provinceId, interests: [], discoveryEnabled: true, nearbyEnabled: true });
      if (photo) await uploadProfileImage(client, photo);
      router.replace('/onboarding/selfie');
    } catch (cause) { setError(getReadableProfileMediaError(cause)); }
    finally { setBusy(false); }
  }

  if (busy || auth.isRestoring) return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Đang chuẩn bị hồ sơ…</Text></View>;

  return (
    <Screen title="Tạo hồ sơ Luxy.Love" description="Điền thông tin cơ bản và upload ảnh thật. Bước tiếp theo bắt buộc chụp selfie live bằng camera.">
      <Text style={styles.label}>Tên người dùng</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setUsername} style={styles.input} value={username} />
      <Text style={styles.label}>Tên hiển thị</Text>
      <TextInput onChangeText={setDisplayName} style={styles.input} value={displayName} />

      <Text style={styles.label}>Giới tính tự khai báo</Text>
      <View style={styles.row}>{GENDERS.map((item) => <Pressable key={item.value} onPress={() => setGender(item.value)} style={[styles.chip, gender === item.value && styles.active]}><Text style={[styles.chipText, gender === item.value && styles.activeText]}>{item.label}</Text></Pressable>)}</View>
      <Text style={styles.hint}>Luxy khóa dữ liệu giới tính tự khai báo trong lần xác minh; hệ thống không suy đoán giới tính từ khuôn mặt.</Text>

      <Text style={styles.label}>Tỉnh / thành phố</Text>
      <ScrollView nestedScrollEnabled style={styles.provinces}><View style={styles.row}>{provinces.map((item) => <Pressable key={item.id} onPress={() => setProvinceId(item.id)} style={[styles.chip, provinceId === item.id && styles.active]}><Text style={[styles.chipText, provinceId === item.id && styles.activeText]}>{item.name}</Text></Pressable>)}</View></ScrollView>

      <Text style={styles.label}>Ảnh hồ sơ</Text>
      {photo ? <Image source={{ uri: photo.previewUri }} style={styles.photo} /> : null}
      {hasPhoto && !photo ? <Text style={styles.success}>✓ Đã có ảnh hồ sơ để đối chiếu.</Text> : null}
      <Pressable onPress={() => void choosePhoto()} style={styles.secondary}><Text style={styles.secondaryText}>{photo || hasPhoto ? 'Chọn ảnh khác' : 'Upload ảnh hồ sơ'}</Text></Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable onPress={() => void continueToSelfie()} style={styles.primary}><Text style={styles.primaryText}>Tiếp tục chụp selfie</Text></Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center' }, muted: { color: colors.muted },
  label: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: spacing.md }, input: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, minHeight: 50, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, active: { backgroundColor: colors.primary, borderColor: colors.primary }, chipText: { color: colors.text, fontSize: 13, fontWeight: '700' }, activeText: { color: colors.surface }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  provinces: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, maxHeight: 190, padding: spacing.sm }, photo: { aspectRatio: 1, borderRadius: 16, maxWidth: 360, width: '100%' }, success: { color: '#15803D', fontSize: 13, fontWeight: '700' },
  secondary: { alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 48 }, secondaryText: { color: colors.text, fontWeight: '800' }, primary: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, justifyContent: 'center', minHeight: 52, marginTop: spacing.lg }, primaryText: { color: colors.surface, fontSize: 15, fontWeight: '800' }, error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
});
