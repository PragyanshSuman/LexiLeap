import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildDailyPlan } from '@/engine/plan';
import { applySession, emptyProgress, HISTORY_DAYS, pruneHistory } from '@/engine/progress';
import type { FocusSample } from '@/engine/focus';
import type { Assessment, LetterAttempt, Mood, ProgressState, SessionOutcome, SessionResult, SpeechCheck } from '@/engine/types';
import { addDays, dayKey, type DayKey } from '@/lib/date';
import type { Language } from '@/i18n';
import { hashPin, newSalt } from '@/services/pin';
import { DEFAULT_PREFS, MAX_PROFILES, usernameKey, type Prefs, type Profile } from './profile';

interface ParentLock {
  pinHash: string;
  salt: string;
}

interface AppState {
  /** App language, device-wide like the original app's language setting. */
  language: Language;
  setLanguage: (language: Language) => void;
  profiles: Profile[];
  activeProfileId: string | null;
  parent: ParentLock | null;
  progress: Record<string, ProgressState>;

  setParentPin: (pin: string) => Promise<void>;
  verifyParentPin: (pin: string) => Promise<boolean>;

  addProfile: (input: Pick<Profile, 'name' | 'avatar' | 'age'>, password?: string) => Promise<string>;
  /** Checks a username and password; on success makes that child active. */
  logIn: (username: string, password: string) => Promise<'ok' | 'unknown-user' | 'wrong-password'>;
  setPassword: (id: string, password: string) => Promise<void>;
  isUsernameTaken: (name: string, exceptId?: string) => boolean;
  updateProfile: (id: string, patch: Partial<Pick<Profile, 'name' | 'avatar' | 'age'>>) => void;
  updatePrefs: (id: string, patch: Partial<Prefs>) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string | null) => void;

  recordSession: (profileId: string, result: SessionResult) => SessionOutcome;
  ensurePlan: (profileId: string, day?: DayKey) => void;
  setMood: (profileId: string, mood: Mood, day?: DayKey) => void;
  addUsage: (profileId: string, seconds: number, day?: DayKey) => void;
  grantBonusMinutes: (profileId: string, minutes: number, day?: DayKey) => void;
  resetProgress: (profileId: string) => void;
  markTourSeen: (profileId: string, tourId: string) => void;
  logSpeechCheck: (profileId: string, check: SpeechCheck) => void;
  saveAssessment: (profileId: string, assessment: Assessment) => void;
  logLetterAttempt: (profileId: string, attempt: LetterAttempt) => void;
  logFocusSample: (profileId: string, sample: FocusSample) => void;
  clearFocusSamples: (profileId: string) => void;
}

const progressOf = (state: AppState, id: string) => state.progress[id] ?? emptyProgress();
const MAX_SPEECH_CHECKS = 300;
const MAX_ASSESSMENTS = 30;
const MAX_LETTER_ATTEMPTS = 300;
/** About 4 hours of activity at one reading every 5 seconds. */
const MAX_FOCUS_SAMPLES = 3000;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /** Applies `fn` to one child's progress. */
      const updateProgress = (id: string, fn: (p: ProgressState) => ProgressState) =>
        set((state) => ({ progress: { ...state.progress, [id]: fn(progressOf(state, id)) } }));

      const planFor = (profile: Profile, progress: ProgressState, day: DayKey, mood?: Mood) =>
        buildDailyPlan(progress, { day, profileId: profile.id, age: profile.age, goal: profile.prefs.dailyGoal, mood });

      return {
        language: 'en',
        setLanguage: (language) => set({ language }),
        profiles: [],
        activeProfileId: null,
        parent: null,
        progress: {},

        setParentPin: async (pin) => {
          const salt = newSalt();
          set({ parent: { salt, pinHash: await hashPin(pin, salt) } });
        },

        verifyParentPin: async (pin) => {
          const parent = get().parent;
          if (!parent) return false;
          return (await hashPin(pin, parent.salt)) === parent.pinHash;
        },

        addProfile: async ({ name, avatar, age }, password) => {
          if (get().profiles.length >= MAX_PROFILES) throw new Error('Profile limit reached');
          if (get().isUsernameTaken(name)) throw new Error('That name is already taken');
          const salt = newSalt();
          const profile: Profile = {
            id: Crypto.randomUUID(),
            name: name.trim(),
            avatar,
            age,
            createdAt: new Date().toISOString(),
            prefs: { ...DEFAULT_PREFS },
            ...(password ? { salt, passwordHash: await hashPin(password, salt) } : {}),
          };
          set((state) => ({
            profiles: [...state.profiles, profile],
            progress: { ...state.progress, [profile.id]: emptyProgress() },
          }));
          return profile.id;
        },

        logIn: async (username, password) => {
          const profile = get().profiles.find((p) => usernameKey(p.name) === usernameKey(username));
          if (!profile) return 'unknown-user';
          if (profile.passwordHash && profile.salt) {
            if ((await hashPin(password, profile.salt)) !== profile.passwordHash) return 'wrong-password';
          }
          set({ activeProfileId: profile.id });
          return 'ok';
        },

        setPassword: async (id, password) => {
          const salt = newSalt();
          const passwordHash = await hashPin(password, salt);
          set((state) => ({ profiles: state.profiles.map((p) => (p.id === id ? { ...p, salt, passwordHash } : p)) }));
        },

        isUsernameTaken: (name, exceptId) =>
          get().profiles.some((p) => p.id !== exceptId && usernameKey(p.name) === usernameKey(name)),

        updateProfile: (id, patch) =>
          set((state) => ({
            profiles: state.profiles.map((p) =>
              p.id === id ? { ...p, ...patch, name: (patch.name ?? p.name).trim() } : p,
            ),
          })),

        updatePrefs: (id, patch) => {
          const before = get().profiles.find((p) => p.id === id);
          set((state) => ({
            profiles: state.profiles.map((p) => (p.id === id ? { ...p, prefs: { ...p.prefs, ...patch } } : p)),
          }));
          // A new daily goal should reshape today's plan if the child hasn't started it.
          if (before && patch.dailyGoal !== undefined && patch.dailyGoal !== before.prefs.dailyGoal) {
            const plan = progressOf(get(), id).plan;
            if (plan && !plan.items.some((i) => i.done)) {
              updateProgress(id, (p) => ({ ...p, plan: null }));
              get().ensurePlan(id);
            }
          }
        },

        deleteProfile: (id) =>
          set((state) => {
            const { [id]: _removed, ...progress } = state.progress;
            return {
              profiles: state.profiles.filter((p) => p.id !== id),
              progress,
              activeProfileId: state.activeProfileId === id ? null : state.activeProfileId,
            };
          }),

        setActiveProfile: (id) => set({ activeProfileId: id }),

        recordSession: (profileId, result) => {
          const day = dayKey();
          const { state, outcome } = applySession(progressOf(get(), profileId), result, {
            id: Crypto.randomUUID(),
            day,
            nowIso: new Date().toISOString(),
          });
          updateProgress(profileId, () => state);
          return outcome;
        },

        ensurePlan: (profileId, day = dayKey()) => {
          const profile = get().profiles.find((p) => p.id === profileId);
          if (!profile) return;
          const progress = progressOf(get(), profileId);
          if (progress.plan?.day === day) return;
          updateProgress(profileId, (p) => ({ ...p, plan: planFor(profile, p, day, p.moods[day]) }));
        },

        setMood: (profileId, mood, day = dayKey()) => {
          const profile = get().profiles.find((p) => p.id === profileId);
          if (!profile) return;
          updateProgress(profileId, (p) => {
            const moods = { ...p.moods, [day]: mood };
            // Re-plan around the child's mood unless they've already started today's plan.
            const untouched = !p.plan || p.plan.day !== day || !p.plan.items.some((i) => i.done);
            const plan = untouched ? planFor(profile, { ...p, moods }, day, mood) : p.plan;
            return { ...p, moods, plan };
          });
        },

        addUsage: (profileId, seconds, day = dayKey()) =>
          updateProgress(profileId, (p) => ({
            ...p,
            usage: pruneHistory({ ...p.usage, [day]: (p.usage[day] ?? 0) + seconds }, addDays(day, -HISTORY_DAYS)),
          })),

        grantBonusMinutes: (profileId, minutes, day = dayKey()) =>
          updateProgress(profileId, (p) => ({
            ...p,
            bonusMinutes: pruneHistory({ ...p.bonusMinutes, [day]: (p.bonusMinutes[day] ?? 0) + minutes }, addDays(day, -7)),
          })),

        resetProgress: (profileId) => updateProgress(profileId, () => emptyProgress()),

        logSpeechCheck: (profileId, check) =>
          updateProgress(profileId, (p) => ({ ...p, speechChecks: [...(p.speechChecks ?? []), check].slice(-MAX_SPEECH_CHECKS) })),

        saveAssessment: (profileId, assessment) =>
          updateProgress(profileId, (p) => ({ ...p, assessments: [...(p.assessments ?? []), assessment].slice(-MAX_ASSESSMENTS) })),

        logLetterAttempt: (profileId, attempt) =>
          updateProgress(profileId, (p) => ({ ...p, writing: [...(p.writing ?? []), attempt].slice(-MAX_LETTER_ATTEMPTS) })),

        logFocusSample: (profileId, sample) =>
          updateProgress(profileId, (p) => ({ ...p, focus: [...(p.focus ?? []), sample].slice(-MAX_FOCUS_SAMPLES) })),

        clearFocusSamples: (profileId) => updateProgress(profileId, (p) => ({ ...p, focus: [] })),

        markTourSeen: (profileId, tourId) =>
          updateProgress(profileId, (p) => ({ ...p, toursSeen: { ...p.toursSeen, [tourId]: true } })),
      };
    },
    {
      name: 'lexileap/app',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ language, profiles, activeProfileId, parent, progress }) => ({ language, profiles, activeProfileId, parent, progress }),
      // Fill in any preference added in a later release so older saves keep working.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...saved,
          profiles: (saved.profiles ?? []).map((p) => ({ ...p, prefs: { ...DEFAULT_PREFS, ...p.prefs } })),
          progress: Object.fromEntries(
            Object.entries(saved.progress ?? {}).map(([id, p]) => [id, { ...emptyProgress(), ...p }]),
          ),
        };
      },
    },
  ),
);

/** True once saved data has been loaded from storage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useAppStore.persist.onFinishHydration(onChange),
    () => useAppStore.persist.hasHydrated(),
  );
}

export function useIsSetUp(): boolean {
  return useAppStore((s) => s.parent !== null && s.profiles.length > 0);
}

export function useActiveProfile(): Profile | null {
  return useAppStore((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? null);
}

export function useProfile(id: string | undefined): Profile | null {
  return useAppStore((s) => s.profiles.find((p) => p.id === id) ?? null);
}

const EMPTY_PROGRESS = emptyProgress();

export function useProgress(profileId: string | null | undefined): ProgressState {
  return useAppStore((s) => (profileId ? s.progress[profileId] : undefined) ?? EMPTY_PROGRESS);
}
