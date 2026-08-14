import { luxyColors, luxyLayout, luxyRadii, luxySpacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChonLoveLogo } from '@/components/chon-love-logo';

const links = [
  { key: 'terms', label: 'Điều khoản', href: '/legal/terms' as const },
  { key: 'community', label: 'Tiêu chuẩn cộng đồng', href: '/legal/community-standards' as const },
] as const;

export function LuxyDesktopFooter() {
  const router = useRouter();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <View style={styles.footer} testID="chon-desktop-footer">
      <View style={styles.inner}>
        <View style={styles.brandGroup}>
          <ChonLoveLogo height={38} width={112} />
          <Text style={styles.slogan}>Chọn Đúng Người, Yêu Đúng Gu</Text>
          <View style={styles.ageBadge}><Text style={styles.ageText}>18+</Text></View>
        </View>
        <View style={styles.links}>
          {links.map((item) => (
            <Pressable
              accessibilityRole="link"
              key={item.key}
              onPointerEnter={() => setHoveredKey(item.key)}
              onPointerLeave={() => setHoveredKey(null)}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [styles.linkButton, hoveredKey === item.key && styles.linkButtonHover, pressed && styles.pressed]}
            >
              <Text style={[styles.linkText, hoveredKey === item.key && styles.linkTextHover]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.copyright}>© 2026 · Hẹn hò văn minh & nghiêm túc</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: luxyColors.charcoal,
    borderTopColor: luxyColors.brandGold,
    borderTopWidth: 2,
    minHeight: luxyLayout.desktopFooterHeight,
  },
  inner: {
    alignItems: 'center',
    alignSelf: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: luxySpacing.xl,
    justifyContent: 'space-between',
    maxWidth: luxyLayout.contentMaxWidth,
    minHeight: luxyLayout.desktopFooterHeight,
    paddingHorizontal: luxyLayout.contentHorizontalPaddingDesktop,
    width: '100%',
  },
  brandGroup: { alignItems: 'center', flexDirection: 'row', gap: 12, minWidth: 0 },
  slogan: { color: '#E5E7EB', fontSize: 12.5, fontWeight: '500' },
  ageBadge: {
    alignItems: 'center',
    borderColor: luxyColors.brandGold,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 42,
    paddingHorizontal: 8,
  },
  ageText: { color: luxyColors.brandGold, fontSize: 11, fontWeight: '800' },
  links: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  linkButton: { borderRadius: luxyRadii.pill, paddingHorizontal: 11, paddingVertical: 8 },
  linkButtonHover: { backgroundColor: 'rgba(242,181,29,0.12)' },
  linkText: { color: '#D1D5DB', fontSize: 12.5, fontWeight: '600' },
  linkTextHover: { color: luxyColors.brandGold },
  copyright: { color: '#9CA3AF', fontSize: 11.5 },
  pressed: { opacity: 0.72 },
});
