import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Image as SvgImage, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { LETTER_EXAMPLES, spokenLetterName } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { generateTraceRounds, type TraceRound } from '../generators';
import type { ActivityDefinition, RoundProps } from '../types';
import { toSvgPath, type Point } from './geometry';
import { GLYPH_BOX, isLowercase } from './glyphs';
import { buildGuide, initialTracerState, nextTarget, touchEnd, touchMove, touchStart, traceProgress, traceScore, type TracerState } from './tracer';
import { useT } from '@/i18n';

/** The visible area in glyph units (a little margin around the glyph box). */
const VIEW = { x: -6, y: 0, width: GLYPH_BOX.width + 12, height: GLYPH_BOX.height };
const DEMO_STEP_MS = 28;
const BEE = require('../../../assets/images/bee.png');
const HONEY = require('../../../assets/images/honey.png');
/** Bee and honey size in glyph units. */
const SPRITE = 16;

/** Heading (degrees) from `a` to `b`; the bee artwork faces up, hence +90. */
const headingOf = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;

function TraceRoundView({ round, disabled, onAnswer, accent }: RoundProps<TraceRound>) {
  const { t } = useT();
  const { colors, space } = useTheme();
  const guide = useMemo(() => buildGuide(round.glyph), [round.glyph]);
  const [tracer, setTracer] = useState<TracerState>(initialTracerState);
  const [ink, setInk] = useState<Point[][]>([]);
  /** Index the demo bee has reached along the current stroke, or null when not demoing. */
  const [demo, setDemo] = useState<number | null>(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  // Several touch events can arrive between renders, so handlers read and write the
  // latest tracer state through refs rather than the (possibly stale) render values.
  const tracerRef = useRef<TracerState>(tracer);
  const inkRef = useRef<Point[][]>(ink);
  const finished = useRef(false);

  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopDemo = () => {
    if (demoTimer.current) clearInterval(demoTimer.current);
    demoTimer.current = null;
    setDemo(null);
  };
  useEffect(() => () => {
    if (demoTimer.current) clearInterval(demoTimer.current);
  }, []);

  const commit = (next: TracerState, nextInk: Point[][]) => {
    tracerRef.current = next;
    inkRef.current = nextInk;
    setTracer(next);
    setInk(nextInk);
    if (next.done && !finished.current) {
      finished.current = true;
      // Completing the letter is always a success; the score reflects how neatly it was traced.
      onAnswer({ correct: true, score: traceScore(next), glyph: round.glyph, final: true });
    }
  };

  /** Converts a touch position on the canvas into glyph units. */
  const toGlyph = (e: GestureResponderEvent): Point => {
    const { width, height } = layout;
    const scale = Math.min(width / VIEW.width, height / VIEW.height);
    const offsetX = (width - VIEW.width * scale) / 2;
    const offsetY = (height - VIEW.height * scale) / 2;
    return {
      x: (e.nativeEvent.locationX - offsetX) / scale + VIEW.x,
      y: (e.nativeEvent.locationY - offsetY) / scale + VIEW.y,
    };
  };

  const canTrace = () => !disabled && !finished.current;
  const onGrant = (e: GestureResponderEvent) => {
    stopDemo();
    const p = toGlyph(e);
    commit(touchStart(guide, tracerRef.current, p), [...inkRef.current, [p]]);
  };
  const onMove = (e: GestureResponderEvent) => {
    const p = toGlyph(e);
    const strokes = inkRef.current;
    const lastStroke = strokes[strokes.length - 1] ?? [];
    commit(touchMove(guide, tracerRef.current, p), [...strokes.slice(0, -1), [...lastStroke, p]]);
  };
  const onEnd = () => commit(touchEnd(tracerRef.current), inkRef.current);

  const reset = () => {
    stopDemo();
    finished.current = false;
    commit(initialTracerState(), []);
  };

  /** The original's demo: the bee flies along the next stroke, leaving a dotted golden trail. */
  const showMe = () => {
    stopDemo();
    const count = guide.checkpoints[tracerRef.current.strokeIndex].length;
    let i = 0;
    demoTimer.current = setInterval(() => {
      if (i >= count) return stopDemo();
      setDemo(i);
      i += 1;
    }, DEMO_STEP_MS);
  };

  const target = nextTarget(guide, tracer);
  const current = tracer.strokeIndex;
  const faded = round.faded;
  const arrow = !tracer.done && !faded ? arrowFor(guide.checkpoints[current]) : null;
  const strokePoints = guide.checkpoints[current];
  const honey = !tracer.done ? strokePoints[strokePoints.length - 1] : null;
  // The bee follows the demo, or the child's finger while they trace.
  const lastInk = ink[ink.length - 1];
  const bee =
    demo !== null
      ? { at: strokePoints[demo], heading: headingOf(strokePoints[Math.max(0, demo - 1)], strokePoints[Math.min(strokePoints.length - 1, demo + 1)]) }
      : tracer.fingerDown && lastInk && lastInk.length > 1
        ? { at: lastInk[lastInk.length - 1], heading: headingOf(lastInk[Math.max(0, lastInk.length - 4)], lastInk[lastInk.length - 1]) }
        : null;
  const example = LETTER_EXAMPLES.find((e) => e.letter === round.glyph.toLowerCase());

  return (
    <View style={[styles.root, { gap: space(3) }]}>
      <View style={styles.titleCard}>
        <AppText variant="heading" center>
          {t(isLowercase(round.glyph) ? 'round_trace_small' : 'round_trace_capital', { letter: round.glyph })}
        </AppText>
        {example ? (
          <AppText variant="label" center muted>
            {t('round_letter_for', { letter: round.glyph, word: `${example.emoji} ${example.word}` })}
          </AppText>
        ) : null}
      </View>
      <View
        style={[styles.canvas, { borderColor: colors.border }]}
        onLayout={(e: LayoutChangeEvent) => setLayout(e.nativeEvent.layout)}
        accessible
        accessibilityLabel={`Tracing area for the letter ${round.glyph}. ${Math.round(traceProgress(guide, tracer) * 100)} percent done.`}
        onStartShouldSetResponder={canTrace}
        onMoveShouldSetResponder={canTrace}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onEnd}
        onResponderTerminate={onEnd}
      >
        {layout.width > 0 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width="100%" height="100%" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}>
              {/* Handwriting lines: top, middle (dashed) and baseline. */}
              <Line x1={VIEW.x} x2={VIEW.x + VIEW.width} y1={GLYPH_BOX.top} y2={GLYPH_BOX.top} stroke={colors.border} strokeWidth={0.8} />
              <Line x1={VIEW.x} x2={VIEW.x + VIEW.width} y1={GLYPH_BOX.midline} y2={GLYPH_BOX.midline} stroke={colors.border} strokeWidth={0.8} strokeDasharray="3 3" />
              <Line x1={VIEW.x} x2={VIEW.x + VIEW.width} y1={GLYPH_BOX.baseline} y2={GLYPH_BOX.baseline} stroke={colors.textMuted} strokeWidth={1.2} />

              {guide.strokes.map((stroke, i) => {
                const complete = tracer.done || i < current;
                return (
                  <Path
                    key={`g${i}`}
                    d={toSvgPath(stroke)}
                    stroke={complete ? colors.success : colors.guide}
                    strokeOpacity={complete ? 0.9 : faded ? 0.28 : 1}
                    strokeWidth={15}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                );
              })}

              {/* Progress along the current stroke. */}
              {!tracer.done && tracer.checkpoint > 0 ? (
                <Path
                  d={toSvgPath(guide.checkpoints[current].slice(0, tracer.checkpoint))}
                  stroke={colors.success}
                  strokeWidth={15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}

              {/* The child's own finger trail. */}
              {ink.map((stroke, i) =>
                stroke.length > 1 ? (
                  <Path key={`i${i}`} d={toSvgPath(stroke)} stroke={colors.ink} strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ) : null,
              )}

              {arrow ? (
                <G opacity={0.9}>
                  <Path d={arrow.tail} stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" fill="none" />
                  <Polygon points={arrow.head} fill={colors.primary} />
                </G>
              ) : null}

              {target ? (
                <>
                  <Circle cx={target.x} cy={target.y} r={8} fill={colors.success} />
                  <SvgText x={target.x} y={target.y + 3.5} fontSize={10} fontWeight="bold" fill={colors.onPrimary} textAnchor="middle">
                    {String(current + 1)}
                  </SvgText>
                </>
              ) : null}

              {/* The honey pot waits at the end of the stroke. */}
              {honey && !faded ? <SvgImage href={HONEY} x={honey.x - SPRITE / 2} y={honey.y - SPRITE / 2} width={SPRITE} height={SPRITE} /> : null}

              {demo !== null ? (
                <Path
                  d={toSvgPath(strokePoints.slice(0, demo + 1))}
                  stroke="#F59E0B"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray="3 4"
                  fill="none"
                />
              ) : null}
              {bee ? (
                <G transform={`translate(${bee.at.x}, ${bee.at.y}) rotate(${bee.heading})`}>
                  <SvgImage href={BEE} x={-SPRITE / 2} y={-SPRITE / 2} width={SPRITE} height={SPRITE} />
                </G>
              ) : null}
            </Svg>
          </View>
        ) : null}
      </View>
      <View style={[styles.row, { gap: space(3) }]}>
        <Button label={t('round_show_me')} icon="eye" variant="secondary" compact disabled={disabled || tracer.done} onPress={showMe} style={styles.flex} color={accent} />
        <Button label={t('start_over')} icon="refresh" variant="secondary" compact disabled={disabled || tracer.done} onPress={reset} style={styles.flex} color={accent} />
      </View>
    </View>
  );
}

/** A small arrowhead a little way along the stroke, pointing the way to go. */
/**
 * The direction arrow at the start of a stroke: a short tail along the path and a slim head, so the
 * direction reads clearly at any angle (a wide, near-equilateral head looked like it pointed sideways
 * on diagonal strokes such as the top of C).
 */
function arrowFor(points: Point[]): { head: string; tail: string } | null {
  if (points.length < 5) return null;
  const tip = points[4];
  const from = points[1];
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const size = 7;
  const half = size * 0.45;
  const back = { x: tip.x - ux * size, y: tip.y - uy * size };
  const left = { x: back.x - uy * half, y: back.y + ux * half };
  const right = { x: back.x + uy * half, y: back.y - ux * half };
  return {
    head: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`,
    tail: toSvgPath(points.slice(1, 4)),
  };
}

export const trace: ActivityDefinition<TraceRound> = {
  meta: ACTIVITIES.trace,
  roundsPerSession: 5,
  maxAttempts: 1,
  generate: ({ level, rng, progress, focus }) => generateTraceRounds(level, rng, progress, 5, focus),
  prompt: (r) => `Trace the ${isLowercase(r.glyph) ? 'small' : 'capital'} letter ${spokenLetterName(r.glyph)}. Start at the green dot.`,
  timesResponses: false,
  stage: { image: require('../../../assets/images/meadow.jpg') },
  tour: [
    { title: 'tour_trace_bee_title', description: 'tour_trace_bee_desc' },
    { title: 'tour_trace_honey_title', description: 'tour_trace_honey_desc' },
  ],
  Round: TraceRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, paddingBottom: 8 },
  canvas: { flex: 1, borderRadius: 24, borderWidth: 1, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.88)' },
  titleCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 18, paddingVertical: 6, paddingHorizontal: 12 },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
});
