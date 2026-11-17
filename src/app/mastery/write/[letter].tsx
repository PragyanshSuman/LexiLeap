import { Redirect, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { FeatureTour, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { FocusTracker } from '@/components/FocusTracker';
import { SeriInfoButton } from '@/components/seri/SeriButtons';
import { BackButton } from '@/ui/BackButton';
import type { LetterAttempt } from '@/engine/types';
import { checkLetter, type LetterCheck } from '@/handwriting/recognize';
import { useT, type TranslationKey } from '@/i18n';
import { dayKey } from '@/lib/date';
import { useFeedback } from '@/services/feedback';
import { useHandwritingModel } from '@/services/handwritingModel';
import { useActiveProfile, useAppStore } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { AppText } from '@/ui/AppText';
import { goBackOr } from '@/ui/Header';
import { ALL_ORIENTATIONS } from '@/ui/orientations';
import { FeatureExtractor } from '@/writing/featureExtractor';
import { generateIdealPath } from '@/writing/geometry';
import { ALPHABET, LETTER_PATHS } from '@/writing/letterPaths';
import type { MLFeatures, ReversalType, SessionFeatureSummary } from '@/writing/types';
import { WritingCanvas } from '@/writing/WritingCanvas';
import { AudioOrb, writingStyles } from '@/writing/WritingParts';
import { LetterStrip } from '@/writing/LetterStrip';
import { letterFromParam } from '@/tracing/seriLetters';

const TOUR: TourStep[] = [{ title: 'mastery_write_tour_title', description: 'mastery_write_tour_desc' }];
const REVERSAL_TYPE: Record<NonNullable<LetterCheck['reversal']>, ReversalType> = { mirrored: 'horizontal_flip', 'upside-down': 'vertical_flip', rotated: 'rotation_180' };

/** The original Letter Mastery writing screen, with the A–Z strip to switch letters. */
export default function MasteryWriteScreen() {
  const params = useLocalSearchParams<{ letter?: string }>();
  const [letter, setLetter] = useState(() => letterFromParam(params.letter, LETTER_PATHS));
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();
  const profile = useActiveProfile();
  if (!profile) return <Redirect href="/login" />;

  return (
    <View style={styles.container}>
      <MasteryWriter
        key={`${letter}-${attempt}`}
        letter={letter}
        profileId={profile.id}
        bottomInset={STRIP_HEIGHT + insets.bottom}
        onBusyChange={setBusy}
        onRetry={() => setAttempt((a) => a + 1)}
        onNext={() => setLetter(ALPHABET[(ALPHABET.indexOf(letter) + 1) % ALPHABET.length])}
      />
      <LetterStrip letters={ALPHABET} active={letter} onSelect={setLetter} disabled={busy} />
    </View>
  );
}

const STRIP_HEIGHT = 58;

function MasteryWriter({ letter, profileId, bottomInset, onBusyChange, onRetry, onNext }: { letter: string; profileId: string; bottomInset: number; onBusyChange: (busy: boolean) => void; onRetry: () => void; onNext: () => void }) {
  const { t } = useT();
  const feedback = useFeedback();
  const navigation = useNavigation();
  const model = useHandwritingModel();
  const logMastery = useAppStore((s) => s.logMastery);
  const tour = useFeatureTour('mastery-write');
  const letterPath = LETTER_PATHS[letter];
  const [idealPath] = useState(() => generateIdealPath(letterPath.strokes, 30));
  const extractorRef = useRef<FeatureExtractor | null>(null);
  /** Every touch point goes here; a fresh one after "clear". */
  const extractor = () => (extractorRef.current ??= new FeatureExtractor(letterPath, idealPath));
  const [hasInk, setHasInk] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<SessionFeatureSummary | null>(null);
  const [demo, setDemo] = useState(false);
  const [hint, setHint] = useState<TranslationKey | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    onBusyChange(checking);
  }, [checking, onBusyChange]);

  // Swiping back or the hardware back button with unsaved writing asks first, as the original did.
  usePreventRemove(hasInk && !report && !checking, ({ data }) => {
    Alert.alert(t('mastery_exit_title'), t('mastery_exit_body'), [
      { text: t('keep_playing'), style: 'cancel' },
      { text: t('leave'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const clear = () => {
    feedback.tap();
    extractorRef.current = null;
    setHasInk(false);
    setHint(null);
    startedAt.current = null;
    setResetKey((k) => k + 1);
  };

  const finish = () => {
    if (checking) return;
    if (!extractor().hasInk) {
      setHint('mastery_write_first');
      feedback.say('mastery_write_first');
      return;
    }
    if (model.status === 'loading') {
      setHint('write_loading');
      return;
    }
    setChecking(true);
    // Let the spinner draw before the (synchronous) handwriting model runs.
    setTimeout(() => {
      const strokes = extractor().drawnStrokes;
      const check = model.status === 'ready' ? checkLetter(model.model, strokes, letter) : null;
      const ml: MLFeatures = check
        ? {
            predictedChar: check.read,
            expectedChar: letter,
            isCorrect: check.correct,
            confidence: check.confidence,
            topPredictions: check.guesses.slice(0, 3).map((g) => ({ char: g.letter, score: g.probability })),
            reversalDetected: check.reversal !== null,
            reversalType: check.reversal ? REVERSAL_TYPE[check.reversal] : undefined,
            reversalConfidence: check.reversalConfidence,
            analysisTimestamp: new Date().toISOString(),
          }
        : { predictedChar: '?', expectedChar: letter, isCorrect: false, confidence: 0, topPredictions: [], reversalDetected: false, analysisTimestamp: new Date().toISOString() };
      const summary = extractor().summarize(Crypto.randomUUID(), ml);
      const seconds = startedAt.current ? (Date.now() - startedAt.current) / 1000 : summary.overview.completionTime / 1000;
      const attempt: LetterAttempt = {
        letter,
        read: ml.predictedChar,
        correct: ml.isCorrect,
        confidence: ml.confidence,
        reversal: check?.reversal ?? null,
        seconds: Math.round(seconds * 10) / 10,
        day: dayKey(),
      };
      logMastery(profileId, summary, attempt);
      setChecking(false);
      setReport(summary);
      if (ml.isCorrect) feedback.correct();
      else feedback.tryAgain();
    }, 40);
  };

  const exit = () => goBackOr('/mastery');
  const canvas = area.width > 0 ? { width: Math.min(area.width - 24, 900), height: Math.min(area.height, 1200) } : null;

  return (
    <View style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.header} />
        {report ? (
          <ChildResult report={report} bottomInset={bottomInset} onRetry={onRetry} onNext={onNext} onDone={exit} />
        ) : (
          <View style={[styles.canvasContainer, { paddingBottom: bottomInset + 12 }]}>
            <View testID="mastery-canvas-area" style={styles.canvasArea} onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
              {canvas ? (
                <View style={[styles.canvasWrapper, canvas]}>
                  <WritingCanvas
                    key={resetKey}
                    idealPath={idealPath}
                    width={canvas.width}
                    height={canvas.height}
                    disabled={checking}
                    accessibilityLabel={t('mastery_canvas_label', { letter })}
                    onTouchStart={(x, y) => {
                      startedAt.current ??= Date.now();
                      setHint(null);
                      extractor().addPoint({ x, y, timestamp: Date.now(), pressure: 1 });
                    }}
                    onTouchMove={(x, y, pressure) => extractor().addPoint({ x, y, timestamp: Date.now(), pressure })}
                    onTouchEnd={() => {
                      extractor().endStroke();
                      setHasInk(extractor().hasInk);
                    }}
                  />

                  <View style={[styles.overlay, styles.topLeft]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('write_clear')} onPress={clear} style={({ pressed }) => [writingStyles.controlOrb, pressed && styles.pressed]}>
                      <Svg width={32} height={32} viewBox="0 0 100 100">
                        <Path d="M25 25 L75 75 M75 25 L25 75" stroke="white" strokeWidth="12" strokeLinecap="round" />
                      </Svg>
                    </Pressable>
                  </View>
                  <View style={[styles.overlay, styles.topRight]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('mastery_watch')}
                      onPress={() => {
                        feedback.tap();
                        setDemo(true);
                      }}
                      style={({ pressed }) => [writingStyles.controlOrb, { backgroundColor: DT.accent.sky }, pressed && styles.pressed]}
                    >
                      <Svg width={32} height={32} viewBox="0 0 100 100">
                        <Path d="M35 25 L75 50 L35 75 Z" fill="white" />
                      </Svg>
                    </Pressable>
                  </View>
                  <View style={[styles.overlay, styles.bottomLeft]}>
                    <AudioOrb letter={letter} color={DT.accent.navy} />
                  </View>
                  <View style={[styles.overlay, styles.bottomRight]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('write_check')} onPress={finish} disabled={checking} style={({ pressed }) => [styles.finishOrb, (pressed || checking) && styles.pressed]}>
                      {checking ? (
                        <ActivityIndicator color={DT.text.onDark} />
                      ) : (
                        <Svg width={48} height={48} viewBox="0 0 100 100">
                          <Defs>
                            <LinearGradient id="checkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.5} />
                              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.1} />
                            </LinearGradient>
                          </Defs>
                          <Circle cx="50" cy="50" r="48" fill={DT.accent.green} />
                          <Circle cx="50" cy="50" r="46" fill="url(#checkGrad)" stroke="white" strokeWidth="1" strokeOpacity={0.5} />
                          <Path d="M30 50l15 15l30-30" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </Svg>
                      )}
                    </Pressable>
                  </View>
                  {hint ? (
                    <View pointerEvents="none" style={styles.hint}>
                      <AppText size={15} weight="bold" color="#FFFFFF" center>
                        {t(hint)}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        )}
      </SafeAreaView>

      <BackButton placement="floating" onPress={exit} />
      <SeriInfoButton onPress={tour.open} color={DT.accent.navy} />

      <DemoModal visible={demo} idealPath={idealPath} onClose={() => setDemo(false)} />
      <FocusTracker feature="writing" />
      <FeatureTour visible={tour.visible} steps={TOUR} onClose={tour.close} />
    </View>
  );
}

/** "Watch Carefully!": the letter writes itself on a loop, with numbered strokes. */
function DemoModal({ visible, idealPath, onClose }: { visible: boolean; idealPath: ReturnType<typeof generateIdealPath>; onClose: () => void }) {
  const { t } = useT();
  const [area, setArea] = useState({ width: 0, height: 0 });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={ALL_ORIENTATIONS} statusBarTranslucent>
      <View style={styles.demoOverlay}>
        <View style={styles.demoContent}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={styles.closeDemo} hitSlop={8}>
            <Text style={styles.closeDemoText}>✕</Text>
          </Pressable>
          <AppText size={24} weight="bold" color={DT.text.primary} style={styles.demoTitle}>
            {t('mastery_watch_title')}
          </AppText>
          <View style={styles.demoCanvas} onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
            {visible && area.width > 0 ? <WritingCanvas idealPath={idealPath} width={area.width * 0.9} height={area.height * 0.9} mode="demo" /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** What the child sees after checking a letter: one kind sentence, read aloud. The measures are for grown-ups (parent zone). */
function ChildResult({ report, bottomInset, onRetry, onNext, onDone }: { report: SessionFeatureSummary; bottomInset: number; onRetry: () => void; onNext: () => void; onDone: () => void }) {
  const { t } = useT();
  const feedback = useFeedback();
  const kind = report.ml.reversalDetected ? 'flip' : report.ml.isCorrect ? 'great' : 'try';
  const vars = { letter: report.letter, read: report.ml.predictedChar };
  const title = `mastery_kid_${kind}_title` as const;
  const body = `mastery_kid_${kind}_body` as const;

  useEffect(() => {
    feedback.say([title, body], vars);
    // Once, when the result appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView style={styles.results} contentContainerStyle={[styles.resultsContent, styles.childResult, { paddingBottom: bottomInset + 24 }]}>
      <AppText size={80} fixed center accessibilityElementsHidden>
        {kind === 'great' ? '⭐' : kind === 'flip' ? '🔄' : '💪'}
      </AppText>
      <AppText size={30} weight="bold" center color={DT.text.primary} accessibilityRole="header" accessibilityLiveRegion="polite">
        {t(title)}
      </AppText>
      <AppText size={18} center color={DT.text.secondary}>
        {t(body, vars)}
      </AppText>
      <View style={styles.resultsActions}>
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <AppText size={18} weight="bold" color={DT.accent.indigo}>
            {t('trace_retry_button')}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onNext} style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}>
          <AppText size={18} weight="bold" color={DT.text.onDark}>
            {t('mastery_next_letter')}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDone} style={({ pressed }) => [styles.doneLink, pressed && styles.pressed]}>
          <AppText size={16} weight="bold" color={DT.accent.navy}>
            {t('done')}
          </AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: DT.bg.skyBlue },
  header: { height: 60 },
  canvasContainer: { flex: 1, width: '100%' },
  // Must stretch: the canvas is sized from this area's measured width and height (as in the original).
  canvasArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center' },
  canvasWrapper: { alignSelf: 'center', borderRadius: DT.radius.lg, overflow: 'hidden', backgroundColor: 'white', ...DT.shadow.medium },
  overlay: { position: 'absolute', zIndex: 50 },
  topLeft: { top: 24, left: 24 },
  topRight: { top: 24, right: 24 },
  bottomLeft: { bottom: 24, left: 24 },
  bottomRight: { bottom: 24, right: 24 },
  finishOrb: { backgroundColor: DT.accent.green, width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', ...DT.shadow.medium, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)' },
  hint: { position: 'absolute', bottom: 100, left: 24, right: 24, backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  pressed: { opacity: 0.7 },
  results: { flex: 1, backgroundColor: DT.bg.parchment },
  resultsContent: { padding: 24, alignItems: 'center', alignSelf: 'center', width: '100%', maxWidth: 760 },
  childResult: { gap: 16, justifyContent: 'center', flexGrow: 1 },
  doneLink: { paddingVertical: 14, alignItems: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'center', width: '100%', gap: 16, marginBottom: 32 },
  statBox: { flex: 1, backgroundColor: DT.surface.card, borderRadius: DT.radius.xl, padding: 20, alignItems: 'center', ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder },
  statLabel: { marginBottom: 8 },
  detailedMetrics: { backgroundColor: DT.surface.card, borderRadius: DT.radius.xl, padding: 24, width: '100%', marginBottom: 32, ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder },
  reportSubtitle: { marginTop: 4, marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: DT.surface.divider },
  resultsActions: { width: '100%', gap: 16, marginBottom: 40 },
  retryButton: { backgroundColor: DT.bg.lavender, paddingVertical: 18, borderRadius: DT.radius.lg, alignItems: 'center', borderWidth: 2, borderColor: DT.accent.indigo },
  exitButton: { backgroundColor: DT.accent.navy, paddingVertical: 18, borderRadius: DT.radius.lg, alignItems: 'center', ...DT.shadow.medium },
  demoOverlay: { flex: 1, backgroundColor: DT.surface.overlay, justifyContent: 'center', alignItems: 'center' },
  demoContent: { width: '90%', maxWidth: 720, height: '75%', backgroundColor: DT.bg.cream, borderRadius: DT.radius.xl, padding: 24, alignItems: 'center', ...DT.shadow.medium, borderWidth: 2, borderColor: DT.surface.cardBorder },
  demoTitle: { marginBottom: 20 },
  closeDemo: { position: 'absolute', top: -15, right: -15, width: 44, height: 44, backgroundColor: DT.accent.navy, borderRadius: 22, justifyContent: 'center', alignItems: 'center', ...DT.shadow.medium, zIndex: 100 },
  closeDemoText: { fontSize: 24, color: DT.text.onDark, fontWeight: '800' },
  demoCanvas: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DT.surface.card, borderRadius: DT.radius.lg, width: '100%', borderWidth: 1, borderColor: DT.surface.cardBorder },
});
