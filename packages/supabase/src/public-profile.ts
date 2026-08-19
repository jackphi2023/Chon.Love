import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const CHON_PUBLIC_PROFILE_DESCRIPTION =
  'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm';

export const CHON_PUBLIC_PROFILE_ID_PATTERN = /^id-([0-9a-f]{6})$/u;

export type PublicChonProfile = {
  public_profile_code: string;
  display_name: string;
  age: number;
  gender: 'female' | 'male' | 'non_binary' | 'other' | null;
  province_name: string | null;
  headline: string | null;
  bio: string | null;
  height_cm: number | null;
  occupation: string | null;
  education_level: string | null;
  relationship_status: string | null;
  looking_for: string | null;
  interests: string[];
  member_since: string;
  membership_tier: 'free' | 'premium' | 'diamond' | string;
  membership_badge_visible: boolean;
  avatar_available: boolean;
};

export type ChonMemberRouteResolution = {
  public_profile_code: string;
  username: string;
};

type RpcError = { message?: string } | null;
type PublicProfileRpcResult = { data: PublicChonProfile[] | PublicChonProfile | null; error: RpcError };
type RouteResolutionRpcResult = { data: ChonMemberRouteResolution[] | ChonMemberRouteResolution | null; error: RpcError };

type PublicProfileRpcClient = {
  rpc: (
    functionName: 'get_public_chon_profile',
    args: { p_code: string },
  ) => Promise<PublicProfileRpcResult>;
  supabaseUrl?: string;
};

type RouteResolutionRpcClient = {
  rpc: (
    functionName: 'resolve_chon_member_route',
    args: { p_identifier: string },
  ) => Promise<RouteResolutionRpcResult>;
};

export function publicProfileCodeFromRouteId(value: string | null | undefined): string | null {
  const match = CHON_PUBLIC_PROFILE_ID_PATTERN.exec((value ?? '').trim().toLowerCase());
  return match?.[1] ?? null;
}

export function toPublicMemberPath(code: string): `/thanh-vien/id-${string}` {
  const normalized = code.trim().toLowerCase();
  if (!/^[0-9a-f]{6}$/u.test(normalized)) throw new Error('invalid_public_profile_code');
  return `/thanh-vien/id-${normalized}`;
}

export function publicProfileAvatarUrl(
  client: SupabaseClient<Database>,
  code: string,
): string | null {
  const normalized = code.trim().toLowerCase();
  if (!/^[0-9a-f]{6}$/u.test(normalized)) return null;
  const supabaseUrl = (client as unknown as PublicProfileRpcClient).supabaseUrl;
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/public-profile-avatar?code=${encodeURIComponent(normalized)}`;
}

export async function getPublicChonProfile(
  client: SupabaseClient<Database>,
  routeIdOrCode: string,
): Promise<PublicChonProfile | null> {
  const normalized = routeIdOrCode.trim().toLowerCase();
  const code = publicProfileCodeFromRouteId(normalized) ?? (/^[0-9a-f]{6}$/u.test(normalized) ? normalized : null);
  if (!code) return null;

  const rpcClient = client as unknown as PublicProfileRpcClient;
  const { data, error } = await rpcClient.rpc('get_public_chon_profile', { p_code: code });
  if (error) throw new Error(error.message || 'public_profile_unavailable');
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

export async function resolveChonMemberRoute(
  client: SupabaseClient<Database>,
  identifier: string,
): Promise<ChonMemberRouteResolution | null> {
  const normalized = identifier.trim().toLowerCase().replace(/^id-/u, '');
  if (!normalized || normalized.length > 48) return null;
  const rpcClient = client as unknown as RouteResolutionRpcClient;
  const { data, error } = await rpcClient.rpc('resolve_chon_member_route', { p_identifier: normalized });
  if (error) throw new Error(error.message || 'member_route_unavailable');
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

export async function resolveChonMemberUsername(
  client: SupabaseClient<Database>,
  identifier: string,
): Promise<string | null> {
  if (!CHON_PUBLIC_PROFILE_ID_PATTERN.test(identifier.trim().toLowerCase())) return identifier.trim();
  return (await resolveChonMemberRoute(client, identifier))?.username ?? null;
}