/**
 * Phonemes (CMU ARPAbet) and the pure logic built on them: kid-friendly sound names,
 * aligning what a child said with the target word, splitting a spelling into the letter
 * groups that make each sound, and a rule-based fallback for words not in the dictionary.
 */

export interface PhonemeInfo {
  /** How the sound is written for children, e.g. "sh". */
  sound: string;
  /** A word where the sound is easy to hear. */
  example: string;
  vowel: boolean;
}

export const PHONEMES: Record<string, PhonemeInfo> = {
  AA: { sound: 'ah', example: 'car', vowel: true },
  AE: { sound: 'a', example: 'cat', vowel: true },
  AH: { sound: 'uh', example: 'cup', vowel: true },
  AO: { sound: 'aw', example: 'saw', vowel: true },
  AW: { sound: 'ow', example: 'cow', vowel: true },
  AY: { sound: 'eye', example: 'kite', vowel: true },
  EH: { sound: 'e', example: 'bed', vowel: true },
  ER: { sound: 'er', example: 'her', vowel: true },
  EY: { sound: 'ay', example: 'cake', vowel: true },
  IH: { sound: 'i', example: 'pig', vowel: true },
  IY: { sound: 'ee', example: 'bee', vowel: true },
  OW: { sound: 'oh', example: 'boat', vowel: true },
  OY: { sound: 'oy', example: 'boy', vowel: true },
  UH: { sound: 'oo', example: 'book', vowel: true },
  UW: { sound: 'oo', example: 'moon', vowel: true },
  B: { sound: 'b', example: 'bat', vowel: false },
  CH: { sound: 'ch', example: 'chip', vowel: false },
  D: { sound: 'd', example: 'dog', vowel: false },
  DH: { sound: 'th', example: 'this', vowel: false },
  F: { sound: 'f', example: 'fish', vowel: false },
  G: { sound: 'g', example: 'goat', vowel: false },
  HH: { sound: 'h', example: 'hat', vowel: false },
  JH: { sound: 'j', example: 'jam', vowel: false },
  K: { sound: 'k', example: 'kite', vowel: false },
  L: { sound: 'l', example: 'lion', vowel: false },
  M: { sound: 'm', example: 'moon', vowel: false },
  N: { sound: 'n', example: 'nose', vowel: false },
  NG: { sound: 'ng', example: 'ring', vowel: false },
  P: { sound: 'p', example: 'pig', vowel: false },
  R: { sound: 'r', example: 'rabbit', vowel: false },
  S: { sound: 's', example: 'sun', vowel: false },
  SH: { sound: 'sh', example: 'ship', vowel: false },
  T: { sound: 't', example: 'tiger', vowel: false },
  TH: { sound: 'th', example: 'three', vowel: false },
  V: { sound: 'v', example: 'van', vowel: false },
  W: { sound: 'w', example: 'whale', vowel: false },
  Y: { sound: 'y', example: 'yarn', vowel: false },
  Z: { sound: 'z', example: 'zebra', vowel: false },
  ZH: { sound: 'zh', example: 'treasure', vowel: false },
};

export function soundOf(phoneme: string): PhonemeInfo {
  return PHONEMES[phoneme] ?? { sound: phoneme.toLowerCase(), example: '', vowel: false };
}

// ── Alignment: what the child said vs. the word ─────────────────────────────

export type SoundStatus = 'correct' | 'missed' | 'changed';

export interface AlignedSound {
  phoneme: string;
  status: SoundStatus;
  /** For 'changed': the sound that was said instead. */
  heard?: string;
}

export interface Alignment {
  sounds: AlignedSound[];
  /** Sounds said that aren't in the word. */
  extra: string[];
  /** 0–1 similarity of the two sound sequences. */
  score: number;
}

/** Edit-distance alignment of two phoneme sequences, with a per-sound verdict for the target. */
export function alignPhonemes(target: string[], heard: string[]): Alignment {
  const n = target.length;
  const m = heard.length;
  const cost: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = target[i - 1] === heard[j - 1] ? 0 : 1;
      cost[i][j] = Math.min(cost[i - 1][j - 1] + same, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }
  const sounds: AlignedSound[] = [];
  const extra: string[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + (target[i - 1] === heard[j - 1] ? 0 : 1)) {
      sounds.unshift(target[i - 1] === heard[j - 1] ? { phoneme: target[i - 1], status: 'correct' } : { phoneme: target[i - 1], status: 'changed', heard: heard[j - 1] });
      i--;
      j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      sounds.unshift({ phoneme: target[i - 1], status: 'missed' });
      i--;
    } else {
      extra.unshift(heard[j - 1]);
      j--;
    }
  }
  const longest = Math.max(n, m);
  return { sounds, extra, score: longest === 0 ? 1 : 1 - cost[n][m] / longest };
}

// ── Spelling ↔ sounds ───────────────────────────────────────────────────────

/** Letter groups and the sound sequences they commonly spell. `[]` means silent. */
const GRAPHEMES: Record<string, string[][]> = {
  tion: [['SH', 'AH', 'N']],
  igh: [['AY']],
  tch: [['CH']],
  dge: [['JH']],
  air: [['EH', 'R']],
  ear: [['IH', 'R'], ['ER'], ['EH', 'R']],
  sh: [['SH']],
  ch: [['CH'], ['K'], ['SH']],
  th: [['TH'], ['DH']],
  ph: [['F']],
  wh: [['W'], ['HH']],
  ng: [['NG'], ['NG', 'G']],
  ck: [['K']],
  qu: [['K', 'W']],
  kn: [['N']],
  wr: [['R']],
  gh: [[], ['F'], ['G']],
  mb: [['M']],
  le: [['AH', 'L'], ['L']],
  ai: [['EY']],
  ay: [['EY']],
  ee: [['IY']],
  ea: [['IY'], ['EH'], ['EY']],
  ie: [['AY'], ['IY']],
  oa: [['OW']],
  oe: [['OW'], ['UW']],
  ow: [['OW'], ['AW']],
  oo: [['UW'], ['UH']],
  ou: [['AW'], ['UW'], ['AH'], ['OW']],
  oi: [['OY']],
  oy: [['OY']],
  au: [['AO'], ['AA']],
  aw: [['AO'], ['AA']],
  ew: [['UW'], ['Y', 'UW']],
  ue: [['UW'], ['Y', 'UW']],
  ar: [['AA', 'R']],
  er: [['ER']],
  ir: [['ER']],
  ur: [['ER']],
  or: [['AO', 'R'], ['ER']],
  a: [['AE'], ['EY'], ['AH'], ['AA'], ['AO']],
  e: [['EH'], ['IY'], ['AH'], []],
  i: [['IH'], ['AY'], ['IY'], ['AH']],
  o: [['AA'], ['OW'], ['AH'], ['UW'], ['AO']],
  u: [['AH'], ['UW'], ['UH'], ['Y', 'UW']],
  y: [['IY'], ['AY'], ['Y'], ['IH']],
  b: [['B']],
  c: [['K'], ['S']],
  d: [['D'], ['T']],
  f: [['F']],
  g: [['G'], ['JH']],
  h: [['HH'], []],
  j: [['JH']],
  k: [['K'], []],
  l: [['L']],
  m: [['M']],
  n: [['N'], ['NG']],
  p: [['P']],
  q: [['K']],
  r: [['R']],
  s: [['S'], ['Z'], ['SH']],
  t: [['T'], ['SH']],
  v: [['V']],
  w: [['W'], []],
  x: [['K', 'S'], ['Z']],
  z: [['Z']],
};
const MAX_GRAPHEME = 4;

export interface SpellingChunk {
  letters: string;
  phonemes: string[];
}

/**
 * Splits a spelling into the letter groups that make each sound, e.g.
 * night + N AY T → n · igh · t. Doubled letters (ll, ss) join into one group.
 * Returns null when the spelling can't be explained by the table.
 */
export function spellingChunks(word: string, phonemes: string[]): SpellingChunk[] | null {
  const w = word.toLowerCase();
  const memo = new Map<string, { cost: number; chunks: SpellingChunk[] } | null>();
  const solve = (i: number, j: number): { cost: number; chunks: SpellingChunk[] } | null => {
    if (i === w.length) return j === phonemes.length ? { cost: 0, chunks: [] } : null;
    const key = `${i}:${j}`;
    if (memo.has(key)) return memo.get(key)!;
    let best: { cost: number; chunks: SpellingChunk[] } | null = null;
    for (let len = Math.min(MAX_GRAPHEME, w.length - i); len >= 1; len--) {
      const letters = w.slice(i, i + len);
      const options = [...(GRAPHEMES[letters] ?? [])];
      // A doubled consonant (ll, ss, tt…) spells the sound of the single letter.
      if (len === 2 && letters[0] === letters[1] && GRAPHEMES[letters[0]]) options.push(...GRAPHEMES[letters[0]].filter((o) => o.length > 0));
      for (const option of options) {
        if (option.some((p, k) => phonemes[j + k] !== p)) continue;
        const rest = solve(i + len, j + option.length);
        if (!rest) continue;
        // Prefer fewer, longer groups; silent letters are a last resort.
        const cost = rest.cost + (option.length === 0 ? 3 : 1);
        if (!best || cost < best.cost) {
          const chunks = [...rest.chunks];
          if (option.length === 0 && chunks.length > 0) {
            // Attach silent letters to the following group so the display stays readable.
            chunks[0] = { letters: letters + chunks[0].letters, phonemes: chunks[0].phonemes };
          } else if (option.length === 0) {
            chunks.unshift({ letters, phonemes: [] });
          } else {
            chunks.unshift({ letters, phonemes: option });
          }
          best = { cost, chunks };
        }
      }
    }
    memo.set(key, best);
    return best;
  };
  const result = solve(0, 0)?.chunks ?? null;
  // A trailing silent e (magic e) belongs with the group before it.
  if (result && result.length > 1 && result[result.length - 1].phonemes.length === 0) {
    const last = result.pop()!;
    result[result.length - 1] = { ...result[result.length - 1], letters: result[result.length - 1].letters + last.letters };
  }
  return result;
}

const LONG_VOWEL: Record<string, string> = { a: 'EY', e: 'IY', i: 'AY', o: 'OW', u: 'UW' };

/**
 * Best-guess pronunciation for words the dictionary doesn't know, using the most common
 * sound of each letter group and the magic-e rule (cake, kite, home).
 */
export function ruleBasedPhonemes(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const magicE = /[aeiou][^aeiou]e$/.test(w) && w.length > 2;
  const phonemes: string[] = [];
  let i = 0;
  while (i < w.length) {
    if (magicE && i === w.length - 1) break;
    let matched = false;
    for (let len = Math.min(MAX_GRAPHEME, w.length - i); len >= 1; len--) {
      const letters = w.slice(i, i + len);
      const options = GRAPHEMES[letters];
      if (!options) continue;
      const isMagicVowel = magicE && len === 1 && i === w.length - 3 && LONG_VOWEL[letters];
      phonemes.push(...(isMagicVowel ? [LONG_VOWEL[letters]] : options[0]));
      i += len;
      matched = true;
      break;
    }
    if (!matched) i++;
  }
  // Collapse doubled consonant sounds (ll → L, not L L).
  return phonemes.filter((p, k) => k === 0 || p !== phonemes[k - 1] || PHONEMES[p]?.vowel);
}
