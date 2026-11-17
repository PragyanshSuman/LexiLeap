import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useT, type TranslationKey } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useActiveProfile, useAppStore } from '@/store/appStore';
import { OVERLAYS, type OverlayName } from '@/theme/palettes';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';

const NAV: { icon: string; label: TranslationKey; href: string }[] = [
  { icon: '🏠', label: 'nav_home', href: '/home' },
  { icon: '🧭', label: 'nav_path', href: '/path' },
  { icon: '🎮', label: 'nav_all_activities', href: '/play' },
  { icon: '🏆', label: 'nav_rewards', href: '/rewards' },
  { icon: '📄', label: 'journey_title', href: '/journey' },
  { icon: '👓', label: 'nav_reading', href: '/comfort' },
  { icon: '🔒', label: 'nav_parent', href: '/parent-gate' },
];

/** The original app's side drawer, wired to LexiLeap's per-child settings. */
export function SidebarContent(props: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const updatePrefs = useAppStore((s) => s.updatePrefs);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);
  if (!profile) return null;
  const { prefs } = profile;
  const set = (patch: Partial<typeof prefs>) => updatePrefs(profile.id, patch);

  const go = (href: string) => {
    feedback.tap();
    props.navigation.closeDrawer();
    router.push(href as never);
  };

  const logout = () => {
    feedback.tap();
    props.navigation.closeDrawer();
    setActiveProfile(null);
    router.replace('/login');
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={['#4F46E5', '#3730A3']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.profileRow}>
          <View style={styles.avatar}>
            <AppText size={30} fixed>
              {profile.avatar}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="heading" color="#FFFFFF" numberOfLines={1}>
              {profile.name}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.8)">
              {t('drawer_role')}
            </AppText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll}>
        {NAV.map((item) => (
          <Pressable
            key={item.href}
            accessibilityRole="button"
            accessibilityLabel={t(item.label)}
            onPress={() => go(item.href)}
            style={({ pressed }) => [styles.navItem, pressed && { backgroundColor: colors.primarySoft }]}
          >
            <AppText size={20} fixed style={styles.navIcon}>
              {item.icon}
            </AppText>
            <AppText variant="label">{t(item.label)}</AppText>
          </Pressable>
        ))}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AppText variant="caption" weight="bold" muted style={styles.sectionTitle}>
          {t('select_language')}
        </AppText>
        <LanguagePicker />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AppText variant="caption" weight="bold" muted style={styles.sectionTitle}>
          {t('visual_support')}
        </AppText>
        <View style={styles.settingRow}>
          <View style={styles.flex}>
            <AppText variant="label">{t('reading_ruler')}</AppText>
            <AppText variant="caption" muted>
              {t('reading_ruler_desc')}
            </AppText>
          </View>
          <Switch
            accessibilityLabel={t('reading_ruler')}
            value={prefs.readingRuler}
            onValueChange={(readingRuler) => set({ readingRuler })}
            trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
          />
        </View>

        <AppText variant="caption" weight="bold" muted style={styles.sectionTitle}>
          {t('colour_overlay')}
        </AppText>
        <View style={styles.colorRow} accessibilityRole="radiogroup" accessibilityLabel="Colour overlay">
          {(Object.keys(OVERLAYS) as OverlayName[]).map((name) => {
            const selected = prefs.overlay === name;
            return (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(`overlay_${name}`)}
                onPress={() => set({ overlay: name })}
                style={[
                  styles.colorOption,
                  { backgroundColor: OVERLAYS[name].color ?? '#FFFFFF' },
                  selected && styles.colorSelected,
                ]}
              >
                {name === 'none' ? <View style={styles.slash} /> : null}
                {selected ? (
                  <AppText size={16} fixed weight="bold" color="#3730A3">
                    ✓
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AppText variant="caption" weight="bold" muted style={styles.sectionTitle}>
          {t('preferences')}
        </AppText>
        <View style={styles.settingRow}>
          <AppText variant="label" style={styles.flex}>
            {t('animations')}
          </AppText>
          <Switch
            accessibilityLabel={t('animations')}
            value={!prefs.reduceMotion}
            onValueChange={(on) => set({ reduceMotion: !on })}
            trackColor={{ false: '#CBD5E1', true: '#10B981' }}
          />
        </View>
        <View style={styles.settingRow}>
          <AppText variant="label" style={styles.flex}>
            {t('sound_effects')}
          </AppText>
          <Switch
            accessibilityLabel={t('sound_effects')}
            value={prefs.sound}
            onValueChange={(sound) => set({ sound })}
            trackColor={{ false: '#CBD5E1', true: '#10B981' }}
          />
        </View>
      </DrawerContentScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('logout')} onPress={logout} style={styles.logout}>
          <AppText size={18} fixed>
            🚪
          </AppText>
          <AppText variant="label" color={colors.danger}>
            {t('logout')}
          </AppText>
        </Pressable>
        <AppText variant="caption" muted center size={11}>
          v1.0.0 · LexiLeap
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { padding: 24, paddingTop: 16, borderBottomRightRadius: 30 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingTop: 12, paddingHorizontal: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, gap: 14 },
  navIcon: { width: 28, textAlign: 'center' },
  divider: { height: 1, marginVertical: 16, marginHorizontal: 12 },
  sectionTitle: { marginHorizontal: 12, marginBottom: 10 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 12 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 12 },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  colorSelected: { borderColor: '#4F46E5', borderWidth: 3 },
  slash: { position: 'absolute', width: 2, height: 52, backgroundColor: '#EF4444', transform: [{ rotate: '45deg' }] },
  footer: { padding: 16, borderTopWidth: 1, gap: 6 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#FEF2F2' },
});
