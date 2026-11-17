import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { IconButton } from './Button';

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Defaults to going back. Pass null to hide the back button. */
  onBack?: (() => void) | null;
  right?: ReactNode;
}

export function goBackOr(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export function Header({ title, subtitle, onBack, right }: HeaderProps) {
  const { space } = useTheme();
  const back = onBack === undefined ? () => goBackOr('/') : onBack;
  return (
    <View style={[styles.row, { paddingHorizontal: space(4), paddingVertical: space(2), gap: space(3) }]}>
      {back ? <IconButton icon="chevron-back" label="Go back" onPress={back} /> : null}
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
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  titles: { flex: 1 },
});
