import { chonColors, chonLayout, chonShadows, chonTypography, luxyRadii } from '@myfan/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChonLoveLogo } from '@/components/chon-love-logo';

type ChonSiteFooterProps = {
  compact: boolean;
  onTerms: () => void;
  onCommunity: () => void;
  testID?: string;
};

export function ChonSiteFooter({ compact, onTerms, onCommunity, testID = 'chon-site-footer' }: ChonSiteFooterProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <View style={[styles.footer, compact && styles.footerCompact]} testID={testID}>
      <View style={[styles.inner, compact && styles.innerCompact]}>
        <View style={[styles.brandBlock, compact && styles.brandBlockCompact]}>
          <ChonLoveLogo height={compact ? 36 : 40} width={compact ? 88 : 98} />
          <Text style={[styles.tagline, compact && styles.taglineCompact]}>Chọn đúng người, Yêu đúng Gu</Text>
        </View>
        <View style={[styles.links, compact && styles.linksCompact]}>
          <FooterLink
            active={hoveredKey === 'terms'}
            label="Điều khoản"
            onHoverIn={() => setHoveredKey('terms')}
            onHoverOut={() => setHoveredKey(null)}
            onPress={onTerms}
          />
          <Text accessible={false} style={styles.separator}>-</Text>
          <FooterLink
            active={hoveredKey === 'community'}
            label="Tiêu chuẩn cộng đồng"
            onHoverIn={() => setHoveredKey('community')}
            onHoverOut={() => setHoveredKey(null)}
            onPress={onCommunity}
          />
        </View>
        <Text style={[styles.copyright, compact && styles.copyrightCompact]}>© 2026 Chon.Love</Text>
      </View>
    </View>
  );
}

function FooterLink({
  active,
  label,
  onHoverIn,
  onHoverOut,
  onPress,
}: {
  active: boolean;
  label: string;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="link"
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onPress={onPress}
      style={({ pressed }) => [styles.linkButton, active && styles.linkButtonHovered, pressed && styles.pressed]}
    >
      <Text style={[styles.linkText, active && styles.linkTextHovered]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: '#070707',
    width: '100%',
  },
  inner: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 24,
    justifyContent: 'space-between',
    maxWidth: chonLayout.contentMaxWidth,
    minHeight: 92,
    paddingHorizontal: 42,
    paddingVertical: 14,
    width: '100%',
  },
  footerCompact: { minHeight: 0 },
  innerCompact: {
    flexDirection: 'column',
    gap: 8,
    justifyContent: 'center',
    minHeight: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  brandBlock: { alignItems: 'center', flexDirection: 'row', gap: 10, minWidth: 0 },
  brandBlockCompact: { justifyContent: 'center', width: '100%' },
  tagline: { color: '#CFC6C1', fontSize: chonTypography.sizes.body, lineHeight: 18 },
  taglineCompact: { textAlign: 'center' },
  links: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' },
  linksCompact: { width: '100%' },
  linkButton: { borderRadius: luxyRadii.sm, justifyContent: 'center', minHeight: 32, paddingHorizontal: 5 },
  linkButtonHovered: { backgroundColor: 'rgba(255,187,0,0.12)', ...chonShadows.hover },
  linkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  linkTextHovered: { color: chonColors.gold },
  separator: { color: chonColors.gold, fontSize: 13, fontWeight: '700' },
  copyright: { color: '#AAA19C', fontSize: chonTypography.sizes.body, marginLeft: 'auto', textAlign: 'right' },
  copyrightCompact: { marginLeft: 0, textAlign: 'center', width: '100%' },
  pressed: { opacity: 0.78 },
});
