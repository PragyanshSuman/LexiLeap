import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useActiveProfile } from '@/store/appStore';
import { DEFAULT_PREFS, type Prefs } from '@/store/profile';
import { FONTS } from './fonts';
import { PALETTES } from './palettes';
import { useSystemReduceMotion } from './systemMotion';

export interface Theme {
  colors: (typeof PALETTES)[keyof typeof PALETTES];
  prefs: Prefs;
  font: (typeof FONTS)[keyof typeof FONTS];
  /** Extra letter spacing as a fraction of font size. */
  letterSpacing: number;
  /** Line height as a multiple of font size. */
  lineHeight: number;
  textScale: number;
  /** Spacing scale for layout (4-point grid). */
  space: (steps: number) => number;
  radius: { sm: number; md: number; lg: number; pill: number };
}

const LETTER_SPACING = [0, 0.04, 0.08];
const LINE_HEIGHT = [1.35, 1.5, 1.65];

export function buildTheme(prefs: Prefs): Theme {
  return {
    colors: PALETTES[prefs.theme] ?? PALETTES.cream,
    prefs,
    font: FONTS[prefs.font] ?? FONTS.lexend,
    letterSpacing: LETTER_SPACING[prefs.spacing] ?? 0,
    lineHeight: LINE_HEIGHT[prefs.spacing] ?? 1.5,
    textScale: prefs.textScale,
    space: (steps) => steps * 4,
    radius: { sm: 10, md: 16, lg: 24, pill: 999 },
  };
}

/** Lets an area (setup, parent zone) use fixed preferences instead of the active child's. */
const PrefsOverride = createContext<Prefs | null>(null);

export function ThemeScope({ prefs = DEFAULT_PREFS, children }: { prefs?: Prefs; children: ReactNode }) {
  return createElement(PrefsOverride.Provider, { value: prefs }, children);
}

export function useTheme(): Theme {
  const override = useContext(PrefsOverride);
  const profile = useActiveProfile();
  const chosen = override ?? profile?.prefs ?? DEFAULT_PREFS;
  const systemReduceMotion = useSystemReduceMotion();
  return useMemo(
    () => buildTheme(systemReduceMotion && !chosen.reduceMotion ? { ...chosen, reduceMotion: true } : chosen),
    [chosen, systemReduceMotion],
  );
}

/** The active child's preferences (sound, voice, haptics) regardless of any visual override. */
export function useChildPrefs(): Prefs {
  return useActiveProfile()?.prefs ?? DEFAULT_PREFS;
}
