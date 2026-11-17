import { AtkinsonHyperlegible_400Regular } from '@expo-google-fonts/atkinson-hyperlegible/400Regular';
import { AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible/700Bold';
import { Lexend_400Regular } from '@expo-google-fonts/lexend/400Regular';
import { Lexend_600SemiBold } from '@expo-google-fonts/lexend/600SemiBold';
import { Lexend_700Bold } from '@expo-google-fonts/lexend/700Bold';

export type FontChoice = 'lexend' | 'opendyslexic' | 'atkinson' | 'system';
export type FontWeight = 'regular' | 'semibold' | 'bold';

/** Font files loaded at startup (see the root layout). */
export const FONT_ASSETS = {
  Lexend_400Regular,
  Lexend_600SemiBold,
  Lexend_700Bold,
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  OpenDyslexic: require('../../assets/fonts/OpenDyslexic-Regular.otf'),
};

interface FontFamily {
  label: string;
  /** Family names per weight. `undefined` means the platform system font. */
  families: Record<FontWeight, string | undefined>;
  /** OpenDyslexic ships one weight, so bold is synthesised with fontWeight. */
  syntheticBold: boolean;
}

export const FONTS: Record<FontChoice, FontFamily> = {
  lexend: {
    label: 'Lexend',
    families: { regular: 'Lexend_400Regular', semibold: 'Lexend_600SemiBold', bold: 'Lexend_700Bold' },
    syntheticBold: false,
  },
  opendyslexic: {
    label: 'OpenDyslexic',
    families: { regular: 'OpenDyslexic', semibold: 'OpenDyslexic', bold: 'OpenDyslexic' },
    syntheticBold: true,
  },
  atkinson: {
    label: 'Atkinson',
    families: {
      regular: 'AtkinsonHyperlegible_400Regular',
      semibold: 'AtkinsonHyperlegible_700Bold',
      bold: 'AtkinsonHyperlegible_700Bold',
    },
    syntheticBold: false,
  },
  system: {
    label: 'System',
    families: { regular: undefined, semibold: undefined, bold: undefined },
    syntheticBold: true,
  },
};

export const FONT_ORDER: FontChoice[] = ['lexend', 'opendyslexic', 'atkinson', 'system'];
