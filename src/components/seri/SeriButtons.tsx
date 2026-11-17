import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';

/** The original app's outlined "i" button that opens a screen's feature tour. */
export function SeriInfoButton({ onPress, color = '#283593' }: { onPress: () => void; color?: string }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('tour_info')}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.info, { top: insets.top + 12, borderColor: color }, pressed && styles.pressed]}
    >
      <Text style={[styles.infoText, { color }]}>i</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  chevron: { marginLeft: -2 },
  info: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 100,
  },
  infoText: { fontSize: 20, fontWeight: '900', fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
  pressed: { opacity: 0.7 },
});
