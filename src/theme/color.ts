/** Blends two #RRGGBB colours; `amount` 0 gives `from`, 1 gives `to`. */
export function mix(from: string, to: string, amount: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = parse(from);
  const b = parse(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text on coloured controls: warm off-white or near-black, never pure white or black. */
const LIGHT_TEXT = '#FFFCF7';
const DARK_TEXT = '#1C2026';

/** Whichever of the two text colours reads better on `background`. */
export function readableOn(background: string): string {
  return contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/** WCAG AA for normal text. */
const MIN_CONTRAST = 4.5;

/**
 * The two-tone gradient every filled control uses, from one accent colour. If the accent is too light
 * (or too dark) for its text to reach WCAG AA, it is nudged darker (or lighter) until it does.
 */
export function accentGradient(color: string): [string, string] {
  const text = readableOn(color);
  const towards = text === LIGHT_TEXT ? '#000000' : '#FFFFFF';
  let base = color;
  for (let step = 1; contrastRatio(base, text) < MIN_CONTRAST && step <= 10; step++) base = mix(color, towards, step * 0.06);
  // The second stop is a little deeper, so the text keeps (at least) the same contrast across the gradient.
  return [base, mix(base, towards, 0.12)];
}

/**
 * An accent colour used as text or an outline on `background`: nudged darker (light backgrounds) or
 * lighter (dark backgrounds) until it reaches WCAG AA, so gold or navy stays readable in every theme.
 */
export function accentOn(color: string, background: string): string {
  const towards = readableOn(background) === DARK_TEXT ? '#000000' : '#FFFFFF';
  let result = color;
  for (let step = 1; contrastRatio(result, background) < MIN_CONTRAST && step <= 16; step++) result = mix(color, towards, step * 0.06);
  return result;
}
