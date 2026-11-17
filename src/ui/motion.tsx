import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Style of the inner pressable (the outer animated view carries `style`). */
  innerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** How far it shrinks while pressed (the original app used 0.95). */
  pressedScale?: number;
}

/**
 * The original app's press feel: a spring that squashes the element while pressed
 * and bounces back on release. Disabled when the child prefers calm motion.
 */
export function PressableScale({ style, innerStyle, children, pressedScale = 0.95, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const { prefs } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const spring = (toValue: number, friction?: number) => {
    if (prefs.reduceMotion) return;
    Animated.spring(scale, { toValue, friction, useNativeDriver: true }).start();
  };
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        style={innerStyle}
        onPressIn={(e) => {
          spring(pressedScale);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          spring(1, 3);
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Fades and slides content up into place, staggered by `index`. */
export function FadeInUp({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { prefs } = useTheme();
  const [progress] = useState(() => new Animated.Value(prefs.reduceMotion ? 1 : 0));
  useEffect(() => {
    if (prefs.reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, { toValue: 1, duration: 420, delay: index * 60, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, index, prefs.reduceMotion]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** A gentle, continuous bob (used for mascots and highlights). */
export function Bob({ children, distance = 6, duration = 1400 }: { children: ReactNode; distance?: number; duration?: number }) {
  const { prefs } = useTheme();
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (prefs.reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -distance, duration, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [prefs.reduceMotion, y, distance, duration]);
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
}

/** Springs content in from nothing, staggered by `index` (the original games' card entrance). */
export function PopIn({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { prefs } = useTheme();
  const [scale] = useState(() => new Animated.Value(prefs.reduceMotion ? 1 : 0));
  useEffect(() => {
    if (prefs.reduceMotion) return;
    const animation = Animated.spring(scale, { toValue: 1, tension: 50, friction: 7, delay: index * 80, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [scale, index, prefs.reduceMotion]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}
