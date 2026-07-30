import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may contain letters, numbers and underscores only.');

export const provinceSchema = z.string().trim().min(2).max(100);
export const profileBioSchema = z.string().trim().max(500);

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
