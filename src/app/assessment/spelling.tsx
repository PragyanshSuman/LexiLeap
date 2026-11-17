import * as Crypto from 'expo-crypto';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { FocusTracker } from '@/components/FocusTracker';
import { InkThumbnail, WritingPad } from '@/components/WritingPad';
import { pickSpellingWords, scoreSpelling, summarizeSpelling, type SpellingFlag } from '@/engine/spelling';
import type { SpellingAssessment, SpellingError } from '@/engine/types';
import type { InkStroke } from '@/handwriting/raster';
import { readLetter, type LetterGuess } from '@/handwriting/recognize';
import { useT, type TranslationKey } from '@/i18n';
import { defaultRng } from '@/lib/random';
import { useFeedback } from '@/services/feedback';
import { useHandwritingModel } from '@/services/handwritingModel';
import { shareAssessmentReport } from '@/services/report';
import { useActiveProfile, useAppStore } from '@/store/appStore';
import { accentOn } from '@/theme/color';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/controls';
import { goBackOr, Header } from '@/ui/Header';
import { FeedbackBanner, ScreenIntro } from '@/ui/Feedback';
import { PopIn } from '@/ui/motion';
import { Screen } from '@/ui/Screen';
import { SoundButton } from '@/ui/SpeechControls';

type Phase = 'intro' | 'writing' | 'review' | 'done';

interface WrittenLetter {
  id: number;
  strokes: InkStroke[];
}

interface WrittenWord {
  word: string;
  letters: WrittenLetter[];
  seconds: number;
}

/** A word is never longer than this many letters beyond the target, so a stuck pad can't run away. */
const EXTRA_LETTERS = 4;
/** The Write Test tile colour on Home. */
const ACCENT = '#5B21B6';

const FLAG_KEY: Record<SpellingFlag, TranslationKey> = {
  'on-track': 'spell_flag_on_track',
  monitor: 'spell_flag_monitor',
  'high-risk': 'spell_flag_high_risk',
};
const ERROR_ORDER: SpellingError[] = ['reversal', 'transposition', 'omission', 'insertion', 'substitution', 'blank'];

/** The original "Write Test": hear a word, write it on the canvas, and get a spelling report. */
export default function SpellingTest() {
  const { t } = useT();
  const { colors } = useTheme();
  const accentText = accentOn(ACCENT, colors.surface);
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const saveAssessment = useAppStore((s) => s.saveAssessment);
  const model = useHandwritingModel();
  const [words] = useState(() => pickSpellingWords(defaultRng));
  const [phase, setPhase] = useState<Phase>('intro');
  const [done, setDone] = useState<WrittenWord[]>([]);
  const [letters, setLetters] = useState<WrittenLetter[]>([]);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  /** The model's readings per letter id, best first, filled in the background while the child writes. */
  const [readings, setReadings] = useState<Record<number, LetterGuess[]>>({});
  /** Which reading is in use per letter id (a grown-up can change it in the review). */
  const [choices, setChoices] = useState<Record<number, number>>({});
  const nextId = useRef(0);
  const [corrected, setCorrected] = useState(false);
  const [saved, setSaved] = useState<SpellingAssessment | null>(null);
  const [sharing, setSharing] = useState(false);
  const [padSize, setPadSize] = useState(0);

  if (!profile) return <Redirect href="/login" />;
  const word = words[done.length];

  const startWord = (next: string) => {
    setLetters([]);
    setStrokes([]);
    setStartedAt(Date.now());
    setTimeout(() => feedback.speak(next), 400);
  };

  const letterOf = (letter: WrittenLetter) => readings[letter.id]?.[choices[letter.id] ?? 0]?.letter ?? '';
  const spelled = (list: WrittenLetter[]) => list.map(letterOf).join('');

  /** Adds what's on the pad as the next letter and reads it once the screen has updated. */
  const withPadLetter = (): WrittenLetter[] => {
    if (strokes.length === 0 || model.status !== 'ready') return letters;
    const letter = { id: nextId.current++, strokes };
    const { model: reader } = model;
    setTimeout(() => {
      const guesses = readLetter(reader, letter.strokes, { caseless: true })?.guesses ?? [];
      setReadings((map) => ({ ...map, [letter.id]: guesses }));
    }, 0);
    return [...letters, letter];
  };

  const nextLetter = () => {
    setLetters(withPadLetter());
    setStrokes([]);
    feedback.tap();
  };

  const finishWord = () => {
    const written: WrittenWord = { word, letters: withPadLetter(), seconds: (Date.now() - startedAt) / 1000 };
    const next = [...done, written];
    setDone(next);
    if (next.length === words.length) {
      setPhase('review');
      feedback.complete();
    } else {
      startWord(words[next.length]);
    }
  };

  const cycleGuess = (id: number) => {
    setCorrected(true);
    setChoices((map) => ({ ...map, [id]: ((map[id] ?? 0) + 1) % Math.max(1, readings[id]?.length ?? 1) }));
  };

  const save = () => {
    const assessment: SpellingAssessment = {
      id: Crypto.randomUUID(),
      kind: 'spelling',
      takenAt: new Date().toISOString(),
      method: corrected ? 'adult' : 'auto',
      items: done.map((w) => scoreSpelling(w.word, spelled(w.letters), w.seconds)),
    };
    saveAssessment(profile.id, assessment);
    setSaved(assessment);
    setPhase('done');
  };

  const tracker = <FocusTracker feature="spelling-test" />;
  // Children see this screen too, so even "needs support" is amber rather than alarming red.
  const flagColour: Record<SpellingFlag, string> = { 'on-track': colors.success, monitor: colors.primary, 'high-risk': colors.warning };

  if (phase === 'intro') {
    return (
      <Screen
        scroll
        header={<Header title={t('spell_title')} />}
        footer={
          <Button
            label={t('spell_start')}
            icon="play"
            color={ACCENT}
            disabled={model.status !== 'ready'}
            loading={model.status === 'loading'}
            onPress={() => {
              setPhase('writing');
              startWord(words[0]);
            }}
          />
        }
        overlay={tracker}
      >
        <ScreenIntro
          emoji="✍️"
          title={t('spell_intro_title')}
          body={t('spell_intro', { n: words.length })}
          note={model.status === 'error' ? t('write_model_error') : t('spell_english_note')}
        />
      </Screen>
    );
  }

  if (phase === 'review') {
    const allRead = done.every((w) => w.letters.every((l) => readings[l.id]));
    return (
      <Screen
        scroll
        header={<Header title={t('spell_review_title')} />}
        footer={<Button label={t('spell_save')} icon="checkmark-circle" color={ACCENT} disabled={!allRead} loading={!allRead} onPress={save} />}
        overlay={tracker}
      >
        <FeedbackBanner kind="info" text={allRead ? t('spell_review_hint') : t('spell_reading')} />
        <View style={styles.reviewList}>
          {done.map((w, wi) => {
            const right = spelled(w.letters) === w.word;
            return (
              <Card key={wi} style={styles.reviewCard} accent={right ? colors.success : colors.warning}>
                <AppText variant="label" weight="bold">
                  {right ? '✅' : '✏️'} {w.word}
                </AppText>
                <View style={styles.letterRow}>
                  {w.letters.length === 0 ? <AppText muted>–</AppText> : null}
                  {w.letters.map((l) => (
                    <Pressable
                      key={l.id}
                      accessibilityRole="button"
                      accessibilityLabel={letterOf(l)}
                      disabled={!readings[l.id]}
                      onPress={() => cycleGuess(l.id)}
                      style={({ pressed }) => [styles.reviewLetter, pressed && styles.pressed]}
                    >
                      <InkThumbnail strokes={l.strokes} size={48} />
                      <AppText variant="heading" weight="bold" fixed center color={accentText}>
                        {letterOf(l) || '·'}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </Card>
            );
          })}
        </View>
      </Screen>
    );
  }

  if (phase === 'done' && saved) {
    const summary = summarizeSpelling(saved.items);
    const patterns = ERROR_ORDER.filter((e) => summary.errorCounts[e] > 0);
    return (
      <Screen
        scroll
        header={<Header title={t('spell_title')} onBack={() => goBackOr('/home')} />}
        footer={
          <View style={styles.row}>
            <Button label={t('done')} icon="home" variant="secondary" color={ACCENT} onPress={() => router.dismissTo('/home')} style={styles.flex} />
            <Button
              label={t('assess_share')}
              icon="document-text"
              color={ACCENT}
              loading={sharing}
              style={styles.flex}
              onPress={async () => {
                setSharing(true);
                try {
                  await shareAssessmentReport(profile, saved);
                } catch (e) {
                  Alert.alert(t('spell_title'), e instanceof Error ? e.message : t('something_wrong'));
                } finally {
                  setSharing(false);
                }
              }}
            />
          </View>
        }
        overlay={tracker}
      >
        <View style={styles.center}>
          <AppText size={64} fixed center>
            🏅
          </AppText>
          <AppText variant="title" center accessibilityRole="header">
            {t('assess_done_title')}
          </AppText>
          <AppText variant="heading" center color={accentText}>
            {t('assess_words', { a: summary.wordsRight, b: summary.wordsTotal })}
          </AppText>
          <AppText variant="label" center muted>
            {t('spell_accuracy', { n: Math.round(summary.accuracy * 100) })}
          </AppText>
          <View style={[styles.flag, { borderColor: flagColour[summary.flag] }]}>
            <AppText variant="label" weight="bold" color={flagColour[summary.flag]}>
              {t(FLAG_KEY[summary.flag])}
            </AppText>
          </View>
        </View>
        <Card style={styles.patterns}>
          <AppText variant="label" weight="bold">
            {t('spell_patterns')}
          </AppText>
          {patterns.length === 0 ? (
            <AppText muted>{t('spell_no_errors')}</AppText>
          ) : (
            patterns.map((e) => (
              <View key={e} style={styles.patternRow}>
                <AppText muted>{t(`spell_err_${e}`)}</AppText>
                <AppText weight="bold">{`×${summary.errorCounts[e]}`}</AppText>
              </View>
            ))
          )}
        </Card>
      </Screen>
    );
  }

  const maxLetters = word.length + EXTRA_LETTERS;
  return (
    <Screen
      header={<Header title={t('spell_title')} subtitle={t('of', { a: done.length + 1, b: words.length })} />}
      footer={
        <View style={styles.footer}>
          <View style={styles.row}>
            <Button
              label={t('spell_undo')}
              icon="arrow-undo"
              variant="secondary"
              color={ACCENT}
              compact
              disabled={letters.length === 0 && strokes.length === 0}
              onPress={() => (strokes.length ? setStrokes([]) : setLetters(letters.slice(0, -1)))}
              style={styles.flex}
            />
            <Button
              label={t('spell_next_letter')}
              icon="arrow-forward"
              variant="secondary"
              color={ACCENT}
              compact
              disabled={strokes.length === 0 || letters.length >= maxLetters}
              onPress={nextLetter}
              style={styles.flex}
            />
          </View>
          <Button label={t('spell_done_word')} icon="checkmark-done" color={ACCENT} onPress={finishWord} />
        </View>
      }
      overlay={tracker}
    >
      <View style={styles.body}>
        <ProgressBar value={done.length / words.length} color={ACCENT} />
        <View style={styles.listenRow}>
          <SoundButton label={t('spell_hear')} color={ACCENT} onPress={() => feedback.speak(word)} />
          <View style={styles.writtenRow} accessible accessibilityLabel={t('spell_letters', { n: letters.length })}>
            {letters.map((l) => (
              <PopIn key={l.id}>
                <InkThumbnail strokes={l.strokes} size={40} />
              </PopIn>
            ))}
            <View style={[styles.cursor, { backgroundColor: ACCENT }]} />
          </View>
        </View>

        <View testID="pad-area" style={styles.padArea} onLayout={(e) => setPadSize(Math.floor(Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height)))}>
          {padSize > 0 ? <WritingPad strokes={strokes} onChange={setStrokes} size={padSize} accessibilityLabel={t('write_pad')} /> : null}
        </View>
        <AppText variant="caption" center muted>
          {t('spell_write_hint')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  footer: { gap: 10 },
  row: { flexDirection: 'row', gap: 12 },
  body: { flex: 1, gap: 12, paddingBottom: 4 },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  writtenRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 44, alignItems: 'center' },
  cursor: { width: 3, height: 32, borderRadius: 2, opacity: 0.5 },
  padArea: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  reviewList: { gap: 12, marginTop: 12 },
  reviewCard: { gap: 8 },
  letterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reviewLetter: { alignItems: 'center', gap: 2, minWidth: 48 },
  pressed: { opacity: 0.6 },
  flag: { borderWidth: 2, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 },
  patterns: { gap: 8, marginTop: 12 },
  patternRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
