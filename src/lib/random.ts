/** A random number source returning floats in [0, 1). Injected so content is testable. */
export type Rng = () => number;

/** Small, fast, seedable PRNG (mulberry32). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (FNV-1a), used to seed per-day randomness. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export const defaultRng: Rng = Math.random;

export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called with an empty list');
  return items[randomInt(rng, items.length)];
}

/** Returns a shuffled copy (Fisher–Yates). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Picks `count` distinct items (or all of them if there are fewer). */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, Math.max(0, count));
}

/**
 * Picks `count` items, cycling through a shuffled list so repeats only happen
 * once every item has been used. Useful for building rounds from small pools.
 */
export function sampleCycling<T>(rng: Rng, items: readonly T[], count: number): T[] {
  if (items.length === 0) return [];
  const out: T[] = [];
  let pool: T[] = [];
  while (out.length < count) {
    if (pool.length === 0) pool = shuffle(rng, items);
    out.push(pool.pop() as T);
  }
  return out;
}
