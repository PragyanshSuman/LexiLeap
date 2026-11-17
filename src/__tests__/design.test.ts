import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { ACTIVITIES } from '@/engine/catalog';
import { accentGradient, accentOn, contrastRatio, readableOn } from '@/theme/color';
import { DT } from '@/theme/dyslexiaTheme';
import { PALETTES } from '@/theme/palettes';
import { CLASSIC_GRADIENT } from '@/ui/Button';

/** Checks for the rules in docs/DESIGN.md, so new screens can't quietly drift from them. */

const SRC = join(__dirname, '..');
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}
const files = sources(SRC).map((path) => ({ path: relative(SRC, path).replace(/\\/g, '/'), text: readFileSync(path, 'utf8') }));

describe('design rules', () => {
  it('never shows whole words in capitals', () => {
    const offenders = files.filter((f) => /toUpperCase\(\)|textTransform:\s*'uppercase'/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('takes text colours from the theme in child screens (so every theme, including dark, works)', () => {
    // Sign-in screens run before a child is chosen, always in the classic theme.
    const allowed = [
      'app/login.tsx',
      'app/register.tsx',
      'components/AuthShell.tsx',
      // Letter tracing and Letter Mastery recreate the original app's screens exactly (see docs/ROADMAP.md).
      // They keep the original light surfaces in every theme, so their fixed text colours stay readable.
      'app/tracing/index.tsx',
      'app/tracing/letters.tsx',
      'app/mastery/index.tsx',
      'app/parent/mastery/[childId].tsx',
      'app/parent/mastery/session/[id].tsx',
      'writing/MasteryMeasures.tsx',
      'app/mastery/write/[letter].tsx',
      'writing/Charts.tsx',
      'writing/LetterStrip.tsx',
    ];
    const offenders = files.filter((f) => !allowed.includes(f.path) && /DT\.text\./.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('uses the one standard back button, at the same spot, on every screen', () => {
    // No screen draws its own back arrow or close button; they all use ui/BackButton.
    const offenders = files.filter((f) => f.path !== 'ui/BackButton.tsx' && /<IconButton[^>]*icon="(chevron-back|close)"|SeriBackButton/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("gives the side menu a fixed width (a percentage pushes a tablet's whole screen away)", () => {
    const layout = files.find((f) => f.path === 'app/(child)/_layout.tsx')!;
    expect(layout.text).not.toMatch(/drawerStyle:\s*\{[^}]*width:\s*'\d+%'/);
    expect(layout.text).toMatch(/drawerStyle:\s*\{\s*width:\s*drawerWidth/);
  });

  it('builds buttons only with the shared Button (no one-off gradients)', () => {
    const offenders = files.filter((f) => /<Button[^>]*\bgradient=/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  const accents = [
    ...Object.values(ACTIVITIES).map((a) => a.color),
    ...Object.values(DT.accent),
    ...Object.values(PALETTES).map((p) => p.primary),
    '#1E3A5F',
    '#5B21B6',
    '#6366F1',
    '#059669',
  ];

  it('gives every accent colour readable button text (WCAG AA, 4.5:1)', () => {
    for (const accent of accents) {
      const [from, to] = accentGradient(accent);
      const text = readableOn(from);
      expect({ accent, ratio: Math.min(contrastRatio(text, from), contrastRatio(text, to)) >= 4.5 }).toEqual({ accent, ratio: true });
    }
    const classicText = readableOn(CLASSIC_GRADIENT[0]);
    expect(Math.min(...CLASSIC_GRADIENT.map((c) => contrastRatio(classicText, c)))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps accent-coloured text and outlines readable in every theme', () => {
    for (const palette of Object.values(PALETTES)) {
      for (const background of [palette.bg, palette.surface]) {
        for (const accent of accents) {
          expect({ theme: palette.name, accent, ok: contrastRatio(accentOn(accent, background), background) >= 4.5 }).toEqual({ theme: palette.name, accent, ok: true });
        }
      }
    }
  });
});
