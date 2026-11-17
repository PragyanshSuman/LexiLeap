import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { DT } from '@/theme/dyslexiaTheme';
import { AppText } from '@/ui/AppText';

const NAVY = 'rgba(46, 74, 122, 1)';
const LABEL = 'rgba(100, 116, 139, 1)';

/** A smooth line chart in the original dashboard's style (navy curve, dotted points, 0–100 scale). */
export function TrendChart({ points, width, height = 200, accessibilityLabel }: { points: { label: string; value: number }[]; width: number; height?: number; accessibilityLabel: string }) {
  const left = 40;
  const right = 16;
  const top = 16;
  const bottom = 32;
  const w = Math.max(10, width - left - right);
  const h = height - top - bottom;
  const x = (i: number) => left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => top + h - (Math.max(0, Math.min(100, v)) / 100) * h;
  const coords = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
  // Smooth curve through the points (like chart-kit's "bezier" option).
  const d = coords.reduce((path, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = coords[i - 1];
    const mid = (prev.x + p.x) / 2;
    return `${path} C ${mid} ${prev.y}, ${mid} ${p.y}, ${p.x} ${p.y}`;
  }, '');
  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height}>
        {[0, 25, 50, 75, 100].map((v) => (
          <G key={v}>
            <Line x1={left} x2={left + w} y1={y(v)} y2={y(v)} stroke={LABEL} strokeOpacity={0.2} strokeDasharray="5,5" />
            <SvgText x={left - 8} y={y(v) + 4} fontSize={11} fill={LABEL} textAnchor="end">
              {String(v)}
            </SvgText>
          </G>
        ))}
        {coords.length > 1 ? <Path d={d} stroke={NAVY} strokeWidth={3} fill="none" /> : null}
        {coords.map((p, i) => (
          <G key={i}>
            <Circle cx={p.x} cy={p.y} r={6} fill={NAVY} stroke={DT.accent.navy} strokeWidth={2} />
            <SvgText x={p.x} y={height - 10} fontSize={11} fill={LABEL} textAnchor="middle">
              {points[i].label}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}

export interface PieSlice {
  name: string;
  count: number;
  color: string;
}

/** A pie chart with its legend on the right, as in the original dashboard. */
export function StatusPie({ slices, width, height = 180 }: { slices: PieSlice[]; width: number; height?: number }) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  const r = Math.min(height / 2 - 6, width / 4);
  const cx = 15 + r;
  const cy = height / 2;
  const shown = slices.filter((s) => s.count > 0);
  const sweeps = shown.map((s) => (s.count / Math.max(1, total)) * Math.PI * 2);
  const starts = sweeps.map((_, i) => -Math.PI / 2 + sweeps.slice(0, i).reduce((sum, v) => sum + v, 0));
  const point = (a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  const arcs = shown.map((s, i) => {
    const sweep = sweeps[i];
    // A single slice is a whole circle (an SVG arc can't start and end at the same point).
    if (sweep >= Math.PI * 2 - 1e-6) return { ...s, d: null };
    return { ...s, d: `M ${cx} ${cy} L ${point(starts[i])} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(starts[i] + sweep)} Z` };
  });
  return (
    <View style={styles.pieRow} accessible accessibilityLabel={slices.map((s) => `${s.count} ${s.name}`).join(', ')}>
      <Svg width={cx + r + 10} height={height}>
        {arcs.map((a) => (a.d ? <Path key={a.name} d={a.d} fill={a.color} /> : <Circle key={a.name} cx={cx} cy={cy} r={r} fill={a.color} />))}
      </Svg>
      <View style={styles.legend}>
        {slices.map((s) => (
          <View key={s.name} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <AppText size={12} color={DT.text.primary}>{`${s.count} ${s.name}`}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pieRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  legend: { flex: 1, gap: 8, paddingLeft: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
});
