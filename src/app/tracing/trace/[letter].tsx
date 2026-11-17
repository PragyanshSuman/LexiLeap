import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeatureTour, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { FocusTracker } from '@/components/FocusTracker';
import { SeriInfoButton } from '@/components/seri/SeriButtons';
import { BackButton } from '@/ui/BackButton';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useActiveProfile } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AmbientOrbs, GuidedTracer, TRACE_BACKGROUND } from '@/tracing/GuidedTracer';
import { ALPHABET, canvasFor, SMALL_ALPHABET, traceLetterFromParam } from '@/tracing/seriLetters';
import { useTraceRecorder } from '@/tracing/useTraceRecorder';
import { isLowercase } from '@/activities/trace/glyphs';

const TOUR: TourStep[] = [
  { title: 'tracing_tour_guide_title', description: 'tracing_tour_guide_desc' },
  { title: 'tracing_tour_progress_title', description: 'tracing_tour_progress_desc' },
];
/** Height of the letter picker strip above the safe area. */
const STRIP = 58;
const PILL = 38;
const PILL_GAP = 6;

/** The original guided tracer, with the A–Z (or a–z) strip to switch letters. */
export default function GuidedTracingScreen() {
  const params = useLocalSearchParams<{ letter?: string }>();
  const [letter, setLetter] = useState(() => traceLetterFromParam(params.letter));
  // The strip shows the same kind of letters as the one being traced.
  const small = isLowercase(letter);
  const letters = small ? SMALL_ALPHABET : ALPHABET;
  const { colors } = useTheme();
  const { t } = useT();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const profile = useActiveProfile();
  const tour = useFeatureTour('tracing-guided');
  const record = useTraceRecorder(profile?.id);
  const strip = useRef<ScrollViewInstance>(null);
  const dark = colors.isDark;

  // Keep the active letter in view in the strip.
  useEffect(() => {
    const index = letters.indexOf(letter);
    strip.current?.scrollTo({ x: Math.max(0, index * (PILL + PILL_GAP) - width / 2 + PILL), animated: true });
  }, [letter, letters, width]);

  if (!profile) return <Redirect href="/login" />;

  const canvas = canvasFor(width - insets.left - insets.right, height - insets.top - STRIP - insets.bottom);

  return (
    <LinearGradient colors={dark ? TRACE_BACKGROUND.dark : TRACE_BACKGROUND.light} style={styles.bg}>
      <AmbientOrbs width={canvas.width} height={canvas.height} />
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <SeriInfoButton onPress={tour.open} color={DT.accent.indigo} />

        <GuidedTracer letter={letter} canvas={canvas} onTraced={record} />

        <View style={[styles.pickerWrap, dark && styles.pickerWrapDark, { paddingBottom: 10 + insets.bottom }]}>
          <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.pickerScroll, { paddingLeft: 10 + insets.left, paddingRight: 10 + insets.right }]}>
            {letters.map((l) => {
              const active = l === letter;
              return (
                <Pressable
                  key={l}
                  accessibilityRole="button"
                  hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
                  accessibilityLabel={t(small ? 'trace_small_letter_intro' : 'trace_letter_intro', { letter: l })}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    feedback.tap();
                    setLetter(l);
                  }}
                  style={({ pressed }) => [styles.letterPill, dark && styles.letterPillDark, active && styles.letterPillActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.letterPillText, dark && styles.letterPillTextDark, active && styles.letterPillTextActive]}>{l}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
      <BackButton placement="floating" />
      <FocusTracker feature="trace" />
      <FeatureTour visible={tour.visible} steps={TOUR} onClose={tour.close} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1 },
  pickerWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(99,102,241,0.18)',
    shadowColor: '#6366F1',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 10,
  },
  pickerWrapDark: { backgroundColor: 'rgba(17,24,39,0.92)', borderTopColor: 'rgba(129,140,248,0.25)' },
  pickerScroll: { gap: PILL_GAP, flexDirection: 'row', alignItems: 'center' },
  letterPill: {
    width: PILL,
    height: PILL,
    borderRadius: PILL / 2,
    backgroundColor: 'rgba(241,245,249,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(148,163,184,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterPillDark: { backgroundColor: 'rgba(30,41,59,0.9)', borderColor: 'rgba(100,116,139,0.4)' },
  letterPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#818CF8',
    shadowColor: '#6366F1',
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    transform: [{ scale: 1.15 }],
  },
  letterPillText: { fontSize: 15, fontWeight: '800', color: '#334155', fontFamily: Platform.select({ default: 'OpenDyslexic' }) },
  letterPillTextDark: { color: '#CBD5E1' },
  letterPillTextActive: { color: '#FFFFFF' },
  pressed: { opacity: 0.75 },
});
