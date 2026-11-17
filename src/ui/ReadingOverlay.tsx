import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { OVERLAY_OPACITY, OVERLAYS } from '@/theme/palettes';
import { useTheme } from '@/theme/useTheme';

/**
 * Two optional reading aids drawn over the whole app:
 *  - a coloured tint, which some readers find reduces visual stress;
 *  - a reading ruler: a clear band with the rest of the screen dimmed, dragged by its handle.
 * Neither blocks touches except the ruler's handle.
 */
export function ReadingOverlay() {
  const { prefs } = useTheme();
  const tint = OVERLAYS[prefs.overlay]?.color ?? null;
  if (!tint && !prefs.readingRuler) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: OVERLAY_OPACITY }]} /> : null}
      {prefs.readingRuler ? <Ruler bandHeight={Math.round(96 * prefs.textScale)} /> : null}
    </View>
  );
}

const HANDLE_WIDTH = 44;

function Ruler({ bandHeight }: { bandHeight: number }) {
  const { colors } = useTheme();
  const { t } = useT();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const minY = insets.top;
  const maxY = Math.max(minY, height - insets.bottom - bandHeight);

  const initialY = Math.round(height * 0.35);
  const [y] = useState(() => new Animated.Value(initialY));
  /** Latest band position (Animated values can't be read synchronously). */
  const current = useRef(initialY);
  const drag = useRef({ pageY: 0, startY: 0 });
  const clamp = (value: number) => Math.min(maxY, Math.max(minY, value));

  // Keep the band on screen after rotation or a change of band size.
  useEffect(() => {
    const clamped = Math.min(maxY, Math.max(minY, current.current));
    current.current = clamped;
    y.setValue(clamped);
  }, [minY, maxY, y]);

  const onGrant = (e: GestureResponderEvent) => {
    drag.current = { pageY: e.nativeEvent.pageY, startY: current.current };
  };
  const onMove = (e: GestureResponderEvent) => {
    const next = clamp(drag.current.startY + e.nativeEvent.pageY - drag.current.pageY);
    current.current = next;
    y.setValue(next);
  };

  const dim = 'rgba(20, 18, 14, 0.45)';
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[styles.dim, { top: 0, height: y, backgroundColor: dim }]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.dim, { top: Animated.add(y, bandHeight), bottom: 0, backgroundColor: dim }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.edge, { top: y, height: bandHeight, borderColor: colors.star }]}
      />
      <Animated.View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('ruler_label')}
        style={[styles.handle, { top: y, height: bandHeight, backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Ionicons name="reorder-three" size={28} color={colors.text} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', left: 0, right: 0 },
  edge: { position: 'absolute', left: 0, right: 0, borderTopWidth: 2, borderBottomWidth: 2 },
  handle: {
    position: 'absolute',
    right: 0,
    width: HANDLE_WIDTH,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
