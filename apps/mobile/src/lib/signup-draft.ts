export type SignupGender = 'male' | 'female';
export type SignupInterest = 'female' | 'male' | 'everyone';
export type SignupDraftStage = 'account' | 'otp' | 'verified';
export type SignupPreferences = {
  gender: SignupGender;
  interest: SignupInterest;
};

export type SignupDraft = SignupPreferences & {
  email: string | null;
  stage: SignupDraftStage;
  updatedAt: number;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const STORAGE_KEY = 'chon.signup.onboarding-v2';
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000;
const SIGNUP_FLOW_METADATA_KEY = 'chon_signup_flow';
const SIGNUP_GENDER_METADATA_KEY = 'chon_signup_gender';
const SIGNUP_INTEREST_METADATA_KEY = 'chon_signup_interest';
const SIGNUP_FLOW_METADATA_VALUE = 'onboarding-v2';
export const EMAIL_OTP_LENGTH = 6;

let memoryDraft: SignupDraft | null = null;

export function normalizeEmailOtp(value: string): string {
  return value.replace(/\D/gu, '').slice(0, EMAIL_OTP_LENGTH);
}

export function isCompleteEmailOtp(value: string): boolean {
  return new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`, 'u').test(value);
}

export function buildSignupPreferenceUserMetadata(preferences: SignupPreferences): Record<string, string> {
  return {
    [SIGNUP_FLOW_METADATA_KEY]: SIGNUP_FLOW_METADATA_VALUE,
    [SIGNUP_GENDER_METADATA_KEY]: preferences.gender,
    [SIGNUP_INTEREST_METADATA_KEY]: preferences.interest,
  };
}

export function readSignupPreferencesFromUserMetadata(metadata: unknown): SignupPreferences | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const candidate = metadata as Record<string, unknown>;
  const gender = candidate[SIGNUP_GENDER_METADATA_KEY];
  const interest = candidate[SIGNUP_INTEREST_METADATA_KEY];
  if (candidate[SIGNUP_FLOW_METADATA_KEY] !== SIGNUP_FLOW_METADATA_VALUE) return null;
  if (gender !== 'male' && gender !== 'female') return null;
  if (interest !== 'female' && interest !== 'male' && interest !== 'everyone') return null;
  return { gender, interest };
}

export function writeSignupDraft(draft: SignupDraft): void {
  memoryDraft = draft;
  const serialized = JSON.stringify(draft);
  for (const storage of getDraftStorages()) {
    try {
      storage.setItem(STORAGE_KEY, serialized);
      return;
    } catch {
      // Try the next storage. localStorage is preferred because confirmation
      // links commonly open in a new tab where sessionStorage is unavailable.
    }
  }
}

export function patchSignupDraft(patch: Partial<Omit<SignupDraft, 'gender' | 'interest'>>): SignupDraft | null {
  const current = readSignupDraft();
  if (!current) return null;
  const next: SignupDraft = {
    ...current,
    ...patch,
    updatedAt: patch.updatedAt ?? Date.now(),
  };
  writeSignupDraft(next);
  return next;
}

export function readSignupDraft(now = Date.now()): SignupDraft | null {
  for (const storage of getDraftStorages()) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) continue;
      const parsed = parseSignupDraft(JSON.parse(raw) as unknown);
      if (parsed && now - parsed.updatedAt <= MAX_DRAFT_AGE_MS) {
        memoryDraft = parsed;
        // Promote a legacy/session draft into the preferred persistent store.
        writeSignupDraft(parsed);
        return parsed;
      }
      storage.removeItem(STORAGE_KEY);
    } catch {
      try { storage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
    }
  }

  if (memoryDraft && now - memoryDraft.updatedAt <= MAX_DRAFT_AGE_MS) return memoryDraft;
  memoryDraft = null;
  return null;
}

export function clearSignupDraft(): void {
  memoryDraft = null;
  for (const storage of getDraftStorages()) {
    try { storage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
  }
}

function parseSignupDraft(value: unknown): SignupDraft | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SignupDraft>;
  if (candidate.gender !== 'male' && candidate.gender !== 'female') return null;
  if (candidate.interest !== 'female' && candidate.interest !== 'male' && candidate.interest !== 'everyone') return null;
  if (candidate.stage !== 'account' && candidate.stage !== 'otp' && candidate.stage !== 'verified') return null;
  if (candidate.email !== null && typeof candidate.email !== 'string') return null;
  if (typeof candidate.updatedAt !== 'number' || !Number.isFinite(candidate.updatedAt)) return null;
  return {
    gender: candidate.gender,
    interest: candidate.interest,
    email: candidate.email ?? null,
    stage: candidate.stage,
    updatedAt: candidate.updatedAt,
  };
}

function getDraftStorages(): StorageLike[] {
  const globalObject = globalThis as unknown as {
    localStorage?: StorageLike;
    sessionStorage?: StorageLike;
  };
  const storages: StorageLike[] = [];
  for (const candidate of [globalObject.localStorage, globalObject.sessionStorage]) {
    if (!candidate) continue;
    if (typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function' || typeof candidate.removeItem !== 'function') continue;
    if (!storages.includes(candidate)) storages.push(candidate);
  }
  return storages;
}
