import { router } from 'expo-router';
import { DrawerScreenHeader } from '@/components/HomeParts';
import { StyleSheet, View } from 'react-native';
import { activitiesForSkill, ACTIVITIES, SKILL_ORDER, SKILLS } from '@/engine/catalog';
import type { ActivityId } from '@/engine/types';
import { activityKey, skillKey, useT } from '@/i18n';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { SectionTitle, StarRow } from '@/ui/controls';
import { Screen } from '@/ui/Screen';

export default function Play() {
  const { space } = useTheme();
  const { t } = useT();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);

  const open = (id: ActivityId) => router.push(id === 'trace' ? '/letters' : `/activity/${id}`);

  return (
    <Screen scroll edges={['top']} header={<DrawerScreenHeader title={t('nav_all_activities')} />}>
      {SKILL_ORDER.map((skill) => (
        <View key={skill}>
          <SectionTitle>{`${SKILLS[skill].emoji} ${t(skillKey(skill))}`}</SectionTitle>
          <View style={{ gap: space(3) }}>
            {activitiesForSkill(skill).map((id) => {
              const meta = ACTIVITIES[id];
              const level = progress.activities[id]?.level ?? 1;
              return (
                <Card
                  key={id}
                  accent={meta.color}
                  onPress={() => open(id)}
                  accessibilityLabel={`${t(activityKey(id, 'title'))}. ${t(activityKey(id, 'tagline'))}.`}
                  style={[styles.row, { gap: space(4) }]}
                >
                  <View style={[styles.icon, { backgroundColor: meta.color + '22' }]}>
                    <AppText size={34} style={{ lineHeight: 42 }}>
                      {meta.emoji}
                    </AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="heading">{t(activityKey(id, 'title'))}</AppText>
                    <AppText variant="caption" muted>
                      {t(activityKey(id, 'tagline'))}
                    </AppText>
                  </View>
                  <StarRow count={level} size={16} />
                </Card>
              );
            })}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  icon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
