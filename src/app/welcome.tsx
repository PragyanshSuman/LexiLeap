import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LanguagePicker } from '@/components/LanguagePicker';
import { ACTIVITY_ORDER } from '@/engine/catalog';
import { useT, type TranslationKey } from '@/i18n';
import { useAppStore } from '@/store/appStore';
import { ThemeScope, useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const POINTS: { emoji: string; title: TranslationKey; text: TranslationKey }[] = [
  { emoji: '🧩', title: 'welcome_point_activities_title', text: 'welcome_point_activities_text' },
  { emoji: '🧭', title: 'welcome_point_adapts_title', text: 'welcome_point_adapts_text' },
  { emoji: '👓', title: 'welcome_point_dyslexia_title', text: 'welcome_point_dyslexia_text' },
  { emoji: '🔒', title: 'welcome_point_private_title', text: 'welcome_point_private_text' },
];

export default function Welcome() {
  return (
    <ThemeScope>
      <WelcomeContent />
    </ThemeScope>
  );
}

function WelcomeContent() {
  const { space } = useTheme();
  const { t } = useT();
  const hasParent = useAppStore((s) => s.parent !== null);
  return (
    <Screen
      scroll
      footer={
        <Button
          label={t('get_started')}
          icon="arrow-forward"
          onPress={() => router.push(hasParent ? '/register' : '/setup/pin')}
        />
      }
    >
      <View style={[styles.hero, { gap: space(2), paddingVertical: space(8) }]}>
        <AppText size={72} style={{ lineHeight: 88 }}>
          🦊
        </AppText>
        <AppText variant="title" center accessibilityRole="header">
          {t('welcome_title')}
        </AppText>
        <AppText center muted>
          {t('welcome_subtitle')}
        </AppText>
      </View>
      <LanguagePicker compact />
      <View style={{ gap: space(3) }}>
        {POINTS.map((p) => (
          <Card key={p.title} style={styles.row}>
            <AppText size={30} style={{ lineHeight: 38 }}>
              {p.emoji}
            </AppText>
            <View style={styles.flex}>
              <AppText variant="label">{t(p.title, { n: ACTIVITY_ORDER.length })}</AppText>
              <AppText variant="caption" muted>
                {t(p.text)}
              </AppText>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center' },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  flex: { flex: 1 },
});
