/**
 * Colour themes. All avoid pure white and pure black (which cause glare and visual
 * stress for many dyslexic readers) while keeping body text above WCAG AA contrast.
 */
export type ThemeName = 'cream' | 'mint' | 'sky' | 'dusk';

export interface Palette {
  name: ThemeName;
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  star: string;
  guide: string;
  ink: string;
  shadow: string;
}

const shared = {
  star: '#F2B705',
};

export const PALETTES: Record<ThemeName, Palette> = {
  // The original UnifiedLearningApp palette (DyslexiaTheme): warm cream, muted indigo accents.
  cream: {
    ...shared,
    name: 'cream',
    isDark: false,
    bg: '#FAF6F0',
    surface: '#FFFCF7',
    surfaceAlt: '#F5EFE4',
    border: '#E8DDD0',
    text: '#2C2417',
    textMuted: '#5C4F3A',
    primary: '#5B6EC8',
    onPrimary: '#FFFCF7',
    primarySoft: '#F3F1FA',
    success: '#2E7D32',
    successSoft: '#F0F7F0',
    danger: '#B03A2E',
    dangerSoft: '#FDF1F4',
    warning: '#C17D2A',
    warningSoft: '#FEFCE8',
    guide: '#E0D6C6',
    ink: '#3B7CB5',
    shadow: '#2C2417',
  },
  mint: {
    ...shared,
    name: 'mint',
    isDark: false,
    bg: '#EEF7F0',
    surface: '#F8FCF8',
    surfaceAlt: '#E0EFE4',
    border: '#C9E0CF',
    text: '#1F2E24',
    textMuted: '#4E6656',
    primary: '#2C6E8F',
    onPrimary: '#F8FCF8',
    primarySoft: '#D6E7F0',
    success: '#2E7D4F',
    successSoft: '#D4EEDD',
    danger: '#B4533A',
    dangerSoft: '#F5DED6',
    warning: '#97650F',
    warningSoft: '#F3E7C6',
    guide: '#C3D9C9',
    ink: '#7A4FA0',
    shadow: '#1F2E24',
  },
  sky: {
    ...shared,
    name: 'sky',
    isDark: false,
    bg: '#EDF3FA',
    surface: '#F8FBFE',
    surfaceAlt: '#DFE9F5',
    border: '#C7D6E8',
    text: '#1E2838',
    textMuted: '#4C5C72',
    primary: '#2F5DA8',
    onPrimary: '#F8FBFE',
    primarySoft: '#D9E4F5',
    success: '#2E7D4F',
    successSoft: '#D9EFE1',
    danger: '#B04A3E',
    dangerSoft: '#F5DDD9',
    warning: '#9A6610',
    warningSoft: '#F3E7C8',
    guide: '#C5D3E4',
    ink: '#C0692F',
    shadow: '#1E2838',
  },
  dusk: {
    ...shared,
    name: 'dusk',
    isDark: true,
    bg: '#22252E',
    surface: '#2C303B',
    surfaceAlt: '#363B48',
    border: '#454B5B',
    text: '#EDE6D6',
    textMuted: '#B3AC9D',
    primary: '#6CC4B4',
    onPrimary: '#1C2026',
    primarySoft: '#2F4A47',
    success: '#7CCB98',
    successSoft: '#2E4436',
    danger: '#E79A84',
    dangerSoft: '#4A3430',
    warning: '#E8C06B',
    warningSoft: '#4A4130',
    guide: '#4B5163',
    ink: '#8EC1F0',
    shadow: '#000000',
  },
};

export type OverlayName = 'none' | 'rose' | 'peach' | 'lemon' | 'mint' | 'aqua' | 'lilac';

/** Coloured overlays: some readers find a tint reduces visual stress. */
export const OVERLAYS: Record<OverlayName, { color: string | null }> = {
  none: { color: null },
  rose: { color: '#F4A6B8' },
  peach: { color: '#FFC48C' },
  lemon: { color: '#FFE66B' },
  mint: { color: '#94E0B5' },
  aqua: { color: '#8CD3EA' },
  lilac: { color: '#C3AEF0' },
};

export const OVERLAY_OPACITY = 0.22;
