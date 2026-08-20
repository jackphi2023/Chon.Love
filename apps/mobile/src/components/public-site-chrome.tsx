import { luxyColors, luxyRadii } from '@myfan/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChonLoveLogo } from '@/components/chon-love-logo';

const CHON_GOLD = '#FFBB00';
const NAV_LOGO_SCALE = 1.16;

type PublicHeaderProps = {
  compact: boolean;
  variant?: 'overlay' | 'solid';
  onHome?: () => void;
  onJoin?: () => void;
  onLogin?: () => void;
  prompt?: string;
  actionLabel?: string;
  onAction?: () => void;
};

type PublicFooterProps = {
  compact: boolean;
  onTerms: () => void;
  onCommunity: () => void;
};

export function PublicHeader({
  compact,
  variant = 'solid',
  onHome,
  onJoin,
  onLogin,
  prompt,
  actionLabel,
  onAction,
}: PublicHeaderProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const logo = <ChonLoveLogo height={compact ? 42 : 54} scale={NAV_LOGO_SCALE} width={compact ? 96 : 126} />;

  return (
    <View
      style={[
        styles.header,
        compact && styles.headerCompact,
        variant === 'solid' && styles.headerSolid,
      ]}
      testID="chon-public-header"
    >
      {onHome ? (
        <Pressable
          accessibilityLabel="Chọn.Love — về trang chủ"
          accessibilityRole="button"
          onPress={onHome}
          style={({ pressed }) => [styles.logoButton, pressed && styles.pressed]}
        >
          {logo}
        </Pressable>
      ) : logo}

      {onJoin && onLogin ? (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Đăng nhập"
            accessibilityRole="button"
            onHoverIn={() => setHoveredKey('login')}
            onHoverOut={() => setHoveredKey(null)}
            onPress={onLogin}
            style={({ pressed }) => [
              styles.loginButton,
              hoveredKey === 'login' && styles.loginButtonHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.loginText}>Đăng nhập</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Đăng ký"
            accessibilityRole="button"
            onHoverIn={() => setHoveredKey('join')}
            onHoverOut={() => setHoveredKey(null)}
            onPress={onJoin}
            style={({ pressed }) => [
              styles.registerButton,
              hoveredKey === 'join' && styles.registerButtonHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.registerText}>Đăng ký</Text>
          </Pressable>
        </View>
      ) : actionLabel && onAction ? (
        <View style={styles.headerActions}>
          {prompt && !compact ? <Text style={styles.headerPrompt}>{prompt}</Text> : null}
          <Pressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            onHoverIn={() => setHoveredKey('action')}
            onHoverOut={() => setHoveredKey(null)}
            onPress={onAction}
            style={({ pressed }) => [
              styles.authAction,
              hoveredKey === 'action' && styles.authActionHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.authActionText}>{actionLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function PublicFooter({ compact, onTerms, onCommunity }: PublicFooterProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <View style={[styles.footer, compact && styles.footerCompact]} testID="chon-public-footer">
      <View style={[styles.footerBrandBlock, compact && styles.footerBrandBlockCompact]}>
        <ChonLoveLogo height={compact ? 36 : 40} width={compact ? 88 : 98} />
        <Text style={[styles.footerTagline, compact && styles.footerTaglineCompact]}>Chọn đúng người, Yêu đúng Gu</Text>
      </View>
      <View style={[styles.footerLinks, compact && styles.footerLinksCompact]}>
        <Pressable
          accessibilityLabel="Điều khoản"
          accessibilityRole="link"
          onHoverIn={() => setHoveredKey('terms')}
          onHoverOut={() => setHoveredKey(null)}
          onPress={onTerms}
          style={({ pressed }) => [
            styles.footerLinkButton,
            hoveredKey === 'terms' && styles.footerLinkButtonHovered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.footerLinkText, hoveredKey === 'terms' && styles.footerLinkTextHovered]}>Điều khoản</Text>
        </Pressable>
        <Text accessible={false} style={styles.footerSeparator}>-</Text>
        <Pressable
          accessibilityLabel="Tiêu chuẩn cộng đồng"
          accessibilityRole="link"
          onHoverIn={() => setHoveredKey('community')}
          onHoverOut={() => setHoveredKey(null)}
          onPress={onCommunity}
          style={({ pressed }) => [
            styles.footerLinkButton,
            hoveredKey === 'community' && styles.footerLinkButtonHovered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.footerLinkText, hoveredKey === 'community' && styles.footerLinkTextHovered]}>Tiêu chuẩn cộng đồng</Text>
        </Pressable>
      </View>
      <Text style={[styles.footerCopyright, compact && styles.footerCopyrightCompact]}>© 2026 Chon.Love</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    height: 78,
    justifyContent: 'space-between',
    maxWidth: 1440,
    paddingHorizontal: 42,
    position: 'relative',
    width: '100%',
    zIndex: 10,
  },
  headerCompact: { height: 62, paddingHorizontal: 14 },
  headerSolid: { backgroundColor: '#090909', maxWidth: undefined },
  logoButton: { justifyContent: 'center', minHeight: 44, minWidth: 44 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  headerPrompt: { color: '#E5E7EB', fontSize: 13 },
  loginButton: { alignItems: 'center', borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  loginButtonHovered: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  loginText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  registerButton: {
    alignItems: 'center',
    backgroundColor: '#D92D2A',
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  registerButtonHovered: {
    backgroundColor: '#E24A47',
    shadowColor: '#C81C1D',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 3,
  },
  registerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  authAction: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 92,
    paddingHorizontal: 14,
  },
  authActionHovered: {
    backgroundColor: luxyColors.actionRed,
    borderColor: luxyColors.actionRed,
    shadowColor: '#C81C1D',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  authActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: {
    alignItems: 'center',
    backgroundColor: '#070707',
    flexDirection: 'row',
    gap: 24,
    justifyContent: 'space-between',
    minHeight: 92,
    paddingHorizontal: 42,
    paddingVertical: 14,
    width: '100%',
  },
  footerCompact: {
    alignItems: 'center',
    flexDirection: 'column',
    gap: 8,
    justifyContent: 'center',
    minHeight: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  footerBrandBlock: { alignItems: 'center', flexDirection: 'row', gap: 10, minWidth: 0 },
  footerBrandBlockCompact: { justifyContent: 'center', width: '100%' },
  footerTagline: { color: '#CFC6C1', fontSize: 12.5, lineHeight: 18 },
  footerTaglineCompact: { textAlign: 'center' },
  footerLinks: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' },
  footerLinksCompact: { width: '100%' },
  footerLinkButton: { borderRadius: luxyRadii.sm, justifyContent: 'center', minHeight: 32, paddingHorizontal: 5 },
  footerLinkButtonHovered: {
    backgroundColor: 'rgba(255,187,0,0.12)',
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  footerLinkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  footerLinkTextHovered: { color: CHON_GOLD },
  footerSeparator: { color: CHON_GOLD, fontSize: 13, fontWeight: '700' },
  footerCopyright: { color: '#AAA19C', fontSize: 12, marginLeft: 'auto', textAlign: 'right' },
  footerCopyrightCompact: { marginLeft: 0, textAlign: 'center', width: '100%' },
  pressed: { opacity: 0.78 },
});