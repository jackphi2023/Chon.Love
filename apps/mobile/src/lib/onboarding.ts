import {
  minimumOnboardingSchema,
  type MinimumOnboardingInput,
} from '@myfan/validation';
import { getMobileSupabaseClient } from './supabase';

export type OnboardingStatus = {
  user_id: string;
  age_verified: boolean;
  policies_accepted: boolean;
  creator_terms_accepted: boolean;
  account_status: string;
  profile_status: string;
};

export type PolicyVersions = {
  terms: string;
  communityRules: string;
};

type PublicConfigRow = {
  key: string;
  value_json: unknown;
};

export function parsePolicyVersions(rows: readonly PublicConfigRow[]): PolicyVersions {
  const values = new Map(rows.map((row) => [row.key, row.value_json]));
  const terms = values.get('terms_version_current');
  const communityRules = values.get('community_rules_version_current');
  if (typeof terms !== 'string' || typeof communityRules !== 'string') {
    throw new Error('Current policy versions are not configured.');
  }
  return { terms, communityRules };
}

export async function getMyOnboardingStatus(): Promise<OnboardingStatus | null> {
  const client = requireAuthClient();
  const { data, error } = await client.rpc('get_my_onboarding_status');
  if (error) throw error;
  return (data?.[0] as OnboardingStatus | undefined) ?? null;
}

export async function completeMinimumOnboarding(input: MinimumOnboardingInput): Promise<void> {
  const parsed = minimumOnboardingSchema.parse(input);
  const client = requireAuthClient();
  const { data: config, error: configError } = await client.rpc('get_public_app_config');
  if (configError) throw configError;
  const versions = parsePolicyVersions(config ?? []);
  const { error } = await client.rpc('complete_my_onboarding', {
    p_date_of_birth: parsed.dateOfBirth,
    p_terms_version: versions.terms,
    p_community_rules_version: versions.communityRules,
    p_age_verification_method: 'self_declared',
  });
  if (error) throw error;
}

export function getReadableOnboardingError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'issues' in error) {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues;
    const firstMessage = issues?.[0]?.message;
    if (firstMessage) return firstMessage;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/at least 18|đủ 18/iu.test(message)) return 'Bạn phải đủ 18 tuổi để sử dụng MyFan.';
  if (/date_of_birth|date of birth|invalid date/iu.test(message)) {
    return 'Ngày sinh không hợp lệ. Vui lòng chọn đầy đủ Ngày – Tháng – Năm.';
  }
  if (/terms version|community rules version|policy versions/iu.test(message)) {
    return 'Phiên bản chính sách đã thay đổi. Vui lòng tải lại và chấp nhận lại.';
  }
  if (/account is not active|suspended|deactivated|deletion/iu.test(message)) {
    return 'Tài khoản hiện không hoạt động. Vui lòng liên hệ hỗ trợ.';
  }
  if (/authentication required|not authenticated/iu.test(message)) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  return 'Chưa thể hoàn tất xác nhận 18+. Vui lòng thử lại.';
}

function requireAuthClient() {
  const client = getMobileSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');
  return client;
}
