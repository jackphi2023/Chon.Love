import { luxyColors, luxyRadii } from '@myfan/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChonLoveLogo } from '@/components/chon-love-logo';

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
  const [joinHovered, setJoinHovered] = useState(false);
  const [actionHovered, setActionHovered] = useState(false);
  const logo = <ChonLoveLogo height={compact ? 42 : 54} width={compact ? 96 : 126} />;

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
            onPress={onLogin}
            style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}
          >
            <Text style={styles.loginText}>Đăng nhập</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Đăng ký"
            accessibilityRole="button"
            onHoverIn={() => setJoinHovered(true)}
            onHoverOut={() => setJoinHovered(false)}
            onPress={onJoin}
            style={({ pressed }) => [
              styles.registerButton,
              joinHovered && styles.registerButtonHovered,
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
            onHoverIn={() => setActionHovered(true)}
            onHoverOut={() => setActionHovered(false)}
            onPress={onAction}
            style={({ pressed }) => [
              styles.authAction,
              actionHovered && styles.authActionHovered,
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
  return (
    <View style={[styles.footer, compact && styles.footerCompact]} testID="chon-public-footer">
      <View style={styles.footerBrandBlock}>
        <ChonLoveLogo height={54} width={132} />
        <Text style={styles.footerTagline}>Chọn đúng người, Yêu đúng Gu © 2026 Chon.Love</Text>
      </View>
      <View style={styles.footerLinks}>
        <Pressable
          accessibilityLabel="Điều khoản"
          accessibilityRole="link"
          onPress={onTerms}
          style={({ pressed }) => [styles.footerLinkButton, pressed && styles.pressed]}
        >
          <Text style={styles.footerLinkText}>Điều khoản</Text>
        </Pressable>
        <View accessible={false} style={styles.footerDot} />
        <Pressable
          accessibilityLabel="Tiêu chuẩn cộng đồng"
          accessibilityRole="link"
          onPress={onCommunity}
          style={({ pressed }) => [styles.footerLinkButton, pressed && styles.pressed]}
        >
          <Text style={styles.footerLinkText}>Tiêu chuẩn cộng đồng</Text>
        </Pressable>
      </View>
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
  loginButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 10 },
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
    backgroundColor: luxyColors.actionRed,
    shadowColor: '#C81C1D',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
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
  authActionHovered: { backgroundColor: luxyColors.actionRed, borderColor: luxyColors.actionRed },
  authActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: {
    alignItems: 'center',
    backgroundColor: '#070707',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 22,
    justifyContent: 'space-between',
    minHeight: 150,
    paddingHorizontal: 42,
    paddingVertical: 28,
    width: '100%',
  },
  footerCompact: { alignItems: 'flex-start', flexDirection: 'column', gap: 14, paddingHorizontal: 18 },
  footerBrandBlock: { alignItems: 'flex-start', flexGrow: 1, maxWidth: 430, minWidth: 230 },
  footerTagline: { color: '#CFC6C1', fontSize: 12, lineHeight: 18 },
  footerLinks: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  footerLinkButton: { justifyContent: 'center', minHeight: 44 },
  footerLinkText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footerDot: { backgroundColor: '#F2B51D', borderRadius: 999, height: 4, width: 4 },
  pressed: { opacity: 0.78 },
});