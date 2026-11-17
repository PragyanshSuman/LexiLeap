import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';

/** The original's frosted glass speaker orb: says "Letter B" when tapped. */
export function AudioOrb({ letter, size = 52, color }: { letter: string; size?: number; color: string }) {
  const { t } = useT();
  const { prefs } = useTheme();
  const feedback = useFeedback();
  const [playing, setPlaying] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setPlaying(false), 2500);
    return () => clearTimeout(timer);
  }, [playing]);

  const press = () => {
    if (playing) return;
    setPlaying(true);
    if (!prefs.reduceMotion) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
    feedback.say('trace_letter_intro', { letter });
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('write_replay')} onPress={press} hitSlop={6}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="orbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.6} />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.2} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.5} />
            </LinearGradient>
            <RadialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {playing ? <Circle cx="50" cy="50" r="48" fill="url(#orbGlow)" /> : null}
          <Circle cx="50" cy="50" r="42" fill="url(#orbGrad)" stroke="white" strokeWidth="1.5" strokeOpacity={0.6} />
          <Path d="M32 42h10l13-11v38l-13-11h-10v-16z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
          <Path d="M65 40c3 3 3 17 0 20" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity={playing ? 1 : 0.8} fill="none" />
          <Path d="M74 34c5 5.5 5 26.5 0 32" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity={playing ? 0.9 : 0.4} fill="none" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

/** The original circular progress indicator. `progress` is 0–1. */
export function ProgressRing({ progress, size, color, track = '#E5E7EB' }: { progress: number; size: number; color: string; track?: string }) {
  const stroke = Math.max(3, Math.round(size / 9));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}

export const writingStyles = StyleSheet.create({
  controlOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 69, 58, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
});
