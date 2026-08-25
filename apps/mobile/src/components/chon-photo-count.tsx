import { StyleSheet, Text, View } from 'react-native';

export function ChonPhotoCount({ count }: { count: number }) {
  return (
    <View accessibilityLabel={`${count} ảnh`} style={styles.badge} testID="chon-photo-count">
      <View accessibilityElementsHidden style={styles.camera} testID="chon-photo-count-icon">
        <View style={styles.cameraBump} />
        <View style={styles.cameraLens} />
      </View>
      <Text style={styles.count}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.72)', borderRadius: 4, flexDirection: 'row', gap: 4, minHeight: 20, paddingHorizontal: 5 },
  camera: { alignItems: 'center', borderColor: '#FFFFFF', borderRadius: 1.5, borderWidth: 1, height: 7, justifyContent: 'center', position: 'relative', width: 8 },
  cameraBump: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 1, borderTopRightRadius: 1, height: 2, left: 2, position: 'absolute', top: -3, width: 4 },
  cameraLens: { borderColor: '#FFFFFF', borderRadius: 2, borderWidth: 1, height: 4, width: 4 },
  count: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
});
