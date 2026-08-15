import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ChonLoveLogo } from '@/components/chon-love-logo';

export function PublicLegalShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isPhone = width < 768;

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, isPhone && styles.headerPhone]}>
        <Pressable accessibilityLabel="Về trang chủ Chọn.love" accessibilityRole="link" onPress={() => router.push('/')}>
          <ChonLoveLogo height={isPhone ? 42 : 50} width={isPhone ? 98 : 118} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/auth?mode=login')} style={styles.loginButton}>
            <Text style={styles.loginText}>Đăng nhập</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={styles.registerButton}>
            <Text style={styles.registerText}>Đăng ký</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.content, isPhone && styles.contentPhone]}>
        <Text accessibilityRole="header" style={[styles.title, isPhone && styles.titlePhone]}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.goldRule} />
        <View style={styles.body}>{children}</View>
      </View>

      <View style={[styles.footer, isPhone && styles.footerPhone]}>
        <View style={styles.footerBrand}>
          <ChonLoveLogo height={48} width={116} />
          <Text style={styles.footerTagline}>Chọn đúng người, Yêu đúng Gu © 2026 Chon.Love</Text>
        </View>
        <View style={styles.footerLinks}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/legal/terms')} style={styles.footerLinkButton}>
            <Text style={styles.footerLink}>Điều khoản</Text>
          </Pressable>
          <Text style={styles.footerDot}>•</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/legal/community-standards')} style={styles.footerLinkButton}>
            <Text style={styles.footerLink}>Tiêu chuẩn cộng đồng</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

export const publicLegalTextStyles = StyleSheet.create({
  heading: { color: '#1A1513', fontFamily: 'Georgia', fontSize: 20, fontWeight: '600', lineHeight: 28, marginTop: 26 },
  body: { color: '#514844', fontSize: 14, lineHeight: 23, marginTop: 7 },
  note: { color: '#776A64', fontSize: 12, lineHeight: 19, marginTop: 24 },
});

const styles = StyleSheet.create({
  page: { backgroundColor: '#FCEFEB', flexGrow: 1 },
  header: { alignItems: 'center', alignSelf: 'center', borderBottomColor: '#E6D7D0', borderBottomWidth: 1, flexDirection: 'row', height: 78, justifyContent: 'space-between', maxWidth: 1440, paddingHorizontal: 42, width: '100%' },
  headerPhone: { height: 64, paddingHorizontal: 14 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  loginButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 10 },
  loginText: { color: '#171312', fontSize: 13, fontWeight: '700' },
  registerButton: { alignItems: 'center', backgroundColor: '#D92D2A', borderRadius: 999, justifyContent: 'center', minHeight: 42, paddingHorizontal: 18 },
  registerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  content: { alignSelf: 'center', maxWidth: 850, minHeight: 650, paddingHorizontal: 32, paddingVertical: 72, width: '100%' },
  contentPhone: { paddingHorizontal: 18, paddingVertical: 48 },
  title: { color: '#171312', fontFamily: 'Georgia', fontSize: 42, fontWeight: '500', lineHeight: 52 },
  titlePhone: { fontSize: 32, lineHeight: 40 },
  description: { color: '#746660', fontSize: 14, lineHeight: 22, marginTop: 10 },
  goldRule: { backgroundColor: '#F2B51D', height: 2, marginTop: 22, width: 70 },
  body: { marginTop: 12 },
  footer: { alignItems: 'center', backgroundColor: '#070707', flexDirection: 'row', justifyContent: 'space-between', minHeight: 142, paddingHorizontal: 42, paddingVertical: 26 },
  footerPhone: { alignItems: 'flex-start', flexDirection: 'column', gap: 16, paddingHorizontal: 18 },
  footerBrand: { alignItems: 'flex-start', maxWidth: 430 },
  footerTagline: { color: '#CFC6C1', fontSize: 12, lineHeight: 18 },
  footerLinks: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  footerLinkButton: { justifyContent: 'center', minHeight: 44 },
  footerLink: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  footerDot: { color: '#F2B51D' },
});
