import { luxyColors, luxyRadii } from '@myfan/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChonLoveLogo } from '@/components/chon-love-logo';
import { ChonSiteFooter } from '@/components/chon-site-footer';

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

export function PublicFooter(props: PublicFooterProps) {
  return <ChonSiteFooter {...props} testID="chon-public-footer" />;
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
  pressed: { opacity: 0.78 },
});
