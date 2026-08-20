export type SignupOption<T extends string> = {
  value: T;
  label: string;
};

export const SIGNUP_EDUCATION_OPTIONS = [
  { value: 'prefer_not_to_say', label: 'Không muốn chia sẻ' },
  { value: 'high_school', label: 'Trung học phổ thông' },
  { value: 'vocational', label: 'Trung cấp / nghề' },
  { value: 'college', label: 'Cao đẳng' },
  { value: 'bachelors', label: 'Đại học' },
  { value: 'masters', label: 'Thạc sĩ' },
  { value: 'doctorate', label: 'Tiến sĩ' },
  { value: 'other', label: 'Khác' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_RELATIONSHIP_OPTIONS = [
  { value: 'prefer_not_to_say', label: 'Không muốn chia sẻ' },
  { value: 'single', label: 'Độc thân' },
  { value: 'divorced', label: 'Đã ly hôn' },
  { value: 'widowed', label: 'Góa' },
  { value: 'open', label: 'Mối quan hệ mở' },
  { value: 'complicated', label: 'Phức tạp' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_MARITAL_OPTIONS = [
  { value: 'prefer_not_to_say', label: 'Không muốn chia sẻ' },
  { value: 'never_married', label: 'Chưa từng kết hôn' },
  { value: 'married', label: 'Đã kết hôn' },
  { value: 'separated', label: 'Ly thân' },
  { value: 'divorced', label: 'Ly hôn' },
  { value: 'widowed', label: 'Góa' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_CHILDREN_OPTIONS = [
  { value: 'prefer_not_to_say', label: 'Không muốn chia sẻ' },
  { value: 'no_children', label: 'Chưa có con' },
  { value: 'has_children', label: 'Có con' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_DRINKING_OPTIONS = [
  { value: 'prefer_not_to_say', label: 'Không muốn chia sẻ' },
  { value: 'never', label: 'Không uống' },
  { value: 'socially', label: 'Thỉnh thoảng / xã giao' },
  { value: 'regularly', label: 'Thường xuyên' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_SMOKING_OPTIONS = [
  { value: 'prefer_not_to_say', label: 'Không muốn chia sẻ' },
  { value: 'never', label: 'Không hút' },
  { value: 'socially', label: 'Thỉnh thoảng / xã giao' },
  { value: 'regularly', label: 'Thường xuyên' },
  { value: 'trying_to_quit', label: 'Đang cố bỏ' },
] as const satisfies readonly SignupOption<string>[];

export const SIGNUP_HEIGHT_CM_OPTIONS = Array.from(
  { length: 101 },
  (_, index) => 120 + index,
);

export const SIGNUP_PERSONAL_INFO_DEFAULTS = {
  educationLevel: 'prefer_not_to_say',
  relationshipStatus: 'prefer_not_to_say',
  maritalStatus: null,
  childrenStatus: 'prefer_not_to_say',
  drinkingStatus: 'prefer_not_to_say',
  smokingStatus: 'prefer_not_to_say',
} as const;
