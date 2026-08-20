export type SignupGender = 'male' | 'female';
export type SignupInterest = 'female' | 'male' | 'everyone';
export type SignupDraftStage = 'account' | 'otp' | 'verified';

export type SignupDraft = {
  gender: SignupGender;
  interest: SignupInterest;
  email: string | null;
  stage: SignupDraftStage;
  updatedAt: number;
};

type SessionStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const STORAGE_KEY = 'chon.signup.onboarding-v2';
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000;
export const EMAIL_OTP_LENGTH = 6;

let memoryDraft: SignupDraft | null = null;

export function normalizeEmailOtp(value: string): string {
  return value.replace(/\D/gu, '').slice(0, EMAIL_OTP_LENGTH);
}

export function isCompleteEmailOtp(value: string): boolean {
  return new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`, 'u').test(value);
}

export function writeSignupDraft(draft: SignupDraft): void {
  memoryDraft = draft;
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be disabled by privacy settings. In-memory fallback still
    // preserves the draft for the current app process.
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
  const storage = getSessionStorage();
  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseSignupDraft(JSON.parse(raw) as unknown);
        if (parsed && now - parsed.updatedAt <= MAX_DRAFT_AGE_MS) {
          memoryDraft = parsed;
          return parsed;
        }
        storage.removeItem(STORAGE_KEY);
      }
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
  const storage = getSessionStorage();
  if (!storage) return;
  try { storage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
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

function getSessionStorage(): SessionStorageLike | null {
  const candidate = (globalThis as unknown as { sessionStorage?: SessionStorageLike }).sessionStorage;
  if (!candidate) return null;
  if (typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function' || typeof candidate.removeItem !== 'function') return null;
  return candidate;
}
