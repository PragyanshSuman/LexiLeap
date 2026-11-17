import { create } from 'zustand';

/** How long the parent area stays unlocked after entering the PIN. */
const UNLOCK_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000;

interface ParentSessionState {
  unlocked: boolean;
  failedAttempts: number;
  /** Epoch ms until which PIN entry is paused after too many wrong tries. */
  lockedOutUntil: number;
  unlock: () => void;
  lock: () => void;
  registerFailure: () => void;
}

let expiryTimer: ReturnType<typeof setTimeout> | null = null;
const clearExpiry = () => {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
};

/** In-memory only: the parent area always needs the PIN again after an app restart. */
export const useParentSession = create<ParentSessionState>((set, get) => ({
  unlocked: false,
  failedAttempts: 0,
  lockedOutUntil: 0,
  unlock: () => {
    clearExpiry();
    expiryTimer = setTimeout(() => get().lock(), UNLOCK_MS);
    set({ unlocked: true, failedAttempts: 0, lockedOutUntil: 0 });
  },
  lock: () => {
    clearExpiry();
    set({ unlocked: false });
  },
  registerFailure: () => {
    const failedAttempts = get().failedAttempts + 1;
    if (failedAttempts >= MAX_ATTEMPTS) {
      set({ failedAttempts: 0, lockedOutUntil: Date.now() + LOCKOUT_MS });
    } else {
      set({ failedAttempts });
    }
  },
}));
