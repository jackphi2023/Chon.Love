import {
  createCreatorActivityPost,
  generateCreatorActivityPreview,
  getReadableActivityError,
  normalizeActivityVideoUrl,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getReadableActivityMediaError,
  pickOneActivityImage,
  uploadActivityImage,
  type PreparedActivityImage,
} from '@/lib/activity-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type ComposerMode = 'text' | 'image' | 'video';

export default function CreateActivityPage() {
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<ComposerMode>('text');
  const [image, setImage] = useState<PreparedActivityImage | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizedVideo = useMemo(() => {
    if (mode !== 'video' || !videoUrl.trim()) return null;
    try {
      return normalizeActivityVideoUrl(videoUrl);
    } catch {
      return null;
    }
  }, [mode, videoUrl]);

  function selectMode(next: ComposerMode) {
    setMode(next);
    setMessage(null);
    setErrorMessage(null);
    if (next !== 'image') setImage(null);
    if (next !== 'video') setVideoUrl('');
  }

  async function chooseImage() {
    setErrorMessage(null);
    try {
      const selected = await pickOneActivityImage();
      if (selected) setImage(selected);
    } catch (error) {
      setErrorMessage(getReadableActivityMediaError(error));
    }
  }

  async function submit() {
    if (!client || !auth.userId) {
      setErrorMessage('Bạn cần đăng nhập để đăng Hoạt động.');
      return;
    }
    if (!body.trim() || body.trim().length > 3000) {
      setErrorMessage('Nội dung phải có từ 1 đến 3.000 ký tự.');
      return;
    }
    if (mode === 'image' && !image) {
      setErrorMessage('Hãy chọn đúng một ảnh cho bài Hoạt động.');
      return;
    }
    if (mode === 'video' && !normalizedVideo) {
      setErrorMessage('Link video phải là HTTPS hợp lệ từ YouTube, youtu.be hoặc OF.TV.');
      return;
    }

    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      let mediaId: string | null = null;
      if (mode === 'image' && image) mediaId = await uploadActivityImage(client, image);
      const post = await createCreatorActivityPost(client, {
        body,
        mediaId,
        externalUrl: mode === 'video' ? normalizedVideo?.canonicalUrl ?? null : null,
      });

      if (post.content_type === 'image') {
        try {
          await generateCreatorActivityPreview(client, post.id);
        } catch {
          setMessage('Bài đã được gửi kiểm duyệt. Ảnh xem trước cho Admin đang chờ hệ thống xử lý lại.');
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['creator-activity'] });
      setMessage('Bài Hoạt động đã được gửi kiểm duyệt. Quyền xem áp dụng theo cài đặt chung của Creator.');
      setTimeout(() => router.back(), 700);
    } catch (error) {
      setErrorMessage(getReadableActivityError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>‹ Quay lại</Text>
          </Pressable>
          <Text style={styles.ageBadge}>18+</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>Đăng Hoạt động</Text>
        <Text style={styles.description}>
          Chỉ hỗ trợ nội dung chữ, chữ + một ảnh, hoặc chữ + một link video hợp lệ. Toàn bộ bài và Album ảnh dùng quyền riêng tư chung của Creator.
        </Text>

        <View style={styles.modeRow}>
          <ModeButton active={mode === 'text'} label="Chỉ chữ" onPress={() => selectMode('text')} />
          <ModeButton active={mode === 'image'} label="1 ảnh" onPress={() => selectMode('image')} />
          <ModeButton active={mode === 'video'} label="Link video" onPress={() => selectMode('video')} />
        </View>

        <View style={styles.fieldCard}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Nội dung</Text>
            <Text style={styles.counter}>{body.length}/3.000</Text>
          </View>
          <TextInput
            accessibilityLabel="Nội dung Hoạt động"
            maxLength={3000}
            multiline
            onChangeText={setBody}
            placeholder="Chia sẻ hoạt động mới với cộng đồng…"
            style={styles.bodyInput}
            textAlignVertical="top"
            value={body}
          />
        </View>

        {mode === 'image' ? (
          <View style={styles.fieldCard}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Ảnh đính kèm</Text>
              <Text style={styles.limit}>Tối đa 1 ảnh</Text>
            </View>
            {image ? <Image resizeMode="cover" source={{ uri: image.previewUri }} style={styles.previewImage} /> : null}
            <View style={styles.buttonRow}>
              <Pressable accessibilityRole="button" onPress={() => void chooseImage()} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>{image ? 'Đổi ảnh' : 'Chọn ảnh'}</Text>
              </Pressable>
              {image ? (
                <Pressable accessibilityRole="button" onPress={() => setImage(null)} style={styles.secondaryButton}>
                  <Text style={styles.dangerText}>Bỏ ảnh</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.help}>Ảnh sẽ tự xuất hiện trong Album Hoạt động sau khi bài được duyệt.</Text>
          </View>
        ) : null}

        {mode === 'video' ? (
          <View style={styles.fieldCard}>
            <Text style={styles.label}>Liên kết video</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={setVideoUrl}
              placeholder="https://www.youtube.com/watch?v=…"
              style={styles.urlInput}
              value={videoUrl}
            />
            <Text style={[styles.help, videoUrl.trim() && !normalizedVideo ? styles.errorText : null]}>
              {videoUrl.trim() && !normalizedVideo
                ? 'URL chưa hợp lệ hoặc nhà cung cấp chưa được hỗ trợ.'
                : 'Hỗ trợ YouTube, youtu.be và OF.TV. OF.TV mở bằng liên kết ngoài, không nhúng WebView.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Xem trước</Text>
          <Text style={styles.previewBody}>{body.trim() || 'Nội dung bài sẽ hiển thị tại đây.'}</Text>
          {mode === 'image' && image ? <Image source={{ uri: image.previewUri }} style={styles.previewImage} /> : null}
          {mode === 'video' && normalizedVideo ? (
            <Text style={styles.linkPreview}>
              {normalizedVideo.provider === 'youtube' ? 'YouTube' : 'OF.TV'} · {normalizedVideo.canonicalUrl}
            </Text>
          ) : null}
        </View>

        <View style={styles.privacyNote}>
          <Text style={styles.privacyTitle}>Quyền xem toàn bộ Hoạt động</Text>
          <Text style={styles.help}>Thay đổi tại tab Hoạt động: Công khai, Bạn bè hoặc Chỉ Fan.</Text>
        </View>

        {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
        {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={[styles.primaryButton, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Đăng bài</Text>}
        </Pressable>
        <Text style={styles.moderationNote}>Nội dung chữ, ảnh và liên kết đều phải qua kiểm duyệt trước khi hiển thị.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  ageBadge: { color: colors.primary, fontSize: 13, fontWeight: '900', backgroundColor: '#FCE7F3', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface },
  modeButtonActive: { borderColor: colors.primary, backgroundColor: '#FCE7F3' },
  modeText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  modeTextActive: { color: colors.primary },
  fieldCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 15, fontWeight: '900' },
  counter: { color: colors.muted, fontSize: 11 },
  limit: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  bodyInput: { minHeight: 150, color: colors.text, fontSize: 16, lineHeight: 23, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.md, backgroundColor: '#F9FAFB' },
  urlInput: { minHeight: 48, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md, backgroundColor: '#F9FAFB' },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  errorText: { color: colors.danger },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: 14, backgroundColor: colors.border },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  dangerText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  previewCard: { borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 18, backgroundColor: '#F0F9FF', padding: spacing.md, gap: spacing.sm },
  previewTitle: { color: '#0369A1', fontSize: 14, fontWeight: '900' },
  previewBody: { color: colors.text, fontSize: 15, lineHeight: 22 },
  linkPreview: { color: '#0369A1', fontSize: 12, lineHeight: 18 },
  privacyNote: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: spacing.md, gap: 4 },
  privacyTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  success: { color: '#166534', backgroundColor: '#F0FDF4', borderRadius: 12, padding: spacing.md },
  error: { color: colors.danger, backgroundColor: '#FEF2F2', borderRadius: 12, padding: spacing.md },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.primary },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  moderationNote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
