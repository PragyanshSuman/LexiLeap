import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { LETTER_EXAMPLES } from '@/content/letters';

/** Glossy letter colours, like the original picture tiles: [main, shadow]. */
const COLOURS: [string, string][] = [
  ['#F97316', '#C2410C'],
  ['#EF4444', '#B91C1C'],
  ['#3B82F6', '#1D4ED8'],
  ['#22C55E', '#15803D'],
  ['#A855F7', '#7E22CE'],
  ['#EC4899', '#BE185D'],
  ['#14B8A6', '#0F766E'],
  ['#EAB308', '#A16207'],
];
const DESCENDERS = new Set([...'gjpqy']);

/**
 * A picture tile for a small letter, drawn in the style of the original capital-letter artwork: a
 * sunny sky with clouds and a rainbow, green hills, the letter in big glossy colour, and its picture
 * word (🍎 for a). The original app had artwork only for capitals.
 */
export function SmallLetterTile({ letter, size }: { letter: string; size: number }) {
  const index = letter.charCodeAt(0) - 97;
  const [main, shadow] = COLOURS[((index % COLOURS.length) + COLOURS.length) % COLOURS.length];
  const example = LETTER_EXAMPLES.find((e) => e.letter === letter);
  const baseline = DESCENDERS.has(letter) ? 64 : 76;
  const id = `tile-${letter}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF4D6" />
          <Stop offset="1" stopColor="#F7DFA0" />
        </LinearGradient>
        <LinearGradient id={`${id}-letter`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.45} />
          <Stop offset="0.35" stopColor={main} stopOpacity={1} />
          <Stop offset="1" stopColor={main} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" rx="18" fill={`url(#${id}-sky)`} />
      {/* Rainbow and clouds */}
      <G opacity={0.85} fill="none" strokeWidth={3}>
        <Path d="M 70 52 A 24 24 0 0 1 100 30" stroke="#EF4444" />
        <Path d="M 73 54 A 21 21 0 0 1 100 34" stroke="#F59E0B" />
        <Path d="M 76 56 A 18 18 0 0 1 100 38" stroke="#22C55E" />
        <Path d="M 79 58 A 15 15 0 0 1 100 42" stroke="#3B82F6" />
      </G>
      <G fill="#FFFFFF">
        <Ellipse cx="18" cy="16" rx="9" ry="5" />
        <Ellipse cx="25" cy="13" rx="7" ry="5" />
        <Ellipse cx="78" cy="14" rx="8" ry="4.5" />
        <Ellipse cx="84" cy="11" rx="6" ry="4.5" />
      </G>
      {/* Hills and flowers */}
      <Path d="M 0 78 Q 25 66 50 76 T 100 72 L 100 82 Q 100 100 82 100 L 18 100 Q 0 100 0 82 Z" fill="#7CC45A" />
      <Path d="M 0 88 Q 30 80 60 88 T 100 86 L 100 82 Q 100 100 82 100 L 18 100 Q 0 100 0 82 Z" fill="#9BD86C" />
      <G>
        <Circle cx="60" cy="93" r="2.6" fill="#FFFFFF" />
        <Circle cx="60" cy="93" r="1" fill="#FACC15" />
        <Circle cx="80" cy="91" r="2.6" fill="#FFFFFF" />
        <Circle cx="80" cy="91" r="1" fill="#FACC15" />
      </G>
      {/* The letter: a darker copy behind for depth, then the glossy letter with a soft outline. */}
      <SvgText x="52.5" y={baseline + 3} fontSize="66" fontWeight="900" fontFamily="Lexend_700Bold" textAnchor="middle" fill={shadow}>
        {letter}
      </SvgText>
      <SvgText x="50" y={baseline} fontSize="66" fontWeight="900" fontFamily="Lexend_700Bold" textAnchor="middle" fill={`url(#${id}-letter)`} stroke={shadow} strokeWidth={1.2}>
        {letter}
      </SvgText>
      {example ? (
        <SvgText x="17" y="92" fontSize="17" textAnchor="middle">
          {example.emoji}
        </SvgText>
      ) : null}
    </Svg>
  );
}
