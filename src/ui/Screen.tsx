import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Fixed content above the scrolling area (e.g. a header). */
  header?: ReactNode;
  /** Fixed content below the scrolling area (e.g. a main action). */
  footer?: ReactNode;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  padded?: boolean;
  /** Floats over the whole screen, outside the scrolling area (e.g. a status badge). */
  overlay?: ReactNode;
}

/** Widest the content gets; on landscape tablets it is centred instead of stretched. */
export const MAX_CONTENT_WIDTH = 720;

export function Screen({ children, scroll, header, footer, edges = ['top', 'bottom'], contentStyle, padded = true, overlay }: ScreenProps) {
  const { colors, space } = useTheme();
  const padding = padded ? { paddingHorizontal: space(5) } : null;
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.bg }]}>
      {header ? <View style={styles.column}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.column, padding, { paddingBottom: space(8) }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, styles.column, padding, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={[styles.column, padding, { paddingVertical: space(3) }]}>{footer}</View> : null}
      {overlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
