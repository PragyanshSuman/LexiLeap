import { goBackOr } from './navigation';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BACK_BUTTON, BackButton } from './BackButton';

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Defaults to going back. Pass null to hide the back button. */
  onBack?: (() => void) | null;
  right?: ReactNode;
}

// Kept here too so existing screens can import it from the header.
export { goBackOr };

/**
 * The screen header: the standard back button (always at the same spot, see BACK_BUTTON), the title and
 * subtitle, and an optional control on the right. Spans the whole width so the back button stays at the
 * left edge on tablets too.
 */
export function Header({ title, subtitle, onBack, right }: HeaderProps) {
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const back = onBack === undefined ? () => goBackOr('/') : onBack;
  return (
    <View
      style={[
        styles.row,
        { paddingTop: BACK_BUTTON.top, paddingBottom: space(2), paddingLeft: insets.left + BACK_BUTTON.left, paddingRight: insets.right + space(4), gap: space(3) },
      ]}
    >
      {back ? <BackButton onPress={back} /> : null}
      <View style={styles.titles}>
        <AppText variant="heading" numberOfLines={1} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', width: '100%' },
  titles: { flex: 1, minHeight: BACK_BUTTON.size, justifyContent: 'center' },
});
