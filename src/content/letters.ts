export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const UPPERCASE = LOWERCASE.map((l) => l.toUpperCase());

export interface LetterExample {
  letter: string;
  /** A word that starts with the letter's most common sound. */
  word: string;
  emoji: string;
}

/** One picture word per letter. `x` is excluded from first-sound games (x-ray starts with "e"). */
export const LETTER_EXAMPLES: LetterExample[] = [
  { letter: 'a', word: 'apple', emoji: '🍎' },
  { letter: 'b', word: 'ball', emoji: '⚽' },
  { letter: 'c', word: 'cat', emoji: '🐱' },
  { letter: 'd', word: 'dog', emoji: '🐶' },
  { letter: 'e', word: 'egg', emoji: '🥚' },
  { letter: 'f', word: 'fish', emoji: '🐟' },
  { letter: 'g', word: 'goat', emoji: '🐐' },
  { letter: 'h', word: 'hat', emoji: '🎩' },
  { letter: 'i', word: 'insect', emoji: '🐜' },
  { letter: 'j', word: 'jeans', emoji: '👖' },
  { letter: 'k', word: 'key', emoji: '🔑' },
  { letter: 'l', word: 'lion', emoji: '🦁' },
  { letter: 'm', word: 'moon', emoji: '🌙' },
  { letter: 'n', word: 'nose', emoji: '👃' },
  { letter: 'o', word: 'octopus', emoji: '🐙' },
  { letter: 'p', word: 'pig', emoji: '🐷' },
  { letter: 'q', word: 'queen', emoji: '👸' },
  { letter: 'r', word: 'rabbit', emoji: '🐰' },
  { letter: 's', word: 'sun', emoji: '☀️' },
  { letter: 't', word: 'tiger', emoji: '🐯' },
  { letter: 'u', word: 'umbrella', emoji: '☂️' },
  { letter: 'v', word: 'violin', emoji: '🎻' },
  { letter: 'w', word: 'whale', emoji: '🐳' },
  { letter: 'y', word: 'yarn', emoji: '🧶' },
  { letter: 'z', word: 'zebra', emoji: '🦓' },
];

/**
 * Letters that are easy to confuse visually (mirror images, rotations, similar strokes).
 * These are the classic sources of reversal errors for dyslexic readers.
 */
export const LOOKALIKES: Record<string, string[]> = {
  a: ['o', 'e', 'd'],
  b: ['d', 'p', 'q', 'h'],
  c: ['e', 'o'],
  d: ['b', 'q', 'p'],
  e: ['c', 'a'],
  f: ['t', 'l'],
  g: ['q', 'p', 'y'],
  h: ['n', 'b'],
  i: ['j', 'l'],
  j: ['i', 'g'],
  k: ['x', 'h'],
  l: ['i', 't'],
  m: ['n', 'w'],
  n: ['m', 'u', 'h'],
  o: ['c', 'a'],
  p: ['q', 'b', 'd'],
  q: ['p', 'd', 'g'],
  r: ['n', 'v'],
  s: ['z'],
  t: ['f', 'l'],
  u: ['n', 'v'],
  v: ['u', 'y', 'w'],
  w: ['m', 'v'],
  x: ['k', 'z'],
  y: ['v', 'g'],
  z: ['s', 'x'],
};

/** Pairs that are clearly different: used for the gentlest visual level. */
export const EASY_PAIRS: [string, string][] = [
  ['o', 'x'],
  ['a', 't'],
  ['s', 'k'],
  ['e', 'h'],
  ['c', 'm'],
  ['r', 'o'],
  ['z', 'o'],
  ['v', 'c'],
  ['l', 'o'],
  ['x', 'e'],
];

/** Mirror and look-alike pairs: the core of visual discrimination practice. */
export const MIRROR_PAIRS: [string, string][] = [
  ['b', 'd'],
  ['d', 'b'],
  ['p', 'q'],
  ['q', 'p'],
  ['b', 'p'],
  ['d', 'q'],
  ['m', 'n'],
  ['n', 'u'],
  ['m', 'w'],
  ['f', 't'],
  ['i', 'j'],
  ['s', 'z'],
];

/** Word pairs that are easy to reverse or misread. */
export const WORD_PAIRS: [string, string][] = [
  ['was', 'saw'],
  ['on', 'no'],
  ['top', 'pot'],
  ['tap', 'pat'],
  ['bad', 'dad'],
  ['big', 'dig'],
  ['nap', 'pan'],
  ['tub', 'but'],
  ['pit', 'tip'],
  ['bud', 'dub'],
];

export function lookalikesOf(letter: string): string[] {
  return LOOKALIKES[letter.toLowerCase()] ?? [];
}

/**
 * True when `a` and `b` are easy to mix up visually: look-alike letters (b/d), a word and
 * its reversal (was/saw), or same-length words differing only by look-alike letters (bad/dad).
 */
export function areLookalikes(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y || x.length !== y.length) return false;
  if (x.length === 1) return lookalikesOf(x).includes(y);
  if (x.split('').reverse().join('') === y) return true;
  let differences = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] === y[i]) continue;
    if (!lookalikesOf(x[i]).includes(y[i])) return false;
    differences++;
  }
  return differences > 0;
}

/** How the speech engine should say a letter's name. Some voices read a lone "a" as the article. */
export function spokenLetterName(letter: string): string {
  const lower = letter.toLowerCase();
  const names: Record<string, string> = { a: 'ay', e: 'ee', i: 'eye', o: 'oh', u: 'you', y: 'why', z: 'zee' };
  return names[lower] ?? lower.toUpperCase();
}
