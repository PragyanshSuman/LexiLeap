import { Text, type TextProps, type TextStyle } from 'react-native';
import { isComplexScript, useLanguage } from '@/i18n';
import type { FontWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

const SIZE: Record<TextVariant, number> = {
  display: 44,
  title: 27,
  heading: 20,
  body: 17,
  label: 15,
  caption: 13,
};

const DEFAULT_WEIGHT: Record<TextVariant, FontWeight> = {
  display: 'bold',
  title: 'bold',
  heading: 'bold',
  body: 'regular',
  label: 'semibold',
  caption: 'regular',
};

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  weight?: FontWeight;
  color?: string;
  muted?: boolean;
  center?: boolean;
  /** Overrides the variant size (still scaled by the child's text size preference). */
  size?: number;
  /**
   * For letters and words inside fixed-size tiles: ignores the text-size preference and the
   * system font scale, so the glyph always fits its tile, with a matching line height.
   */
  fixed?: boolean;
}

/** Text that follows the reader's font, size, spacing and colour preferences. */
export function AppText({ variant = 'body', weight, color, muted, center, size, fixed, style, children, ...rest }: AppTextProps) {
  const theme = useTheme();
  const complexScript = isComplexScript(useLanguage());
  const w = weight ?? DEFAULT_WEIGHT[variant];
  const fontSize = Math.round((size ?? SIZE[variant]) * (fixed ? 1 : theme.textScale));
  // Letter spacing adds trailing space, which would push a lone letter off-centre.
  // Letter spacing would also break the joined letters of Tamil and Devanagari.
  const single = (typeof children === 'string' && children.length === 1) || complexScript;
  const lineFactor = fixed ? 1.3 : complexScript ? Math.max(theme.lineHeight, 1.6) : theme.lineHeight;
  const synthetic = theme.font.syntheticBold && w !== 'regular';
  const typography: TextStyle = {
    fontFamily: theme.font.families[w],
    fontWeight: synthetic ? (w === 'bold' ? '700' : '600') : undefined,
    fontSize,
    lineHeight: Math.round(fontSize * lineFactor),
    letterSpacing: single ? 0 : fontSize * theme.letterSpacing,
    color: color ?? (muted ? theme.colors.textMuted : theme.colors.text),
    textAlign: center ? 'center' : undefined,
  };
  return (
    <Text maxFontSizeMultiplier={1.4} allowFontScaling={!fixed} {...rest} style={[typography, style]}>
      {children}
    </Text>
  );
}
