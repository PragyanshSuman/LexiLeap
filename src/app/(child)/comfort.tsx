import { ReadingSettings } from '@/components/ReadingSettings';
import { DrawerScreenHeader } from '@/components/HomeParts';
import { useT } from '@/i18n';
import { useActiveProfile } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Screen } from '@/ui/Screen';

export default function Comfort() {
  const { space } = useTheme();
  const { t } = useT();
  const profile = useActiveProfile();
  if (!profile) return null;
  return (
    <Screen scroll edges={['top']} header={<DrawerScreenHeader title={t('tile_comfort_title')} />}>
      <AppText muted style={{ marginVertical: space(4) }}>
        {t('comfort_intro')}
      </AppText>
      <ReadingSettings profile={profile} />
    </Screen>
  );
}
