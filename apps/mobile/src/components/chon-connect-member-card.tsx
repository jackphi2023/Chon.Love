import {
  createPublicProfileMediaUrl,
  formatLuxyDistance,
  type LuxySearchProfile,
} from '@myfan/supabase';
import { luxyColors, luxyLayout, luxyRadii, luxyTypography } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChonMembershipBadge } from '@/components/chon-membership-badge';
import { ChonPhotoCount } from '@/components/chon-photo-count';
import { LazyProfileImage } from '@/components/lazy-profile-image';
import { LuxyFavoriteButton } from '@/components/luxy-favorite-button';
import { getMobileSupabaseClient } from '@/lib/supabase';

export function ChonConnectMemberCard({
  profile,
  desktop = false,
  style,
  testID,
}: {
  profile: LuxySearchProfile;
  desktop?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const router = useRouter();
  const client = getMobileSupabaseClient();
  const name = profile.display_name || profile.username || 'Thành viên Chọn.Love';
  const distance = formatLuxyDistance(profile.distance_km);
  const location = [profile.province_name, distance].filter(Boolean).join(' · ');
  const imageQuery = useQuery({
    queryKey: ['luxy-search', 'member-photo', profile.avatar_media_id],
    enabled: Boolean(client && profile.avatar_media_id && profile.avatar_storage_bucket && profile.avatar_storage_path),
    staleTime: 35_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!client || !profile.avatar_storage_bucket || !profile.avatar_storage_path) return null;
      return createPublicProfileMediaUrl(client, {
        storage_bucket: profile.avatar_storage_bucket,
        storage_path: profile.avatar_storage_path,
      });
    },
  });

  return (
    <View style={[styles.card, style]} testID={testID}>
      <Pressable
        accessibilityLabel={`Xem hồ sơ ${name}, ${profile.age} tuổi${location ? `, ${location}` : ''}`}
        accessibilityRole="button"
        disabled={!profile.username}
        onPress={() => profile.username && router.push({ pathname: '/profile/[username]', params: { username: profile.username } })}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}
      >
        <View style={styles.photoFrame}>
          {imageQuery.data ? (
            <LazyProfileImage
              accessibilityLabel={`Ảnh hồ sơ của ${name}`}
              resizeMode="cover"
              source={{ uri: imageQuery.data }}
              style={styles.memberPhoto}
            />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={[styles.photoInitial, desktop && styles.photoInitialDesktop]}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}

          <ChonMembershipBadge
            desktop={desktop}
            inset={desktop ? 8 : 7}
            tier={profile.membership_badge_tier}
            variant="icon"
          />
          <View style={[styles.photoCountWrap, desktop && styles.photoCountWrapDesktop]}>
            <ChonPhotoCount count={profile.photo_count} />
          </View>

          <View
            style={[styles.infoOverlay, desktop && styles.infoOverlayDesktop]}
            testID="chon-connect-card-info-overlay"
          >
            <View style={styles.memberNameRow}>
              {profile.is_online ? <View accessibilityLabel="Đang online" style={styles.onlineDot} /> : null}
              <Text numberOfLines={1} style={[styles.memberName, desktop && styles.memberNameDesktop]}>{name}</Text>
              <Text style={[styles.memberAge, desktop && styles.memberAgeDesktop]}>{profile.age}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.memberLocation, desktop && styles.memberLocationDesktop]}>
              {location || 'Việt Nam'}
            </Text>
          </View>
        </View>
      </Pressable>

      <View style={[styles.favoriteOverlay, desktop && styles.favoriteOverlayDesktop]}>
        <LuxyFavoriteButton
          initialFavorited={profile.is_favorited}
          initialFavoritedBy={profile.is_favorited_by}
          name={name}
          profileId={profile.id}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'relative' },
  cardPressable: { width: '100%' },
  cardPressed: { opacity: 0.84 },
  photoFrame: {
    aspectRatio: luxyLayout.memberCardAspectRatio,
    backgroundColor: luxyColors.elevatedSubtle,
    borderRadius: luxyRadii.sm,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  memberPhoto: { height: '100%', width: '100%' },
  photoFallback: { alignItems: 'center', backgroundColor: '#E7E5E4', height: '100%', justifyContent: 'center', width: '100%' },
  photoInitial: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 42 },
  photoInitialDesktop: { fontSize: 52 },
  photoCountWrap: { position: 'absolute', right: 7, top: 8, zIndex: 5 },
  photoCountWrapDesktop: { right: 8, top: 9 },
  infoOverlay: {
    backgroundColor: 'rgba(8,23,38,0.60)',
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    minHeight: 58,
    paddingBottom: 7,
    paddingHorizontal: 8,
    paddingRight: 56,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
  },
  infoOverlayDesktop: { minHeight: 60, paddingBottom: 8, paddingHorizontal: 9, paddingRight: 58, paddingTop: 8 },
  memberNameRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  onlineDot: { backgroundColor: luxyColors.online, borderRadius: 4, height: 7, width: 7 },
  memberName: { color: luxyColors.surface, flexShrink: 1, fontSize: 12, fontWeight: '600' },
  memberNameDesktop: { fontSize: 13, maxWidth: '72%' },
  memberAge: { color: luxyColors.surface, fontSize: 11 },
  memberAgeDesktop: { fontSize: 12 },
  memberLocation: { color: '#F1F1F1', fontSize: 9, marginTop: 3 },
  memberLocationDesktop: { fontSize: 10 },
  favoriteOverlay: { bottom: 7, position: 'absolute', right: 7, zIndex: 7 },
  favoriteOverlayDesktop: { bottom: 8, right: 8 },
});
