import { z } from 'zod';

export const emailSchema = z.email().trim().toLowerCase();

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
  'You must be at least 18 years old.',
);
