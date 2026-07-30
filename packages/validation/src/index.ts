import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username cần ít nhất 3 ký tự.')
  .max(30, 'Username tối đa 30 ký tự.')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username chỉ gồm chữ, số và dấu gạch dưới.');

export const provinceSchema = z.string().trim().min(2).max(100);
export const profileBioSchema = z.string().trim().max(500, 'Giới thiệu tối đa 500 ký tự.');

export const genderIdentitySchema = z.enum([
  'female',
  'male',
  'non_binary',
  'other',
  'prefer_not_to_say',
]);

export function normalizeInterests(values: readonly string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase('vi');
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

export const profileInterestsSchema = z
  .array(z.string().trim().min(2, 'Mỗi sở thích cần ít nhất 2 ký tự.').max(32, 'Mỗi sở thích tối đa 32 ký tự.'))
  .max(12, 'Chọn tối đa 12 sở thích.')
  .transform(normalizeInterests);

export const profileEditorSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(2, 'Tên hiển thị cần ít nhất 2 ký tự.').max(60),
  bio: profileBioSchema,
  gender: genderIdentitySchema,
  provinceId: z.number().int().positive().nullable(),
  interests: profileInterestsSchema,
  discoveryEnabled: z.boolean(),
  nearbyEnabled: z.boolean(),
});

export const SUPPORTED_PROFILE_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PROFILE_IMAGE_DIMENSION = 12_000;

export const profileImageMetadataSchema = z
  .object({
    mimeType: z.enum(SUPPORTED_PROFILE_IMAGE_MIME_TYPES),
    fileSizeBytes: z.number().int().positive().max(MAX_PROFILE_IMAGE_BYTES),
    width: z.number().int().min(1).max(MAX_PROFILE_IMAGE_DIMENSION),
    height: z.number().int().min(1).max(MAX_PROFILE_IMAGE_DIMENSION),
    extension: z.enum(['jpg', 'png', 'webp']),
  })
  .superRefine((value, context) => {
    const matches =
      (value.mimeType === 'image/jpeg' && value.extension === 'jpg') ||
      (value.mimeType === 'image/png' && value.extension === 'png') ||
      (value.mimeType === 'image/webp' && value.extension === 'webp');
    if (!matches) {
      context.addIssue({ code: 'custom', message: 'Định dạng ảnh không khớp phần mở rộng.' });
    }
  });

export const dateOfBirthSchema = z.iso.date();

export function isAtLeastAge(dateOfBirth: string, minimumAge = 18, now = new Date()): boolean {
  const [yearText, monthText, dayText] = dateOfBirth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  const birthdayThisYear = new Date(Date.UTC(now.getUTCFullYear(), month - 1, day));
  let age = now.getUTCFullYear() - year;
  if (now < birthdayThisYear) age -= 1;
  return age >= minimumAge;
}

export const adultDateOfBirthSchema = dateOfBirthSchema.refine(
  (value) => isAtLeastAge(value),
  'Bạn phải đủ 18 tuổi để sử dụng MyFan.',
);

const requiredAcceptance = (message: string) => z.boolean().refine((value) => value, message);

export const minimumOnboardingSchema = z.object({
  dateOfBirth: adultDateOfBirthSchema,
  confirmedAdult: requiredAcceptance('Bạn cần xác nhận mình từ đủ 18 tuổi.'),
  acceptedTerms: requiredAcceptance('Bạn cần chấp nhận Điều khoản sử dụng hiện hành.'),
  acceptedCommunityStandards: requiredAcceptance(
    'Bạn cần chấp nhận Tiêu chuẩn cộng đồng hiện hành.',
  ),
});

export type MinimumOnboardingInput = z.infer<typeof minimumOnboardingSchema>;
export type ProfileEditorInput = z.infer<typeof profileEditorSchema>;
export type ProfileImageMetadata = z.infer<typeof profileImageMetadataSchema>;
