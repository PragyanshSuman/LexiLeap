/** A local calendar day in the form YYYY-MM-DD. */
export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(date: Date = new Date()): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). DST-safe. */
export function daysBetween(from: DayKey, to: DayKey): number {
  const a = parseDayKey(from);
  const b = parseDayKey(to);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/** The last `count` day keys ending today (oldest first). */
export function lastDays(count: number, today: DayKey = dayKey()): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatDay(key: DayKey): string {
  return parseDayKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
