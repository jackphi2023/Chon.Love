import {
  minimumOnboardingSchema,
  signupPersonalInfoSchema,
  type MinimumOnboardingInput,
  type SignupPersonalInfoInput,
} from '@myfan/validation';
import {
  normalizeOptionalEnumSelection,
  normalizeOptionalNumericSelection,
} from './signup-profile-contract';
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

export type SignupPersonalInfoFormInput = {
  dateOfBirth: string;
  displayName: string;
  gender: 'male' | 'female';
  interestedIn: 'female' | 'male' | 'everyone';
  heightCm: string;
  weightKg: string;
  educationLevel: string;
  relationshipStatus: string;
  childrenStatus: string;
  drinkingStatus: string;
  smokingStatus: string;
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

async function getCurrentPolicyVersions(): Promise<PolicyVersions> {
  const client = requireAuthClient();
  const { data: config, error: configError } = await client.rpc('get_public_app_config');
  if (configError) throw configError;
  return parsePolicyVersions(config ?? []);
}

export async function completeMinimumOnboarding(input: MinimumOnboardingInput): Promise<void> {
  const parsed = minimumOnboardingSchema.parse(input);
  const client = requireAuthClient();
  const versions = await getCurrentPolicyVersions();
  const { error } = await client.rpc('complete_my_onboarding', {
    p_date_of_birth: parsed.dateOfBirth,
    p_terms_version: versions.terms,
    p_community_rules_version: versions.communityRules,
    p_age_verification_method: 'self_declared',
  });
  if (error) throw error;
}

export async function saveSignupPersonalInfo(input: SignupPersonalInfoFormInput): Promise<void> {
  const normalized: SignupPersonalInfoInput = signupPersonalInfoSchema.parse({
    dateOfBirth: input.dateOfBirth,
    displayName: input.displayName,
    gender: input.gender,
    interestedIn: input.interestedIn,
    heightCm: normalizeOptionalNumericSelection(input.heightCm),
    weightKg: normalizeOptionalNumericSelection(input.weightKg),
    educationLevel: normalizeOptionalEnumSelection(input.educationLevel) as SignupPersonalInfoInput['educationLevel'],
    relationshipStatus: normalizeOptionalEnumSelection(input.relationshipStatus) as SignupPersonalInfoInput['relationshipStatus'],
    childrenStatus: normalizeOptionalEnumSelection(input.childrenStatus) as SignupPersonalInfoInput['childrenStatus'],
    drinkingStatus: normalizeOptionalEnumSelection(input.drinkingStatus) as SignupPersonalInfoInput['drinkingStatus'],
    smokingStatus: normalizeOptionalEnumSelection(input.smokingStatus) as SignupPersonalInfoInput['smokingStatus'],
  });

  const client = requireAuthClient();
  const versions = await getCurrentPolicyVersions();
  const { error } = await client.rpc('save_my_signup_personal_info_v2', {
    p_date_of_birth: normalized.dateOfBirth,
    p_terms_version: versions.terms,
    p_community_rules_version: versions.communityRules,
    p_display_name: normalized.displayName,
    p_gender: normalized.gender,
    p_interested_in: normalized.interestedIn,
    p_height_cm: normalized.heightCm ?? null,
    p_weight_kg: normalized.weightKg ?? null,
    p_education_level: normalized.educationLevel ?? 'prefer_not_to_say',
    p_relationship_status: normalized.relationshipStatus ?? 'prefer_not_to_say',
    p_children_status: normalized.childrenStatus ?? 'prefer_not_to_say',
    p_drinking_status: normalized.drinkingStatus ?? 'prefer_not_to_say',
    p_smoking_status: normalized.smokingStatus ?? 'prefer_not_to_say',
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
  if (/at least 18|đủ 18/iu.test(message)) return 'Chon.Love chỉ dành cho người trưởng thành. Tài khoản của bạn chưa đáp ứng điều kiện sử dụng.';
  if (/date_of_birth|date of birth|invalid date/iu.test(message)) {
    return 'Ngày sinh không hợp lệ. Vui lòng chọn đầy đủ Ngày – Tháng – Năm.';
  }
  if (/display_name|display name/iu.test(message)) {
    return 'Tên hiển thị cần từ 10 đến 50 ký tự.';
  }
  if (/height_cm|height/iu.test(message)) return 'Chiều cao không hợp lệ. Vui lòng chọn từ 120 đến 220 cm hoặc Không chia sẻ.';
  if (/weight_kg|weight/iu.test(message)) return 'Cân nặng không hợp lệ. Vui lòng chọn một giá trị hợp lệ hoặc Không chia sẻ.';
  if (/terms version|community rules version|policy versions/iu.test(message)) {
    return 'Phiên bản chính sách đã thay đổi. Vui lòng tải lại và thử lại.';
  }
  if (/signup profile must be incomplete/iu.test(message)) {
    return 'Hồ sơ này đã qua bước đăng ký ban đầu và không thể ghi đè bằng biểu mẫu tạo tài khoản.';
  }
  if (/account is not active|suspended|deactivated|deletion/iu.test(message)) {
    return 'Tài khoản hiện không hoạt động. Vui lòng liên hệ hỗ trợ.';
  }
  if (/authentication required|not authenticated/iu.test(message)) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  return 'Chưa thể lưu thông tin cá nhân. Vui lòng thử lại.';
}

function requireAuthClient() {
  const client = getMobileSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');
  return client;
}
