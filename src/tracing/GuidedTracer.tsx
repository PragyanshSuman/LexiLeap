import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { isLowercase } from '@/activities/trace/glyphs';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import {
  buildSegments,
  isSegmentDone,
  moveAlong,
  segmentScore,
  startProgress,
  type SegmentProgress,
  type TraceCanvas,
  type TracePoint,
  type TraceSegment,
} from './seriLetters';

const TIGER_HAPPY = require('../../assets/images/tracing/tiger-happy.png');
const TIGER_SURPRISED = require('../../assets/images/tracing/tiger-surprised.png');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Background of the original tracing screen (light and dusk themes). */
export const TRACE_BACKGROUND = { light: ['#FFFAF0', '#E0E7FF'] as const, dark: ['#0F172A', '#1E1B4B'] as const };
const PATH_GRADIENT = { light: ['#FF6B6B', '#4ECDC4', '#FFE66D'], dark: ['#00F2FE', '#4FACFE', '#667EEA'] };
const ORB_HUES = {
  light: ['rgba(253,186,116,0.5)', 'rgba(192,132,252,0.5)', 'rgba(252,165,165,0.5)', 'rgba(94,234,212,0.5)'],
  dark: ['rgba(139,92,246,0.3)', 'rgba(56,189,248,0.3)', 'rgba(236,72,153,0.3)', 'rgba(45,212,191,0.3)'],
};


export interface LetterTraced {
  letter: string;
  /** How neatly the letter was traced, 0.1–1. */
  score: number;
  seconds: number;
  segmentScores: number[];
}

interface GuidedTracerProps {
  letter: string;
  canvas: TraceCanvas;
  /** Called once per completed letter. */
  onTraced: (result: LetterTraced) => void;
  /** 'complete': as soon as the last stroke is done (saves even if the child leaves during the reward). 'reward': after the reward animation. */
  reportAt?: 'complete' | 'reward';
  /** Show the original's "Amazing! / Trace again" badge when finished. */
  successBadge?: boolean;
  /** Say "Letter B" when the letter appears (the activity runner speaks its own prompt instead). */
  announce?: boolean;
  /** Size of the tiger relative to the original (it is very large on small areas). */
  tigerScale?: number;
  /** Memory tracing: the letter is only faintly shown and the guide dots are hidden. */
  faded?: boolean;
  disabled?: boolean;
}

/** The original "Scalable Alphabet Mode" tracer: one letter, stroke by stroke, with the tiger cheering. */
export function GuidedTracer({ letter, canvas, onTraced, reportAt = 'complete', successBadge = true, announce = true, tigerScale = 1, faded = false, disabled }: GuidedTracerProps) {
  const segments = useMemo(() => buildSegments(letter, canvas), [letter, canvas]);
  // Remount everything for a new letter or canvas so all state resets cleanly, as in the original.
  return (
    <TraceLetter
      key={`${letter}-${canvas.width}-${canvas.height}`}
      letter={letter}
      segments={segments}
      canvas={canvas}
      onTraced={onTraced}
      reportAt={reportAt}
      successBadge={successBadge}
      announce={announce}
      tigerScale={tigerScale}
      faded={faded}
      disabled={!!disabled}
    />
  );
}

function TraceLetter({
  letter,
  segments,
  canvas,
  onTraced,
  reportAt,
  successBadge,
  announce,
  tigerScale,
  faded,
  disabled,
}: Required<Omit<GuidedTracerProps, 'canvas'>> & { canvas: TraceCanvas; segments: TraceSegment[] }) {
  const { prefs, colors } = useTheme();
  const { t } = useT();
  const feedback = useFeedback();
  const dark = colors.isDark;
  const calm = prefs.reduceMotion;
  const [segIndex, setSegIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [sparklesAt, setSparklesAt] = useState<{ x: number; y: number; id: number } | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [round, setRound] = useState(0);
  const [lost, setLost] = useState(false);
  const scores = useRef<number[]>([]);
  const startedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const result = useRef<LetterTraced | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (announce) feedback.say(isLowercase(letter) ? 'trace_small_letter_intro' : 'trace_letter_intro', { letter });
    // Only when the letter first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter, announce]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const finishReward = useCallback(() => {
    setReplaying(false);
    setAllDone(true);
    feedback.say('tracing_amazing');
    if (reportAt === 'reward' && result.current) onTraced(result.current);
  }, [feedback, onTraced, reportAt]);

  const segmentDone = (score: number) => {
    scores.current = [...scores.current, score];
    const at = segments[segIndex].end;
    setSparklesAt({ x: at.x, y: at.y, id: Date.now() });
    feedback.tap();
    later(() => setSparklesAt(null), 1000);
    later(() => {
      if (segIndex < segments.length - 1) {
        setSegIndex(segIndex + 1);
        setLost(false);
        return;
      }
      const segmentScores = scores.current;
      const traced: LetterTraced = {
        letter,
        score: segmentScores.reduce((s, v) => s + v, 0) / Math.max(1, segmentScores.length),
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
        segmentScores,
      };
      result.current = traced;
      feedback.correct();
      if (reportAt === 'complete') onTraced(traced);
      if (calm) finishReward();
      else setReplaying(true);
    }, 600);
  };

  const restart = () => {
    scores.current = [];
    result.current = null;
    startedAt.current = Date.now();
    setSegIndex(0);
    setAllDone(false);
    setReplaying(false);
    setRound((r) => r + 1);
  };

  const k = canvas.k;
  const gradient = dark ? PATH_GRADIENT.dark : PATH_GRADIENT.light;
  const tracing = !allDone && !replaying;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <TigerAvatar allDone={allDone} size={350 * k * tigerScale} offset={{ left: 30 * k * tigerScale, bottom: 80 * k * tigerScale }} calm={calm} label={t('tracing_amazing')} />

      <View style={[styles.canvasWrap, { width: canvas.width, height: canvas.height }]}>
        <Svg width={canvas.width} height={canvas.height} pointerEvents="none">
          <Defs>
            <LinearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradient[0]} stopOpacity={1} />
              <Stop offset="50%" stopColor={gradient[1]} stopOpacity={1} />
              <Stop offset="100%" stopColor={gradient[2]} stopOpacity={1} />
            </LinearGradient>
            <RadialGradient id="glowGradient" cx="50%" cy="50%">
              <Stop offset="0%" stopColor="#FFD700" stopOpacity={0.8} />
              <Stop offset="100%" stopColor="#FFA500" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <G opacity={faded && tracing ? 0.35 : 0.85}>
            {segments.map((s, i) => (
              <Path key={`base-${i}`} d={s.d} stroke="#F9FAFB" strokeWidth={50 * k} strokeLinecap="round" fill="none" />
            ))}
          </G>
          {/* While the letter replays it fades to a soft ghost, so the replay is clearly seen writing it. */}
          <G opacity={faded && tracing ? 0.18 : replaying ? 0.2 : 1}>
            {segments.map((s, i) => (
              <Path key={`fg-${i}`} d={s.d} stroke="url(#pathGradient)" strokeWidth={34 * k} strokeLinecap="round" fill="none" />
            ))}
          </G>
          {tracing && !faded ? <GuideDots segment={segments[segIndex]} k={k} calm={calm} /> : null}
          {replaying ? <LetterReplay segments={segments} k={k} onDone={finishReward} /> : null}
        </Svg>

        {tracing ? (
          <View pointerEvents="none" style={[styles.tip, lost && styles.tipLost]} accessibilityLiveRegion="polite">
            <Text style={styles.tipText}>{t(lost ? 'trace_tip_start' : 'tracing_trace_glowing')}</Text>
          </View>
        ) : null}
        {sparklesAt && !calm ? <Sparkles key={sparklesAt.id} x={sparklesAt.x} y={sparklesAt.y} k={k} /> : null}

        {tracing ? (
          <SegmentTracer key={`${round}-${segIndex}`} segment={segments[segIndex]} k={k} calm={calm} disabled={disabled} onDone={segmentDone} onLost={setLost} />
        ) : allDone && successBadge ? (
          <SuccessBadge top={canvas.height / 3.5} calm={calm} onRestart={restart} />
        ) : null}
      </View>
    </View>
  );
}

/** Drifting, softly pulsing colour blobs behind the canvas, as in the original. */
export function AmbientOrbs({ width, height }: { width: number; height: number }) {
  const { prefs, colors } = useTheme();
  const hues = colors.isDark ? ORB_HUES.dark : ORB_HUES.light;
  const [orbs] = useState(() =>
    Array.from({ length: 4 }, (_, i) => ({
      id: i,
      x: Math.random() * width - width * 0.2,
      y: Math.random() * height - 200,
      size: 250 + Math.random() * 350,
      hue: i,
      seed: Math.random(),
    })),
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {orbs.map((orb) => (
        <Orb key={orb.id} x={orb.x} y={orb.y} size={orb.size} hue={hues[orb.hue % hues.length]} seed={orb.seed} calm={prefs.reduceMotion} />
      ))}
    </View>
  );
}

function Orb({ x, y, size, hue, seed, calm }: { x: number; y: number; size: number; hue: string; seed: number; calm: boolean }) {
  const [drift] = useState(() => ({ x: new Animated.Value(0), y: new Animated.Value(0), pulse: new Animated.Value(1) }));
  useEffect(() => {
    if (calm) return;
    const jitter = (ms: number) => ms + seed * 4000;
    const timing = (v: Animated.Value, to: number, ms: number) => Animated.timing(v, { toValue: to, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([timing(drift.x, 60, jitter(8000)), timing(drift.x, -40, jitter(9000)), timing(drift.x, 0, jitter(6000))]),
        Animated.sequence([timing(drift.y, 40, jitter(7000)), timing(drift.y, -50, jitter(8000)), timing(drift.y, 0, jitter(5000))]),
        Animated.sequence([timing(drift.pulse, 1.15, 6000), timing(drift.pulse, 0.9, 7000), timing(drift.pulse, 1, 5000)]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [calm, drift, seed]);
  return (
    <Animated.View style={{ position: 'absolute', left: x, top: y, width: size, height: size, transform: [{ translateX: drift.x }, { translateY: drift.y }, { scale: drift.pulse }] }}>
      <Svg height="100%" width="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="orb" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={hue} stopOpacity={1} />
            <Stop offset="40%" stopColor={hue} stopOpacity={0.8} />
            <Stop offset="70%" stopColor={hue} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={hue} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill="url(#orb)" />
      </Svg>
    </Animated.View>
  );
}

function TigerAvatar({ allDone, size, offset, calm, label }: { allDone: boolean; size: number; offset: { left: number; bottom: number }; calm: boolean; label: string }) {
  const [bounce] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (calm) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, calm]);

  useEffect(() => {
    if (!allDone || calm) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, friction: 3 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 3 }),
        Animated.delay(200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [allDone, calm, scale]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  return (
    <Animated.View pointerEvents="none" style={[styles.tiger, offset, { transform: [{ translateY }, { scale }] }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={allDone ? TIGER_SURPRISED : TIGER_HAPPY} style={{ width: size, height: size }} resizeMode="contain" />
      {allDone ? (
        <View style={[styles.speechBubble, { left: size * 0.4 }]}>
          <Text style={styles.speechText}>{label}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Eight softly glowing dots along the stroke to trace. */
function GuideDots({ segment, k, calm }: { segment: TraceSegment; k: number; calm: boolean }) {
  const [glows] = useState(() => Array.from({ length: 8 }, () => new Animated.Value(calm ? 0.6 : 0)));
  useEffect(() => {
    if (calm) return;
    const group = Animated.parallel(
      glows.map((v, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 100),
            Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: false }),
            Animated.timing(v, { toValue: 0, duration: 800, useNativeDriver: false }),
          ]),
        ),
      ),
    );
    group.start();
    return () => group.stop();
  }, [glows, calm]);
  const step = Math.floor(segment.pts.length / 9);
  if (step < 1) return null;
  const points = Array.from({ length: 8 }, (_, i) => segment.pts[(i + 1) * step]);
  return (
    <>
      {points.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={6 * k} fill="#D1D5DB" opacity={0.5} />
          <AnimatedCircle cx={p.x} cy={p.y} r={8 * k} fill="url(#glowGradient)" opacity={glows[i]} />
        </G>
      ))}
    </>
  );
}

function Sparkles({ x, y, k }: { x: number; y: number; k: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 12 }, (_, i) => (
        <Sparkle key={i} x={x} y={y} angle={(i * 30 * Math.PI) / 180} k={k} />
      ))}
    </View>
  );
}

function Sparkle({ x, y, angle, k }: { x: number; y: number; angle: number; k: number }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [anim]);
  const distance = 80 * k;
  return (
    <Animated.Text
      style={[
        styles.sparkle,
        {
          fontSize: 24 * k,
          left: x - 12 * k,
          top: y - 12 * k,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance] }) },
          ],
        },
      ]}
    >
      ✨
    </Animated.Text>
  );
}

function SuccessBadge({ top, calm, onRestart }: { top: number; calm: boolean; onRestart: () => void }) {
  const { t } = useT();
  const [scale] = useState(() => new Animated.Value(calm ? 1 : 0));
  useEffect(() => {
    if (!calm) Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 20, speed: 8 }).start();
  }, [scale, calm]);
  return (
    <Animated.View style={[styles.success, { top, transform: [{ scale }] }]} accessibilityLiveRegion="polite">
      <Text style={styles.successEmoji}>🎉</Text>
      <Text style={styles.successText}>{t('trace_success_title')}</Text>
      <Text style={styles.successSub}>{t('trace_success_sub')}</Text>
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.restartBtn, pressed && styles.pressed]} onPress={onRestart}>
        <Text style={styles.restartText}>{t('trace_again')}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Replay speed in canvas points per second (at the original size), and the pause between strokes. */
const REPLAY_SPEED = 480;
const REPLAY_MIN_MS = 380;
const REPLAY_PAUSE_MS = 160;
const SHINE_MS = 700;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Distance along a stroke at each of its points. */
function cumulativeLengths(pts: TracePoint[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return out;
}

/** The stroke drawn up to `fraction` of its length, and where the pen is. */
function partialStroke(pts: TracePoint[], lengths: number[], fraction: number): { d: string; tip: { x: number; y: number } } {
  const target = lengths[lengths.length - 1] * fraction;
  let i = 1;
  while (i < pts.length - 1 && lengths[i] < target) i++;
  const span = lengths[i] - lengths[i - 1] || 1;
  const f = Math.max(0, Math.min(1, (target - lengths[i - 1]) / span));
  const tip = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f };
  const d = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1, i).map((p) => `L ${p.x} ${p.y}`).join(' ') + ` L ${tip.x} ${tip.y}`;
  return { d, tip };
}

/**
 * After the child finishes, the letter writes itself again: each stroke is drawn in order, at a steady
 * handwriting pace with gentle easing, in glossy rainbow ink led by a glowing pen tip, with each
 * stroke's number appearing as it starts. A soft shine passes over the finished letter at the end.
 */
function LetterReplay({ segments, k, onDone }: { segments: TraceSegment[]; k: number; onDone: () => void }) {
  const [frame, setFrame] = useState({ seg: 0, fraction: 0, shine: 0 });
  const lengths = useMemo(() => segments.map((s) => cumulativeLengths(s.pts)), [segments]);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const durations = lengths.map((l) => Math.max(REPLAY_MIN_MS, (l[l.length - 1] / (REPLAY_SPEED * k)) * 1000));
    const starts = durations.map((_, i) => durations.slice(0, i).reduce((sum, d) => sum + d + REPLAY_PAUSE_MS, 0));
    const drawn = starts[starts.length - 1] + durations[durations.length - 1];
    let raf = 0;
    let begin: number | null = null;
    let finished = false;
    const tick = (now: number) => {
      begin ??= now;
      const t = now - begin;
      if (t >= drawn + SHINE_MS) {
        if (!finished) {
          finished = true;
          onDoneRef.current();
        }
        return;
      }
      if (t >= drawn) {
        setFrame({ seg: segments.length, fraction: 1, shine: (t - drawn) / SHINE_MS });
      } else {
        let seg = 0;
        while (seg < starts.length - 1 && t >= starts[seg + 1]) seg++;
        setFrame({ seg, fraction: easeInOut(Math.max(0, Math.min(1, (t - starts[seg]) / durations[seg]))), shine: 0 });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lengths, segments.length, k]);

  const strokes = segments.map((s, i) => {
    if (i < frame.seg) return { d: s.d, tip: null };
    if (i === frame.seg) return partialStroke(s.pts, lengths[i], frame.fraction);
    return null;
  });
  const current = strokes[frame.seg] ?? null;
  const shine = Math.sin(Math.PI * Math.min(1, frame.shine));

  return (
    <G>
      <Defs>
        <RadialGradient id="penGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="45%" stopColor="#FDE68A" stopOpacity={0.85} />
          <Stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {strokes.map((stroke, i) =>
        stroke && stroke.d ? (
          <G key={`ink-${i}`}>
            {/* Soft glow, glossy rainbow ink, and a thin highlight for a polished, rounded look. */}
            <Path d={stroke.d} stroke="url(#pathGradient)" strokeWidth={48 * k} strokeLinecap="round" strokeLinejoin="round" opacity={0.25} fill="none" />
            <Path d={stroke.d} stroke="url(#pathGradient)" strokeWidth={32 * k} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d={stroke.d} stroke="#FFFFFF" strokeWidth={7 * k} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} fill="none" />
          </G>
        ) : null,
      )}
      {segments.map((s, i) =>
        i <= frame.seg && i < segments.length ? (
          <G key={`num-${i}`} opacity={frame.shine > 0 ? 1 - frame.shine : 1}>
            <Circle cx={s.pts[0].x} cy={s.pts[0].y} r={13 * k} fill="#FFFFFF" stroke="#6366F1" strokeWidth={2.5 * k} />
            <SvgText x={s.pts[0].x} y={s.pts[0].y + 5 * k} fontSize={15 * k} fontWeight="bold" fill="#4338CA" textAnchor="middle">
              {String(i + 1)}
            </SvgText>
          </G>
        ) : null,
      )}
      {current?.tip ? (
        <G>
          <Circle cx={current.tip.x} cy={current.tip.y} r={26 * k} fill="url(#penGlow)" />
          <Circle cx={current.tip.x} cy={current.tip.y} r={8 * k} fill="#FFFFFF" stroke="#F59E0B" strokeWidth={2.5 * k} />
        </G>
      ) : null}
      {shine > 0
        ? segments.map((s, i) => <Path key={`shine-${i}`} d={s.d} stroke="#FFFFFF" strokeWidth={(32 + 18 * shine) * k} strokeLinecap="round" strokeLinejoin="round" opacity={0.55 * shine} fill="none" />)
        : null}
    </G>
  );
}

/** The finger-following puck for one stroke, with the rainbow trail of progress so far. */
function SegmentTracer({ segment, k, calm, disabled, onDone, onLost }: { segment: TraceSegment; k: number; calm: boolean; disabled: boolean; onDone: (score: number) => void; onLost: (lost: boolean) => void }) {
  const { t } = useT();
  const progressRef = useRef<SegmentProgress>(startProgress(segment));
  const done = useRef(false);
  const [index, setIndex] = useState(0);
  const [offTrack, setOffTrack] = useState(false);
  const [anim] = useState(() => ({ glow: new Animated.Value(0), pulse: new Animated.Value(1) }));
  const puckR = 20 * k;

  useEffect(() => {
    if (calm) return;
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(anim.glow, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(anim.glow, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim.pulse, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(anim.pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    glow.start();
    pulse.start();
    return () => {
      glow.stop();
      pulse.stop();
    };
  }, [anim, calm]);

  const move = (e: GestureResponderEvent) => {
    if (done.current) return;
    const { progress, onTrack } = moveAlong(segment, progressRef.current, { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }, k);
    progressRef.current = progress;
    setOffTrack(!onTrack);
    // Touching away from the path before starting usually means "I don't know where to begin".
    onLost(!onTrack && progress.index === 0);
    setIndex(progress.index);
    if (isSegmentDone(segment, progress)) {
      done.current = true;
      setTimeout(() => onDone(segmentScore(progress)), 300);
    }
  };

  const point = segment.pts[Math.min(index, segment.pts.length - 1)];
  const trail = `M ${segment.pts[0].x} ${segment.pts[0].y} ` + segment.pts.slice(1, index + 1).map((p) => `L ${p.x} ${p.y}`).join(' ');
  const glowColor = anim.glow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(34,197,94,0.0)', 'rgba(255,215,0,0.8)'] });

  return (
    <View
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={() => setOffTrack(false)}
      onResponderMove={move}
      onResponderRelease={() => setOffTrack(false)}
      accessible
      accessibilityLabel={t('trace_stroke_label', { n: Math.round((index / Math.max(1, segment.pts.length - 1)) * 100) })}
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="rainbowTrail" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#EC4899" stopOpacity={1} />
            <Stop offset="33%" stopColor="#8B5CF6" stopOpacity={1} />
            <Stop offset="66%" stopColor="#3B82F6" stopOpacity={1} />
            <Stop offset="100%" stopColor="#14B8A6" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Path d={trail} stroke={offTrack ? '#F59E0B' : 'url(#rainbowTrail)'} strokeWidth={16 * k} strokeLinecap="round" opacity={0.95} fill="none" />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.puck,
          { width: puckR * 2, height: puckR * 2, borderRadius: puckR, left: point.x - puckR, top: point.y - puckR, transform: [{ scale: anim.pulse }] },
          offTrack && styles.puckOff,
        ]}
      >
        <Animated.View style={[styles.puckGlow, { borderRadius: puckR + 14, backgroundColor: glowColor }]} />
        <Text style={[styles.puckArrow, { fontSize: 22 * k, lineHeight: 22 * k, transform: [{ rotate: `${point.angle}deg` }] }]}>→</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  canvasWrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  tiger: { position: 'absolute', zIndex: 1000 },
  speechBubble: {
    position: 'absolute',
    top: -40,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  speechText: { color: '#1F2937', fontSize: 13, fontWeight: '800' },
  sparkle: { position: 'absolute' },
  // The original's tip pill ("Trace along the glowing line"), at the top of the canvas.
  tip: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  tipLost: { borderWidth: 2, borderColor: '#F59E0B' },
  tipText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  puck: {
    position: 'absolute',
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 3,
    borderColor: '#FFA500',
  },
  // Off the path: amber rather than the original's red, following LexiLeap's "no red for mistakes" rule.
  puckOff: { backgroundColor: '#F59E0B', borderColor: '#D97706', shadowColor: '#F59E0B' },
  puckGlow: { position: 'absolute', top: -14, left: -14, right: -14, bottom: -14 },
  puckArrow: {
    color: 'white',
    fontWeight: '900',
    textAlign: 'center',
    marginTop: -2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  success: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(34,197,94,0.98)',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#FFF',
  },
  successEmoji: { fontSize: 64, marginBottom: 12 },
  successText: { color: 'white', fontSize: 32, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 },
  successSub: { color: 'white', fontSize: 16, textAlign: 'center', marginTop: 6, opacity: 0.95, fontWeight: '700' },
  restartBtn: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  restartText: { color: 'white', fontSize: 18, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
