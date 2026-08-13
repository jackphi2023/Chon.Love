import 'server-only';

export type PublicChonProfile = {
  public_profile_code: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  gender: string;
  age: number;
  province_name: string | null;
  interests: string[];
  height_cm: number | null;
  relationship_status: string;
  education_level: string;
  occupation: string | null;
  looking_for: string | null;
  membership_tier: 'free' | 'premium' | 'diamond';
  membership_badge_visible: boolean;
  member_since: string;
  avatar_available: boolean;
};

const codePattern = /^[0-9a-f]{6}$/u;

export function parsePublicProfileSlug(slug: string): string | null {
  const match = /^thanh-vien-id-([0-9a-f]{6})$/u.exec(slug.toLowerCase());
  return match?.[1] ?? null;
}

export function getPublicAvatarUrl(code: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/u, '');
  if (!supabaseUrl || !codePattern.test(code)) return null;
  return `${supabaseUrl}/functions/v1/public-profile-avatar?code=${encodeURIComponent(code)}`;
}

export async function getPublicChonProfile(code: string): Promise<PublicChonProfile | null> {
  if (!codePattern.test(code)) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/u, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) return null;
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_chon_profile`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: code }),
    next: { revalidate: 300 },
  });
  if (!response.ok) return null;
  const rows = await response.json() as PublicChonProfile[];
  return rows[0] ?? null;
}
