import { StyleSheet, Text, View } from 'react-native';

export function ChonPhotoCount({
  count,
  size = 'regular',
}: {
  count: number;
  size?: 'compact' | 'regular' | undefined;
}) {
  const compact = size === 'compact';
  return (
    <View
      accessibilityLabel={`${count} ảnh`}
      style={[styles.badge, compact && styles.badgeCompact]}
      testID="chon-photo-count"
    >
      <View
        accessibilityElementsHidden
        style={[styles.camera, compact && styles.cameraCompact]}
        testID="chon-photo-count-icon"
      >
        <View style={[styles.cameraBump, compact && styles.cameraBumpCompact]} />
        <View style={[styles.cameraLens, compact && styles.cameraLensCompact]} />
      </View>
      <Text style={[styles.count, compact && styles.countCompact]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.72)', borderRadius: 4, flexDirection: 'row', gap: 4, minHeight: 20, paddingHorizontal: 5 },
  badgeCompact: { borderRadius: 3, gap: 2, height: 15, minHeight: 15, paddingHorizontal: 3 },
  camera: { alignItems: 'center', borderColor: '#FFFFFF', borderRadius: 1.5, borderWidth: 1, height: 7, justifyContent: 'center', position: 'relative', width: 8 },
  cameraCompact: { height: 6, width: 7 },
  cameraBump: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 1, borderTopRightRadius: 1, height: 2, left: 2, position: 'absolute', top: -3, width: 4 },
  cameraBumpCompact: { height: 1.5, left: 1.5, top: -2.5, width: 3 },
  cameraLens: { borderColor: '#FFFFFF', borderRadius: 2, borderWidth: 1, height: 4, width: 4 },
  cameraLensCompact: { height: 3, width: 3 },
  count: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  countCompact: { fontSize: 8, lineHeight: 10 },
});
