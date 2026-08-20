import { getMyProfile, listActiveProvinces, listMyMedia, updateMyProfile, uploadProfileImage, type GenderIdentity, type ProvinceOption } from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SignupFieldLabel,
  SignupHelpText,
  SignupSecondaryButton,
  SignupShell,
  SignupTag,
  SignupTextField,
} from '@/components/signup-shell';
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

  if (busy || auth.isRestoring) return <View style={styles.loading}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.muted}>Đang chuẩn bị hồ sơ…</Text></View>;

  return (
    <SignupShell
      description="Điền thông tin cơ bản và upload ảnh thật. Các phiên SU tiếp theo sẽ tách phần này thành từng màn riêng mà không đổi dữ liệu hiện có."
      onBack={() => router.replace('/(onboarding)')}
      step={6}
      testID="chon-profile-setup-bridge"
      title="Tạo hồ sơ Chon.Love"
    >
      <SignupFieldLabel required>Tên người dùng</SignupFieldLabel>
      <SignupTextField autoCapitalize="none" autoCorrect={false} onChangeText={setUsername} value={username} />

      <SignupFieldLabel required>Tên hiển thị</SignupFieldLabel>
      <SignupTextField onChangeText={setDisplayName} value={displayName} />

      <SignupFieldLabel>Giới tính tự khai báo</SignupFieldLabel>
      <View style={styles.row}>
        {GENDERS.map((item) => (
          <SignupTag
            key={item.value}
            label={item.label}
            onPress={() => setGender(item.value)}
            selected={gender === item.value}
          />
        ))}
      </View>
      <SignupHelpText>Chon.Love khóa dữ liệu giới tính tự khai báo trong lần xác minh; hệ thống không suy đoán giới tính từ khuôn mặt.</SignupHelpText>

      <SignupFieldLabel required>Tỉnh / thành phố</SignupFieldLabel>
      <ScrollView nestedScrollEnabled style={styles.provinces}>
        <View style={styles.row}>
          {provinces.map((item) => (
            <SignupTag
              key={item.id}
              label={item.name}
              onPress={() => setProvinceId(item.id)}
              selected={provinceId === item.id}
            />
          ))}
        </View>
      </ScrollView>

      <SignupFieldLabel required>Ảnh hồ sơ</SignupFieldLabel>
      {photo ? <Image source={{ uri: photo.previewUri }} style={styles.photo} /> : null}
      {hasPhoto && !photo ? <SignupHelpText tone="success">✓ Đã có ảnh hồ sơ để đối chiếu.</SignupHelpText> : null}
      <Pressable accessibilityRole="button" onPress={() => void choosePhoto()} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
        <Text style={styles.photoButtonText}>{photo || hasPhoto ? 'Chọn ảnh khác' : 'Upload ảnh hồ sơ'}</Text>
      </Pressable>

      {error ? <SignupHelpText tone="danger">{error}</SignupHelpText> : null}
      <SignupSecondaryButton busy={busy} label="Tiếp tục chụp selfie" onPress={() => void continueToSelfie()} />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center' },
  muted: { color: colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  provinces: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, maxHeight: 190, padding: spacing.sm },
  photo: { aspectRatio: 1, borderRadius: 14, maxWidth: 360, width: '100%' },
  photoButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 18 },
  photoButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.78 },
});
