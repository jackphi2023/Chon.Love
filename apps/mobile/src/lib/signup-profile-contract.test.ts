import { describe, expect, it } from 'vitest';
import {
  normalizeOptionalEnumSelection,
  normalizeOptionalNumericSelection,
  SIGNUP_CHILDREN_OPTIONS,
  SIGNUP_DRINKING_OPTIONS,
  SIGNUP_EDUCATION_OPTIONS,
  SIGNUP_HEIGHT_OPTIONS,
  SIGNUP_NUMERIC_PRIVATE_VALUE,
  SIGNUP_RELATIONSHIP_OPTIONS,
  SIGNUP_SMOKING_OPTIONS,
  SIGNUP_WEIGHT_OPTIONS,
} from './signup-profile-contract';

const optionalEnumGroups = [
  SIGNUP_EDUCATION_OPTIONS,
  SIGNUP_RELATIONSHIP_OPTIONS,
  SIGNUP_CHILDREN_OPTIONS,
  SIGNUP_DRINKING_OPTIONS,
  SIGNUP_SMOKING_OPTIONS,
] as const;

describe('SU-04 optional Personal Info dropdown contract', () => {
  it('starts every enum dropdown with Chọn then Không chia sẻ', () => {
    for (const options of optionalEnumGroups) {
      expect(options[0]).toEqual({ value: '', label: 'Chọn' });
      expect(options[1]).toEqual({ value: 'prefer_not_to_say', label: 'Không chia sẻ' });
    }
  });

  it('starts physical dropdowns with Chọn then Không chia sẻ', () => {
    for (const options of [SIGNUP_HEIGHT_OPTIONS, SIGNUP_WEIGHT_OPTIONS]) {
      expect(options[0]).toEqual({ value: '', label: 'Chọn' });
      expect(options[1]).toEqual({ value: SIGNUP_NUMERIC_PRIVATE_VALUE, label: 'Không chia sẻ' });
    }
  });

  it('keeps requested Signup V2 physical ranges', () => {
    expect(SIGNUP_HEIGHT_OPTIONS[2]).toEqual({ value: '120', label: '120 cm' });
    expect(SIGNUP_HEIGHT_OPTIONS.at(-1)).toEqual({ value: '220', label: '220 cm' });
    expect(SIGNUP_WEIGHT_OPTIONS[2]).toEqual({ value: '35', label: '35 kg' });
    expect(SIGNUP_WEIGHT_OPTIONS.at(-1)).toEqual({ value: '250', label: '250 kg' });
  });

  it('normalizes Chọn and Không chia sẻ physical states to private null storage', () => {
    expect(normalizeOptionalNumericSelection('')).toBeNull();
    expect(normalizeOptionalNumericSelection(SIGNUP_NUMERIC_PRIVATE_VALUE)).toBeNull();
    expect(normalizeOptionalNumericSelection('178')).toBe(178);
  });

  it('normalizes an unselected enum to the mature not-shared enum', () => {
    expect(normalizeOptionalEnumSelection('')).toBe('prefer_not_to_say');
    expect(normalizeOptionalEnumSelection('single')).toBe('single');
    expect(normalizeOptionalEnumSelection('prefer_not_to_say')).toBe('prefer_not_to_say');
  });

  it('uses relationship status as the only relationship/marital dropdown', () => {
    expect(SIGNUP_RELATIONSHIP_OPTIONS.map((option) => option.value)).toEqual([
      '',
      'prefer_not_to_say',
      'single',
      'divorced',
      'widowed',
      'open',
      'complicated',
    ]);
  });
});
