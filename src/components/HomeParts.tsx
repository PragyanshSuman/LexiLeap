import { useNavigation } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { BACK_BUTTON, BackButton } from '@/ui/BackButton';
import { PressableScale } from '@/ui/motion';

/**
 * Section label followed by a hairline, as on the original Home screen. Sentence case rather than the
 * original's capitals: all-caps words lose their shape and are harder to read for dyslexic readers.
 */
export function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader} accessibilityRole="header">
      <AppText variant="label" weight="bold" color={colors.textMuted} style={styles.sectionText}>
        {title}
      </AppText>
      <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

interface MenuCardProps {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  onPress: () => void;
  width: number;
}

/** The original two-column module card: soft gradient, tinted icon tile, title, subtitle and chevron. */
export function MenuCard({ title, subtitle, icon, color, onPress, width }: MenuCardProps) {
  const { colors, prefs } = useTheme();
  const feedback = useFeedback();
  const dark = PALETTE_IS_DARK(prefs.theme);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={[styles.card, { width, backgroundColor: colors.surface, shadowColor: colors.shadow }]}
      innerStyle={styles.cardInner}
    >
      <LinearGradient colors={dark ? [colors.surface, colors.surfaceAlt] : ['#FFFFFF', '#F8FAFC']} style={styles.cardGradient}>
        <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}>
          <AppText size={24} fixed>
            {icon}
          </AppText>
        </View>
        <View style={styles.cardInfo}>
          <AppText variant="label" weight="bold" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1} size={12}>
            {subtitle}
          </AppText>
        </View>
        <AppText color={colors.textMuted} size={20} fixed>
          ›
        </AppText>
      </LinearGradient>
    </PressableScale>
  );
}

const PALETTE_IS_DARK = (theme: string) => theme === 'dusk';

/** The lavender ☰ button that opens the side drawer. */
export function MenuButton() {
  const navigation = useNavigation();
  const { t } = useT();
  const { colors, prefs } = useTheme();
  const feedback = useFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('open_menu')}
      hitSlop={6}
      onPress={() => {
        feedback.tap();
        navigation.dispatch(DrawerActions.openDrawer());
      }}
      style={({ pressed }) => [
        styles.menuButton,
        { backgroundColor: prefs.theme === 'cream' ? DT.bg.lavender : colors.surfaceAlt },
        pressed && styles.pressed,
      ]}
    >
      <AppText size={24} fixed color={colors.primary}>
        ☰
      </AppText>
    </Pressable>
  );
}

/**
 * Title row for Play, Rewards and Reading settings: the standard back button (to Home) at the same spot
 * as on every other screen. The side menu stays on Home (☰) and opens with a swipe from the edge.
 */
export function DrawerScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
      <BackButton fallback="/home" />
      <View style={styles.flex}>
        <AppText variant="heading" numberOfLines={1} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 25, marginBottom: 15 },
  sectionText: { marginRight: 15 },
  sectionLine: { flex: 1, height: 1 },
  card: { borderRadius: DT.radius.xl, ...DT.shadow.soft },
  cardInner: { borderRadius: DT.radius.xl, overflow: 'hidden' },
  cardGradient: { padding: 16, flexDirection: 'row', alignItems: 'center', minHeight: 80 },
  iconBox: { width: 48, height: 48, borderRadius: DT.radius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: 12, marginRight: 4 },
  menuButton: { width: 44, height: 44, borderRadius: DT.radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingLeft: BACK_BUTTON.left, paddingRight: 20, paddingTop: BACK_BUTTON.top, paddingBottom: 12, borderBottomWidth: 1 },
});
