import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';
import { svgPath } from './geometry';
import { CANVAS_CONFIG } from './letterPaths';
import type { IdealPathData, Point } from './types';

/** The original zoomed in on the letter by this much. */
const ZOOM = 1.35;
const DEMO_MS = 4000;

interface WritingCanvasProps {
  idealPath: IdealPathData;
  width: number;
  height: number;
  /** 'write': the child writes freely over a faint letter. 'demo': the letter writes itself, on a loop. */
  mode?: 'write' | 'demo';
  disabled?: boolean;
  onTouchStart?: (x: number, y: number) => void;
  onTouchMove?: (x: number, y: number, pressure: number) => void;
  onTouchEnd?: () => void;
  accessibilityLabel?: string;
}

/** The view onto the letter, in the letter's own coordinates, centred on it and zoomed as in the original. */
function viewBoxFor(idealPath: IdealPathData, width: number, height: number) {
  const pts = idealPath.points;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = pts.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : CANVAS_CONFIG.width / 2;
  const cy = pts.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : CANVAS_CONFIG.height / 2;
  const w = CANVAS_CONFIG.width / ZOOM;
  const h = CANVAS_CONFIG.height / ZOOM;
  const minX = cx - w / 2 - 35;
  const minY = cy - h / 2 - 35;
  const scale = Math.min(width / w, height / h);
  return { minX, minY, w, h, scale, offsetX: (width - w * scale) / 2, offsetY: (height - h * scale) / 2 };
}

/**
 * Remount with a new `key` to clear the ink.
 *
 * The original Letter Mastery canvas: a dark slate with the letter as a faint ghost, thick white ink,
 * and a soft fingertip glow. In demo mode the letter writes itself with a pointing hand.
 */
export function WritingCanvas({ idealPath, width, height, mode = 'write', disabled, onTouchStart, onTouchMove, onTouchEnd, accessibilityLabel }: WritingCanvasProps) {
  const { prefs } = useTheme();
  const demo = mode === 'demo';
  const view = viewBoxFor(idealPath, width, height);
  const [ink, setInk] = useState<{ done: Point[][]; current: Point[] }>({ done: [], current: [] });
  const [finger, setFinger] = useState<Point | null>(null);
  const [demoStep, setDemoStep] = useState(0);
  const current = useRef<Point[]>([]);

  // Demo: step through every point of the ideal path over four seconds, then start again.
  useEffect(() => {
    if (!demo || idealPath.points.length === 0) return;
    if (prefs.reduceMotion) return;
    const total = idealPath.points.length;
    const started = Date.now();
    const id = setInterval(() => setDemoStep(Math.floor((((Date.now() - started) % DEMO_MS) / DEMO_MS) * total)), 33);
    return () => clearInterval(id);
  }, [demo, idealPath, prefs.reduceMotion]);

  const toLetter = (e: GestureResponderEvent): Point => ({
    x: (e.nativeEvent.locationX - view.offsetX) / view.scale + view.minX,
    y: (e.nativeEvent.locationY - view.offsetY) / view.scale + view.minY,
  });

  const begin = (e: GestureResponderEvent) => {
    const p = toLetter(e);
    current.current = [p];
    setInk((s) => ({ ...s, current: [p] }));
    setFinger(p);
    onTouchStart?.(p.x, p.y);
  };
  const move = (e: GestureResponderEvent) => {
    const p = toLetter(e);
    current.current = [...current.current, p];
    setInk((s) => ({ ...s, current: current.current }));
    setFinger(p);
    // iOS reports finger and Apple Pencil force; others report nothing, which counts as an even press.
    onTouchMove?.(p.x, p.y, e.nativeEvent.force || 1);
  };
  const end = () => {
    const stroke = current.current;
    current.current = [];
    // A tap of a few points is a stray touch, as in the original.
    setInk((s) => ({ done: stroke.length > 5 ? [...s.done, stroke] : s.done, current: [] }));
    setFinger(null);
    onTouchEnd?.();
  };

  // With calm motion the demo simply shows the finished letter.
  const demoIndex = prefs.reduceMotion ? idealPath.points.length - 1 : demoStep;
  const boundaries = idealPath.strokeBoundaries;
  const strokePath = (i: number) => svgPath(idealPath.points.slice(boundaries[i], boundaries[i + 1]));
  // Demo progress: strokes already drawn, and the part of the current one.
  let demoStroke = 0;
  while (demo && demoStroke < boundaries.length - 2 && demoIndex >= boundaries[demoStroke + 1]) demoStroke++;
  const demoDone = demo ? Array.from({ length: demoStroke }, (_, i) => strokePath(i)) : [];
  const demoCurrent = demo ? svgPath(idealPath.points.slice(boundaries[demoStroke], demoIndex + 1)) : '';
  const hand = demo ? idealPath.points[Math.min(demoIndex, idealPath.points.length - 1)] : null;

  return (
    <View
      style={[styles.container, { width, height, backgroundColor: demo ? '#131F24' : '#1C2938' }]}
      onStartShouldSetResponder={() => !demo && !disabled}
      onMoveShouldSetResponder={() => !demo && !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={begin}
      onResponderMove={move}
      onResponderRelease={end}
      onResponderTerminate={end}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Svg pointerEvents="none" width={width} height={height} viewBox={`${view.minX} ${view.minY} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet">
        {demo ? (
          <G opacity={0.2}>
            <Line x1={0} y1={CANVAS_CONFIG.baseline} x2={CANVAS_CONFIG.width} y2={CANVAS_CONFIG.baseline} stroke="#52656d" strokeWidth={2} strokeDasharray="10,10" />
            <Line x1={CANVAS_CONFIG.centerX} y1={0} x2={CANVAS_CONFIG.centerX} y2={CANVAS_CONFIG.height} stroke="#52656d" strokeWidth={2} strokeDasharray="10,10" />
            <Line x1={0} y1={CANVAS_CONFIG.centerY} x2={CANVAS_CONFIG.width} y2={CANVAS_CONFIG.centerY} stroke="#52656d" strokeWidth={2} strokeDasharray="10,10" />
          </G>
        ) : null}

        {/* The letter as a faint ghost. */}
        <G opacity={demo ? 0.15 : 0.08}>
          {boundaries.slice(0, -1).map((_, i) => (
            <Path key={`ghost-${i}`} d={strokePath(i)} stroke={demo ? '#BCBCBC' : '#fff'} strokeWidth={demo ? 40 : 45} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </G>

        {/* Numbered start of each stroke (demo only). */}
        {demo
          ? boundaries.slice(0, -1).map((start, i) => {
              const p = idealPath.points[start];
              if (!p) return null;
              return (
                <G key={`hint-${i}`}>
                  <Circle cx={p.x} cy={p.y} r={18} fill="#37464F" />
                  <SvgText x={p.x} y={p.y + 6} fill="#fff" fontSize="16" fontWeight="bold" textAnchor="middle">
                    {String(i + 1)}
                  </SvgText>
                </G>
              );
            })
          : null}

        {demoDone.map((d, i) => (
          <Path key={`demo-${i}`} d={d} stroke="#fff" strokeWidth={20} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        ))}
        {demoCurrent ? <Path d={demoCurrent} stroke="#fff" strokeWidth={20} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

        {ink.done.map((stroke, i) => (
          <Path key={`ink-${i}`} d={svgPath(stroke)} stroke="#fff" strokeWidth={20} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        ))}
        {ink.current.length > 0 ? <Path d={svgPath(ink.current)} stroke="#fff" strokeWidth={20} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {finger ? <Circle cx={finger.x} cy={finger.y} r={25} fill="#fff" opacity={0.25} /> : null}
      </Svg>

      {hand ? (
        <View pointerEvents="none" style={[styles.hand, { left: (hand.x - view.minX) * view.scale + view.offsetX - 20, top: (hand.y - view.minY) * view.scale + view.offsetY }]}>
          <Text style={styles.handEmoji}>👆</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#37464F' },
  hand: { position: 'absolute', transform: [{ rotate: '-15deg' }] },
  handEmoji: { fontSize: 40 },
});
