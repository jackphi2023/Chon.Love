export type SignupOption<T extends string> = {
  value: T;
  label: string;
};

export const SIGNUP_SELECT_PLACEHOLDER_VALUE = '' as const;
export const SIGNUP_NUMERIC_PRIVATE_VALUE = '__not_shared__' as const;

export const SIGNUP_SELECT_PLACEHOLDER = {
  value: SIGNUP_SELECT_PLACEHOLDER_VALUE,
  label: 'Chọn',
} as const;

export const SIGNUP_NOT_SHARED_OPTION = {
  value: 'prefer_not_to_say',
  label: 'Không chia sẻ',
} as const;

export const SIGNUP_EDUCATION_OPTIONS = [
  SIGNUP_SELECT_PLACEHOLDER,
  SIGNUP_NOT_SHARED_OPTION,
  { value: 'high_school', label: 'Trung học phổ thông' },
  { value: 'vocational', label: 'Trung cấp / nghề' },
  { value: 'college', label: 'Cao đẳng' },
  { value: 'bachelors', label: 'Đại học' },
  { value: 'masters', label: 'Thạc sĩ' },
  { value: 'doctorate', label: 'Tiến sĩ' },
  { value: 'other', label: 'Khác' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_RELATIONSHIP_OPTIONS = [
  SIGNUP_SELECT_PLACEHOLDER,
  SIGNUP_NOT_SHARED_OPTION,
  { value: 'single', label: 'Độc thân' },
  { value: 'divorced', label: 'Đã ly hôn' },
  { value: 'widowed', label: 'Góa' },
  { value: 'open', label: 'Mối quan hệ mở' },
  { value: 'complicated', label: 'Phức tạp' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_CHILDREN_OPTIONS = [
  SIGNUP_SELECT_PLACEHOLDER,
  SIGNUP_NOT_SHARED_OPTION,
  { value: 'no_children', label: 'Chưa có con' },
  { value: 'has_children', label: 'Có con' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_DRINKING_OPTIONS = [
  SIGNUP_SELECT_PLACEHOLDER,
  SIGNUP_NOT_SHARED_OPTION,
  { value: 'never', label: 'Không uống' },
  { value: 'socially', label: 'Thỉnh thoảng / xã giao' },
  { value: 'regularly', label: 'Thường xuyên' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_SMOKING_OPTIONS = [
  SIGNUP_SELECT_PLACEHOLDER,
  SIGNUP_NOT_SHARED_OPTION,
  { value: 'never', label: 'Không hút' },
  { value: 'socially', label: 'Thỉnh thoảng / xã giao' },
  { value: 'regularly', label: 'Thường xuyên' },
  { value: 'trying_to_quit', label: 'Đang cố bỏ' },
] as const satisfies readonly SignupOption<string>[];

function numericOptions(min: number, max: number, suffix: string) {
  return [
    SIGNUP_SELECT_PLACEHOLDER,
    { value: SIGNUP_NUMERIC_PRIVATE_VALUE, label: 'Không chia sẻ' },
    ...Array.from({ length: max - min + 1 }, (_, index) => {
      const value = String(min + index);
      return { value, label: `${value} ${suffix}` };
    }),
  ] as const;
}

export const SIGNUP_HEIGHT_OPTIONS = numericOptions(120, 220, 'cm');
export const SIGNUP_WEIGHT_OPTIONS = numericOptions(35, 250, 'kg');

// "Chọn" and "Không chia sẻ" are both valid for optional fields. They remain
// distinct in the form UI, while persistence normalizes them to a mature profile
// value: null for height/weight and prefer_not_to_say for enum attributes.
export const SIGNUP_PERSONAL_INFO_DEFAULTS = {
  heightCm: SIGNUP_SELECT_PLACEHOLDER_VALUE,
  weightKg: SIGNUP_SELECT_PLACEHOLDER_VALUE,
  educationLevel: SIGNUP_SELECT_PLACEHOLDER_VALUE,
  relationshipStatus: SIGNUP_SELECT_PLACEHOLDER_VALUE,
  childrenStatus: SIGNUP_SELECT_PLACEHOLDER_VALUE,
  drinkingStatus: SIGNUP_SELECT_PLACEHOLDER_VALUE,
  smokingStatus: SIGNUP_SELECT_PLACEHOLDER_VALUE,
} as const;

export function normalizeOptionalNumericSelection(value: string): number | null {
  if (!value || value === SIGNUP_NUMERIC_PRIVATE_VALUE) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function normalizeOptionalEnumSelection<T extends string>(value: T | ''): T | 'prefer_not_to_say' {
  return value === '' ? 'prefer_not_to_say' : value;
}
