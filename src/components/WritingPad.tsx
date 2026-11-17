import { useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { toSvgPath } from '@/activities/trace/geometry';
import type { InkStroke } from '@/handwriting/raster';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';

interface WritingPadProps {
  strokes: InkStroke[];
  onChange: (strokes: InkStroke[]) => void;
  size: number;
  disabled?: boolean;
  accessibilityLabel: string;
}

/** A square handwriting area with ruled guide lines, like the original Writing Challenge canvas. */
export function WritingPad({ strokes, onChange, size, disabled, accessibilityLabel }: WritingPadProps) {
  const { colors } = useTheme();
  // Several move events can arrive between renders, so the stroke being drawn lives in a ref.
  const ink = useRef<InkStroke[]>(strokes);
  const point = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
  const commit = (next: InkStroke[]) => {
    ink.current = next;
    onChange(next);
  };

  return (
    <View
      style={[styles.pad, { width: size, height: size, backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={accessibilityLabel}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      // A new stroke starts from what's on screen, which may have been cleared since the last one.
      onResponderGrant={(e) => commit([...strokes, [point(e)]])}
      onResponderMove={(e) => {
        const current = ink.current;
        commit([...current.slice(0, -1), [...(current[current.length - 1] ?? []), point(e)]]);
      }}
    >
      <Svg width={size} height={size} pointerEvents="none">
        {/* Handwriting-paper guides: top line, dashed middle line, and the baseline letters sit on. */}
        <Line x1={12} x2={size - 12} y1={size * 0.25} y2={size * 0.25} stroke={colors.guide} strokeWidth={1.5} strokeDasharray="6 6" />
        <Line x1={12} x2={size - 12} y1={size * 0.5} y2={size * 0.5} stroke={colors.guide} strokeWidth={1.5} strokeDasharray="6 6" />
        <Line x1={12} x2={size - 12} y1={size * 0.75} y2={size * 0.75} stroke={colors.ink} strokeWidth={2} />
        {strokes.map((stroke, i) => (
          <InkPath key={i} stroke={stroke} width={Math.max(10, size / 24)} color={colors.text} />
        ))}
      </Svg>
    </View>
  );
}

function InkPath({ stroke, width, color }: { stroke: InkStroke; width: number; color: string }) {
  // A single tap draws a dot (e.g. on i and j).
  const d = stroke.length === 1 ? `${toSvgPath(stroke)} l0.1 0` : toSvgPath(stroke);
  return <Path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

/** A small picture of what the child wrote, fitted to the box. */
export function InkThumbnail({ strokes, size }: { strokes: InkStroke[]; size: number }) {
  const { colors } = useTheme();
  const frame = [styles.thumb, { width: size, height: size, backgroundColor: colors.surface, borderColor: colors.border }];
  const points = strokes.flat();
  if (points.length === 0) return <View style={frame} />;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  const box = Math.max(width, height, 1) * 1.4;
  const viewBox = `${minX + width / 2 - box / 2} ${minY + height / 2 - box / 2} ${box} ${box}`;
  return (
    <View style={frame}>
      <Svg width={size} height={size} viewBox={viewBox}>
        {strokes.map((stroke, i) => (
          <InkPath key={i} stroke={stroke} width={box / 12} color={colors.text} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { alignSelf: 'center', borderRadius: 24, borderWidth: 2, overflow: 'hidden', ...DT.shadow.medium },
  thumb: { borderRadius: 10, borderWidth: 1 },
});
