import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Alert, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { choiceRoundScore, clampLevel } from '@/engine/adaptive';
import { BADGE_MAP } from '@/engine/badges';
import { ACTIVITIES } from '@/engine/catalog';
import { nextPlanItem } from '@/engine/plan';
import { emptyProgress, isOverLimit } from '@/engine/progress';
import type { ActivityId, Level, SessionOutcome } from '@/engine/types';
import { AdaptivePathingSheet } from '@/components/AdvisorSheet';
import { FocusTracker } from '@/components/FocusTracker';
import { FeatureTour, InfoButton, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { NODE_MAP } from '@/engine/path';
import { activityKey, badgeKey, levelKey, nodeTitle, useT, type TranslationKey } from '@/i18n';
import { dayKey } from '@/lib/date';
import { defaultRng, pick } from '@/lib/random';
import { useFeedback } from '@/services/feedback';
import { useAppStore } from '@/store/appStore';
import type { Profile } from '@/store/profile';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button, IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ProgressBar, StarRow } from '@/ui/controls';
import { FeedbackBanner } from '@/ui/Feedback';
import type { ActivityDefinition, RoundAnswer } from './types';

const PRAISE: TranslationKey[] = ['praise_1', 'praise_2', 'praise_3', 'praise_4', 'praise_5', 'praise_6'];
const ENCOURAGE: TranslationKey[] = ['encourage_1', 'encourage_2', 'encourage_3'];

/** Misses in a row that count as struggling. */
const MISSES_BEFORE_BREAK = 3;
/** A wrong answer this soon after a round starts suggests guessing or rushing. */
const RUSHED_MS = 1200;
/** Don't nag: at most this many check-ins per session. */
const MAX_BREAK_PROMPTS = 2;

type Phase = 'intro' | 'playing' | 'break' | 'summary';

function freshStats() {
  const now = Date.now();
  return {
    scores: [] as number[],
    firstTry: 0,
    struggles: 0,
    misses: 0,
    rushed: 0,
    prompts: 0,
    letters: {} as Record<string, number>,
    responseMs: [] as number[],
    confusions: [] as [string, string][],
    startedAt: new Date(now).toISOString(),
    startMs: now,
    roundStartMs: now,
  };
}
type Banner = { kind: 'correct' | 'tryAgain' | 'revealed'; text: string } | null;

interface RunnerProps<R> {
  definition: ActivityDefinition<R>;
  profile: Profile;
  focus?: string;
  /** Lets the screen block accidental back navigation while a session is in progress. */
  onInProgressChange: (inProgress: boolean) => void;
  /** Leaves the activity (the screen lifts its back-navigation guard first). */
  onExit: () => void;
  /** Leaves for another activity (from the Adaptive Pathing suggestions). */
  onSwitch: (activityId: ActivityId) => void;
}

export function ActivityRunner<R>({ definition, profile, focus, onInProgressChange, onExit, onSwitch }: RunnerProps<R>) {
  const { meta } = definition;
  const theme = useTheme();
  const { colors, space } = theme;
  const { t } = useT();
  const title = t(activityKey(meta.id, 'title'));
  const tour = useFeatureTour(`activity-${meta.id}`);
  const tourSteps: TourStep[] = definition.tour ?? [
    { title: activityKey(meta.id, 'title'), description: activityKey(meta.id, 'instructions') },
    { title: 'tour_act_listen_title', description: 'tour_act_listen_desc' },
    { title: 'tour_act_skip_title', description: 'tour_act_skip_desc' },
  ];
  const instructions = t(activityKey(meta.id, 'instructions'));
  const feedback = useFeedback();
  const window = useWindowDimensions();
  const recordSession = useAppStore((s) => s.recordSession);
  const startLevel = useAppStore((s) => s.progress[profile.id]?.activities[meta.id]?.level ?? 1);

  const [phase, setPhase] = useState<Phase>('intro');
  const [level, setLevel] = useState<Level>(startLevel);
  const [rounds, setRounds] = useState<R[]>([]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  /** Bumped whenever rounds are regenerated, so round components start fresh. */
  const [generation, setGeneration] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [breakReason, setBreakReason] = useState<'struggle' | 'focus'>('struggle');

  // Session statistics live in a ref: they change on every answer but never drive rendering.
  const stats = useRef(freshStats());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => () => feedback.stopSpeaking(), [feedback]);
  useEffect(() => onInProgressChange(phase === 'playing' || phase === 'break'), [phase, onInProgressChange]);

  // Read the instructions aloud on the intro screen.
  useEffect(() => {
    if (phase === 'intro') feedback.say(activityKey(meta.id, 'instructions'));
  }, [phase, meta.id, feedback]);

  const generate = useCallback(
    (lvl: Level, count: number) => {
      const progress = useAppStore.getState().progress[profile.id];
      return definition.generate({ level: lvl, rng: defaultRng, progress: progress ?? emptyProgress(), focus }).slice(0, count);
    },
    [definition, profile.id, focus],
  );

  const start = () => {
    stats.current = freshStats();
    const lvl = clampLevel(useAppStore.getState().progress[profile.id]?.activities[meta.id]?.level ?? 1);
    setLevel(lvl);
    setRounds(generate(lvl, definition.roundsPerSession));
    setGeneration((g) => g + 1);
    setScore(0);
    setCombo(0);
    setIndex(0);
    setAttempt(0);
    setRevealed(false);
    setBanner(null);
    setOutcome(null);
    setPhase('playing');
  };

  const round = rounds[index];

  // Speak each round's prompt when it appears (and again on a retry).
  useEffect(() => {
    if (phase !== 'playing' || !round) return;
    stats.current.roundStartMs = Date.now();
    const text = definition.prompt(round);
    if (!text) return;
    const t = setTimeout(() => feedback.speak(text), attempt === 0 ? 350 : 150);
    return () => clearTimeout(t);
  }, [phase, round, attempt, definition, feedback]);

  /** Saves the session so far, or returns null when nothing was answered yet. */
  const record = useCallback((): SessionOutcome | null => {
    const s = stats.current;
    if (s.scores.length === 0) return null;
    return recordSession(profile.id, {
      activityId: meta.id,
      level,
      roundScores: s.scores,
      firstTry: s.firstTry,
      durationSec: (Date.now() - s.startMs) / 1000,
      struggles: s.struggles,
      startedAt: s.startedAt,
      letterScores: Object.keys(s.letters).length ? s.letters : undefined,
      avgResponseSec: s.responseMs.length ? s.responseMs.reduce((a, b) => a + b, 0) / s.responseMs.length / 1000 : undefined,
      confusions: s.confusions.length ? s.confusions : undefined,
    });
  }, [recordSession, profile.id, meta.id, level]);

  const finish = useCallback(() => {
    const result = record();
    if (!result) {
      onExit();
      return;
    }
    setOutcome(result);
    setPhase('summary');
    feedback.complete();
    feedback.say(result.session.stars === 3 ? 'summary_amazing' : result.session.stars === 2 ? 'summary_great' : 'summary_nice');
  }, [record, feedback, onExit]);

  const switchTo = (activityId: ActivityId) => {
    record();
    onSwitch(activityId);
  };

  const advance = useCallback(() => {
    setBanner(null);
    setAttempt(0);
    setRevealed(false);
    if (index + 1 >= rounds.length) finish();
    else setIndex(index + 1);
  }, [index, rounds.length, finish]);

  /** After a miss, decide whether to offer a calm break instead of carrying on. */
  const needsBreak = () => {
    const s = stats.current;
    if (s.prompts >= MAX_BREAK_PROMPTS) return false;
    if (s.misses >= MISSES_BEFORE_BREAK || s.rushed >= 2) {
      s.struggles += 1;
      s.prompts += 1;
      s.misses = 0;
      s.rushed = 0;
      return true;
    }
    return false;
  };

  const onAnswer = (answer: RoundAnswer) => {
    if (phase !== 'playing' || banner) return;
    const s = stats.current;
    if (answer.glyph && answer.score !== undefined) {
      s.letters[answer.glyph] = Math.max(s.letters[answer.glyph] ?? 0, answer.score);
    }
    if (answer.confusions) s.confusions.push(...answer.confusions);
    if (attempt === 0 && definition.timesResponses !== false) s.responseMs.push(Date.now() - s.roundStartMs);

    if (answer.correct) {
      s.scores.push(answer.score ?? choiceRoundScore(attempt, false));
      if (attempt === 0) s.firstTry += 1;
      setScore((value) => value + Math.round((answer.score ?? choiceRoundScore(attempt, false)) * 100));
      setCombo((value) => (attempt === 0 ? value + 1 : 0));
      s.misses = 0;
      s.rushed = 0;
      feedback.correct();
      setBanner({ kind: 'correct', text: t(pick(defaultRng, PRAISE)) });
      later(advance, 1100);
      return;
    }

    s.misses += 1;
    setCombo(0);
    // Only first answers count as rushing: a quick second guess on a retry is natural.
    if (attempt === 0) s.rushed = Date.now() - s.roundStartMs < RUSHED_MS ? s.rushed + 1 : 0;
    feedback.tryAgain();

    if (answer.final || attempt + 1 >= definition.maxAttempts) {
      s.scores.push(answer.score ?? 0);
      setRevealed(true);
      setBanner({ kind: 'revealed', text: t('runner_reveal') });
      if (definition.reveal && round) later(() => feedback.speak(definition.reveal!(round)), 400);
      const breakNow = needsBreak();
      later(() => {
        if (breakNow && index + 1 < rounds.length) {
          setBanner(null);
          setAttempt(0);
          setRevealed(false);
          setIndex(index + 1);
          setBreakReason('struggle');
          setPhase('break');
        } else {
          advance();
        }
      }, 2200);
      return;
    }

    setBanner({ kind: 'tryAgain', text: t(pick(defaultRng, ENCOURAGE)) });
    const breakNow = needsBreak();
    later(() => {
      setBanner(null);
      setAttempt((a) => a + 1);
      if (breakNow) {
        setBreakReason('struggle');
        setPhase('break');
      }
    }, 1000);
  };

  /** The Focus helper noticed several tired or distracted readings in a row. */
  const onLowFocus = () => {
    if (phase !== 'playing' || banner) return;
    stats.current.struggles += 1;
    setBreakReason('focus');
    setPhase('break');
  };

  const skip = () => {
    if (banner) return;
    stats.current.scores.push(0);
    advance();
  };

  const makeEasier = () => {
    const easier = clampLevel(level - 1);
    setLevel(easier);
    const remaining = rounds.length - index;
    setRounds([...rounds.slice(0, index), ...generate(easier, remaining)]);
    setGeneration((g) => g + 1);
    setAttempt(0);
    setPhase('playing');
  };

  const confirmExit = () => {
    if (stats.current.scores.length === 0) return onExit();
    Alert.alert(t('stop_title'), t('stop_body'), [
      { text: t('keep_playing'), style: 'cancel' },
      { text: t('stop'), style: 'destructive', onPress: finish },
    ]);
  };

  // ── Rendering ────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <SafeAreaView style={[styles.flex, styles.column, { backgroundColor: colors.bg }]}>
        <View style={[styles.topBar, styles.spread, { paddingHorizontal: space(4) }]}>
          <IconButton icon="close" label={t('close')} onPress={onExit} />
          <InfoButton onPress={tour.open} />
        </View>
        <View style={[styles.center, { padding: space(6), gap: space(4) }]}>
          <View style={[styles.bigIcon, { backgroundColor: meta.color + '22' }]}>
            <AppText size={64}>{meta.emoji}</AppText>
          </View>
          <AppText variant="title" center accessibilityRole="header">
            {title}
          </AppText>
          <AppText center muted>
            {instructions}
          </AppText>
          <View style={[styles.levelPill, { backgroundColor: colors.surfaceAlt }]}>
            <AppText variant="caption">
              {t('runner_level', { n: startLevel, desc: t(levelKey(meta.id, startLevel)) })}
            </AppText>
          </View>
          <IconButton icon="volume-high" label={t('runner_hear_instructions')} onPress={() => feedback.say(activityKey(meta.id, 'instructions'))} />
        </View>
        <View style={{ padding: space(5) }}>
          <Button label={t('start')} icon="play" color={meta.color} onPress={start} />
        </View>
        <FeatureTour visible={tour.visible} steps={tourSteps} onClose={tour.close} />
      </SafeAreaView>
    );
  }

  if (phase === 'summary' && outcome) {
    return <Summary outcome={outcome} profile={profile} color={meta.color} onAgain={start} onDone={onExit} />;
  }

  const Round = definition.Round;
  const stage = definition.stage;
  const chrome = stage?.dark ? { color: '#FFFFFF', background: 'rgba(255,255,255,0.18)' } : undefined;
  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {stage?.colors ? <LinearGradient colors={stage.colors} style={StyleSheet.absoluteFill} /> : null}
      {/* Sized to the window: on some Android tablets an absolutely-filled image is drawn narrower than the screen. */}
      {stage?.image ? <Image source={stage.image} resizeMode="cover" style={[styles.stageImage, { width: window.width, height: window.height }]} /> : null}
      {stage?.dark ? <StatusBar style="light" /> : null}
    <SafeAreaView style={[styles.flex, styles.column]}>
      <View style={[styles.topBar, { paddingHorizontal: space(4), gap: space(3) }]}>
        <IconButton icon="close" label={t('runner_stop')} onPress={confirmExit} color={chrome?.color} background={chrome?.background} />
        <View style={styles.flex}>
          <ProgressBar value={(index + (banner?.kind === 'correct' || banner?.kind === 'revealed' ? 1 : 0)) / Math.max(1, rounds.length)} color={meta.color} />
          <AppText variant="caption" muted={!chrome} color={chrome?.color} center style={{ marginTop: 2 }}>
            {t('of', { a: Math.min(index + 1, rounds.length), b: rounds.length })}
          </AppText>
        </View>
        {round && definition.prompt(round) ? (
          <IconButton icon="volume-high" label={t('runner_hear_again')} onPress={() => feedback.speak(definition.prompt(round))} color={chrome?.color} background={chrome?.background} />
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>

      <View style={[styles.flex, { paddingHorizontal: space(4) }]}>
        {round ? (
          <Round key={`${generation}-${index}`} round={round} level={level} attempt={attempt} revealed={revealed} disabled={!!banner || phase !== 'playing'} onAnswer={onAnswer} score={score} combo={combo} accent={meta.color} />
        ) : null}
      </View>

      <View style={[styles.footer, { paddingHorizontal: space(4), paddingBottom: space(2), minHeight: 72 }]}>
        {banner ? (
          <FeedbackBanner kind={banner.kind === 'revealed' ? 'info' : banner.kind} text={banner.text} />
        ) : (
          <Button label={t('skip')} variant="ghost" icon="play-skip-forward" compact onPress={skip} accessibilityHint={t('runner_skip_hint')} color={chrome?.color} />
        )}
      </View>

      {phase === 'break' ? (
        <AdaptivePathingSheet
          current={meta.id}
          canEase={level > 1}
          onContinue={() => setPhase('playing')}
          onEase={makeEasier}
          onStop={finish}
          onSwitch={switchTo}
          reason={breakReason}
        />
      ) : null}
    </SafeAreaView>
      <FocusTracker feature={meta.id} onLowFocus={onLowFocus} />
    </View>
  );
}

function Summary({ outcome, profile, color, onAgain, onDone }: { outcome: SessionOutcome; profile: Profile; color: string; onAgain: () => void; onDone: () => void }) {
  const { colors, space } = useTheme();
  const { t } = useT();
  const progress = useAppStore((s) => s.progress[profile.id]);
  const { session } = outcome;
  const meta = ACTIVITIES[session.activityId];
  const next = nextPlanItem(progress?.plan ?? null);
  const plan = progress?.plan;
  const doneCount = plan?.items.filter((i) => i.done).length ?? 0;
  const timeUp = progress ? isOverLimit(profile.prefs.dailyLimitMin, progress, dayKey()) : false;
  const firstTryText = t('summary_first_try', { a: session.firstTry, b: session.rounds });

  return (
    <SafeAreaView style={[styles.flex, styles.column, { backgroundColor: colors.bg }]}>
      <View style={[styles.flex, styles.center, { padding: space(5), gap: space(4) }]}>
        <AppText size={64} center>
          {session.stars === 3 ? '🏆' : session.stars === 2 ? '🌟' : '👏'}
        </AppText>
        <AppText variant="title" center accessibilityRole="header">
          {session.stars === 3 ? t('summary_amazing') : session.stars === 2 ? t('summary_great') : t('summary_nice')}
        </AppText>
        <StarRow count={session.stars} size={40} />
        <AppText center muted>
          {firstTryText}
        </AppText>

        {outcome.levelChange === 'up' ? (
          <Card style={{ alignSelf: 'stretch' }} accent={color}>
            <AppText variant="label">{t('summary_level_up', { n: outcome.newLevel })}</AppText>
            <AppText variant="caption" muted>
              {t('summary_next_time', { desc: t(levelKey(meta.id, outcome.newLevel)) })}
            </AppText>
          </Card>
        ) : outcome.levelChange === 'down' ? (
          <Card style={{ alignSelf: 'stretch' }} accent={color}>
            <AppText variant="label">{t('summary_warm_up', { n: outcome.newLevel })}</AppText>
            <AppText variant="caption" muted>
              {t('summary_warm_up_note')}
            </AppText>
          </Card>
        ) : null}

        {outcome.newBadges.length > 0 ? (
          <Card style={{ alignSelf: 'stretch', gap: space(2) }}>
            <AppText variant="label">{t('summary_new_badges')}</AppText>
            {outcome.newBadges.map((id) => (
              <AppText key={id}>
                {BADGE_MAP[id].emoji} {t(badgeKey(id, 'title'))}
              </AppText>
            ))}
          </Card>
        ) : null}

        {outcome.pathNodesCompleted.map((id) => (
          <AppText key={id} variant="label" center color={colors.primary}>
            {t('summary_path_step', { title: nodeTitle(t, NODE_MAP[id]), n: outcome.pathXp })}
          </AppText>
        ))}

        {outcome.planCompleted ? (
          <AppText variant="label" center color={colors.success}>
            {t('summary_plan_done', { n: outcome.starsEarned - session.stars })}
          </AppText>
        ) : plan && outcome.planItemCompleted ? (
          <AppText variant="label" center muted>
            {t('summary_plan_progress', { a: doneCount, b: plan.items.length })}
          </AppText>
        ) : null}
      </View>

      <View style={{ padding: space(5), gap: space(3) }}>
        {timeUp ? (
          <Button label={t('summary_time_break')} icon="moon" color={color} onPress={() => router.replace('/break')} />
        ) : next ? (
          <Button label={t('summary_next', { title: t(activityKey(next, 'title')) })} icon="arrow-forward" color={ACTIVITIES[next].color} onPress={() => router.replace(`/activity/${next}`)} />
        ) : null}
        {!timeUp ? <Button label={t('summary_play_again')} icon="refresh" variant="secondary" color={color} onPress={onAgain} /> : null}
        <Button label={t('done')} icon="home" variant="ghost" color={color} onPress={onDone} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stageImage: { position: 'absolute', top: 0, left: 0 },
  column: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  spread: { justifyContent: 'space-between' },
  bigIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  levelPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  footer: { justifyContent: 'center' },
  iconSpacer: { width: 48 },
});
