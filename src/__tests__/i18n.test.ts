import { ACTIVITY_ORDER, SKILL_ORDER } from '@/engine/catalog';
import { BADGES } from '@/engine/badges';
import { activityKey, badgeKey, levelKey, skillKey, translate, type Language } from '@/i18n';
import { en, type TranslationKey } from '@/i18n/en';
import { hi } from '@/i18n/hi';
import { ta } from '@/i18n/ta';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const keys = Object.keys(en) as TranslationKey[];

describe.each([
  ['ta', ta],
  ['hi', hi],
] as const)('%s translations', (_code, dictionary) => {
  it('translates every key with the same placeholders as English', () => {
    for (const key of keys) {
      expect(dictionary[key]?.trim().length).toBeGreaterThan(0);
      expect([key, placeholders(dictionary[key])]).toEqual([key, placeholders(en[key])]);
    }
  });

  it('has no extra keys that English lacks', () => {
    expect(Object.keys(dictionary).sort()).toEqual([...keys].sort());
  });
});

describe('translate', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('en', 'home_greeting', { name: 'Ada' })).toBe('Hello, Ada! Ready to learn?');
    expect(translate('hi', 'of', { a: 2, b: 5 })).toBe('5 में से 2');
    expect(translate('en', 'of', { a: 1 })).toBe('1 of {b}');
  });

  it('has text for every activity, level, skill and badge in every language', () => {
    const needed: TranslationKey[] = [
      ...ACTIVITY_ORDER.flatMap((id) => [
        activityKey(id, 'title'),
        activityKey(id, 'tagline'),
        activityKey(id, 'instructions'),
        levelKey(id, 1),
        levelKey(id, 2),
        levelKey(id, 3),
      ]),
      ...SKILL_ORDER.map(skillKey),
      ...BADGES.flatMap((b) => [badgeKey(b.id, 'title'), badgeKey(b.id, 'desc')]),
    ];
    for (const language of ['en', 'ta', 'hi'] as Language[]) {
      for (const key of needed) expect([key, typeof translate(language, key)]).toEqual([key, 'string']);
      for (const key of needed) expect(en[key]).toBeDefined();
    }
  });
});
