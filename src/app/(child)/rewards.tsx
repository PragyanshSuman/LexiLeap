import { StyleSheet, View } from 'react-native';
import { DrawerScreenHeader } from '@/components/HomeParts';
import { BADGES } from '@/engine/badges';
import { currentStreak } from '@/engine/streak';
import { dayKey } from '@/lib/date';
import { badgeKey, useT } from '@/i18n';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { SectionTitle } from '@/ui/controls';
import { Screen } from '@/ui/Screen';

export default function Rewards() {
  const { colors, space } = useTheme();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const { t } = useT();
  const earned = BADGES.filter((b) => progress.badges[b.id]).length;
  const traced = Object.values(progress.letters).filter((l) => l.best >= 0.5).length;

  const stats = [
    { emoji: '⭐', value: progress.stars, label: t('rewards_stars') },
    { emoji: '🔥', value: currentStreak(progress.streak, dayKey()), label: t('rewards_streak', { n: progress.streak.best }) },
    { emoji: '🔤', value: traced, label: t('rewards_letters') },
    { emoji: '🏅', value: earned, label: t('rewards_badges_of', { n: BADGES.length }) },
  ];

  return (
    <Screen scroll edges={['top']} header={<DrawerScreenHeader title={t('nav_rewards')} subtitle={t('rewards_subtitle')} />}>
      <View style={[styles.stats, { gap: space(3), marginTop: space(4) }]}>
        {stats.map((s) => (
          <Card key={s.label} style={styles.stat} accessibilityLabel={`${s.value} ${s.label}`}>
            <AppText size={28} style={{ lineHeight: 36 }}>
              {s.emoji}
            </AppText>
            <AppText variant="title">{String(s.value)}</AppText>
            <AppText variant="caption" muted center>
              {s.label}
            </AppText>
          </Card>
        ))}
      </View>

      <SectionTitle>{t('rewards_badges')}</SectionTitle>
      <View style={[styles.badges, { gap: space(3) }]}>
        {BADGES.map((b) => {
          const has = !!progress.badges[b.id];
          return (
            <View
              key={b.id}
              accessible
              accessibilityLabel={`${t(badgeKey(b.id, 'title'))}. ${t(badgeKey(b.id, 'desc'))} ${has ? t('badge_earned') : t('badge_not_earned')}`}
              style={[
                styles.badge,
                { backgroundColor: has ? colors.surface : colors.surfaceAlt, borderColor: has ? colors.star : colors.border },
              ]}
            >
              <AppText size={36} style={[{ lineHeight: 44 }, !has && styles.locked]}>
                {has ? b.emoji : '🔒'}
              </AppText>
              <AppText variant="caption" weight="semibold" center numberOfLines={2}>
                {t(badgeKey(b.id, 'title'))}
              </AppText>
              <AppText variant="caption" muted center numberOfLines={3} size={11}>
                {t(badgeKey(b.id, 'desc'))}
              </AppText>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { flexBasis: '46%', flexGrow: 1, alignItems: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badge: { width: '31%', minHeight: 150, borderRadius: 18, borderWidth: 2, padding: 8, alignItems: 'center', gap: 2 },
  locked: { opacity: 0.6 },
});
