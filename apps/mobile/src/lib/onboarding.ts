import {
  signupHeadlineBioSchema,
  signupLocationSchema,
  signupLookingForSchema,
  signupPersonalInfoSchema,
  type SignupHeadlineBioInput,
  type SignupLocationInput,
  type SignupLookingForInput,
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
    ...(normalized.heightCm == null ? {} : { p_height_cm: normalized.heightCm }),
    ...(normalized.weightKg == null ? {} : { p_weight_kg: normalized.weightKg }),
    p_education_level: normalized.educationLevel ?? 'prefer_not_to_say',
    p_relationship_status: normalized.relationshipStatus ?? 'prefer_not_to_say',
    p_children_status: normalized.childrenStatus ?? 'prefer_not_to_say',
    p_drinking_status: normalized.drinkingStatus ?? 'prefer_not_to_say',
    p_smoking_status: normalized.smokingStatus ?? 'prefer_not_to_say',
  });
  if (error) throw error;
}

export async function saveSignupLocation(input: SignupLocationInput): Promise<void> {
  const parsed = signupLocationSchema.parse(input);
  const location = parsed.location ?? null;
  const client = requireAuthClient();

  const { error } = await client.rpc('save_my_signup_location_v2', {
    p_province_id: parsed.provinceId,
    ...(location ? {
      p_latitude: location.latitude,
      p_longitude: location.longitude,
      p_accuracy_meters: location.accuracyMeters,
      p_captured_at: location.capturedAt,
      p_source: location.source,
    } : {}),
  });
  if (error) throw error;
}

export async function saveSignupLookingFor(input: SignupLookingForInput): Promise<void> {
  const parsed = signupLookingForSchema.parse(input);
  const client = requireAuthClient();

  const { error } = await client.rpc('save_my_signup_looking_for_v2', {
    p_looking_for: parsed.lookingFor,
    p_lifestyle_tags: parsed.lifestyleTags,
  });
  if (error) throw error;
}

export async function saveSignupHeadlineBio(input: SignupHeadlineBioInput): Promise<void> {
  const parsed = signupHeadlineBioSchema.parse(input);
  const client = requireAuthClient();

  const { error } = await client.rpc('save_my_signup_headline_bio_v2', {
    p_bio: parsed.bio,
    ...(parsed.headline ? { p_headline: parsed.headline } : {}),
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
  if (/invalid signup province|tỉnh\/thành/iu.test(message)) {
    return 'Vui lòng chọn một tỉnh/thành phố hợp lệ.';
  }
  if (/signup personal info must be completed first/iu.test(message)) {
    return 'Vui lòng hoàn thành bước Thông tin cá nhân trước khi tiếp tục.';
  }
  if (/signup location must be completed first/iu.test(message)) {
    return 'Vui lòng hoàn thành bước Vị trí trước khi tiếp tục.';
  }
  if (/signup looking for must be completed first/iu.test(message)) {
    return 'Vui lòng hoàn thành bước Bạn đang tìm kiếm điều gì trước khi tiếp tục.';
  }
  if (/signup looking for must be 50 to 4000 characters|looking.?for/iu.test(message)) {
    return 'Hãy chia sẻ từ 50 đến 4000 ký tự về người hoặc mối quan hệ bạn đang tìm kiếm.';
  }
  if (/signup lifestyle tags must contain 1 to 7 values|lifestyle tags/iu.test(message)) {
    return 'Vui lòng chọn từ 1 đến 7 mục tiêu / phong cách phù hợp.';
  }
  if (/signup profile photo must be completed first|profile photo required/iu.test(message)) {
    return 'Vui lòng upload ít nhất một ảnh hồ sơ trước khi giới thiệu bản thân.';
  }
  if (/signup headline must be blank or 10 to 50 characters|headline/iu.test(message)) {
    return 'Tiêu đề có thể để trống; nếu nhập cần từ 10 đến 50 ký tự.';
  }
  if (/signup bio must be 50 to 4000 characters|invalid_bio|biography/iu.test(message)) {
    return 'Hãy giới thiệu bản thân từ 50 đến 4000 ký tự.';
  }
  if (/location accuracy too low/iu.test(message)) {
    return 'Vị trí hiện tại chưa đủ chính xác. Bạn có thể thử lại hoặc tiếp tục chỉ với tỉnh/thành phố.';
  }
  if (/invalid coordinates|invalid location capture time|invalid location source|location payload must be complete/iu.test(message)) {
    return 'Vị trí hiện tại không hợp lệ hoặc đã quá cũ. Vui lòng thử lấy lại vị trí.';
  }
  if (/location update rate limited/iu.test(message)) {
    return 'Bạn vừa cập nhật vị trí. Vui lòng chờ khoảng 30 giây rồi thử lại.';
  }
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
  return 'Chưa thể lưu thông tin. Vui lòng thử lại.';
}

function requireAuthClient() {
  const client = getMobileSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');
  return client;
}