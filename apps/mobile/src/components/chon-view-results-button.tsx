import { chonColors, chonInteraction, chonRadii, chonShadows } from '@myfan/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

export function ChonViewResultsButton({
  onPress,
  style,
  testID,
  large = false,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  large?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        large && styles.large,
        style,
        (hovered || pressed) && styles.active,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <Text style={styles.text}>Xem kết quả</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: chonColors.surface,
    borderColor: chonColors.gold,
    borderRadius: chonRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  large: { minHeight: 48 },
  active: { backgroundColor: chonColors.gold, ...chonShadows.hover },
  text: { color: chonColors.text, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: chonInteraction.pressedOpacity, transform: [{ scale: 0.99 }] },
});
