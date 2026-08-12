import { colors, spacing } from '@myfan/ui';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getReadableProfileMediaError,
  pickAndPrepareProfileImage,
  type PreparedLocalProfileImage,
} from '@/lib/profile-media';

type Props = {
  disabled?: boolean;
  onCapture: (image: PreparedLocalProfileImage) => void;
  onError: (message: string) => void;
};

export function LiveSelfieCamera({ disabled = false, onCapture, onError }: Props) {
  const [isOpening, setIsOpening] = useState(false);

  async function handleOpenCamera() {
    setIsOpening(true);
    try {
      const image = await pickAndPrepareProfileImage('camera', 'private');
      if (image) onCapture(image);
    } catch (error) {
      onError(getReadableProfileMediaError(error));
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.placeholder}>
        <Text style={styles.icon}>◉</Text>
        <Text style={styles.title}>Chụp selfie trực tiếp</Text>
        <Text style={styles.description}>
          Camera hệ thống sẽ mở ở chế độ chụp ảnh. Không chọn ảnh có sẵn từ thư viện ở bước này.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || isOpening}
        onPress={() => void handleOpenCamera()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, (disabled || isOpening) && styles.disabled]}
      >
        {isOpening ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Bật camera và chụp selfie</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  placeholder: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.sm,
    minHeight: 230,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  icon: { color: colors.primary, fontSize: 42 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21, maxWidth: 420, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.lg },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
});
