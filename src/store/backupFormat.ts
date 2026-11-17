import { emptyProgress } from '@/engine/progress';
import type { ProgressState } from '@/engine/types';
import { DEFAULT_PREFS, MAX_PROFILES, type Profile } from './profile';

export const BACKUP_APP = 'lexileap';
export const BACKUP_VERSION = 1;

export interface BackupData {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  profiles: Profile[];
  progress: Record<string, ProgressState>;
}

/**
 * The parent PIN is deliberately not included: a restored backup keeps the PIN of the
 * device it is restored on.
 */
export function createBackupData(profiles: Profile[], progress: Record<string, ProgressState>, now = new Date()): BackupData {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), profiles, progress };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Parses and sanitises a backup file. Throws an Error with a parent-friendly message if
 * the file isn't a LexiLeap backup. Missing fields from older versions are filled in.
 */
export function parseBackup(text: string): { profiles: Profile[]; progress: Record<string, ProgressState> } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a LexiLeap backup.");
  }
  if (!isObject(data) || data.app !== BACKUP_APP || !Array.isArray(data.profiles)) {
    throw new Error("This file isn't a LexiLeap backup.");
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of LexiLeap. Please update the app first.');
  }

  const savedProgress = isObject(data.progress) ? data.progress : {};
  const profiles: Profile[] = [];
  const progress: Record<string, ProgressState> = {};
  for (const raw of data.profiles.slice(0, MAX_PROFILES)) {
    if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string' || !raw.name.trim()) continue;
    if (profiles.some((p) => p.id === raw.id)) continue;
    profiles.push({
      id: raw.id,
      name: raw.name.trim(),
      avatar: typeof raw.avatar === 'string' ? raw.avatar : '🦊',
      age: typeof raw.age === 'number' ? raw.age : 6,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      prefs: { ...DEFAULT_PREFS, ...(isObject(raw.prefs) ? raw.prefs : {}) },
    });
    const p = savedProgress[raw.id];
    progress[raw.id] = { ...emptyProgress(), ...(isObject(p) ? (p as Partial<ProgressState>) : {}) };
  }
  if (profiles.length === 0) throw new Error('This backup has no children in it.');
  return { profiles, progress };
}
