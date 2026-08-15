import { luxyColors, luxyTypography } from '@myfan/ui';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type ChonLoveLogoProps = {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function ChonLoveLogo({ width = 150, height = 50, style }: ChonLoveLogoProps) {
  const fontSize = Math.min(height * 0.66, width / 4.4);

  return (
    <View
      accessibilityLabel="Chọn.love"
      accessibilityRole="image"
      style={[styles.container, { height, width }, style]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.wordmark, { fontSize, lineHeight: fontSize * 1.05 }]}
      >
        Chọn.love
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wordmark: {
    color: luxyColors.actionRed,
    fontFamily: luxyTypography.families.brand,
    fontWeight: '400',
    letterSpacing: -0.7,
    textAlign: 'center',
  },
});
