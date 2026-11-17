import { View } from 'react-native';
import { useT, type TranslationKey } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useAppStore } from '@/store/appStore';
import type { Profile } from '@/store/profile';
import { FONT_ORDER, FONTS } from '@/theme/fonts';
import { OVERLAYS, PALETTES, type OverlayName, type ThemeName } from '@/theme/palettes';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ChoiceChips, SettingRow, Stepper, ToggleRow } from '@/ui/controls';

const SPACING_LABELS: TranslationKey[] = ['spacing_normal', 'spacing_wide', 'spacing_extra'];

/** Reading-comfort preferences for one child. Changes apply instantly across the app. */
export function ReadingSettings({ profile }: { profile: Profile }) {
  const { colors, space } = useTheme();
  const feedback = useFeedback();
  const { t } = useT();
  const updatePrefs = useAppStore((s) => s.updatePrefs);
  const prefs = profile.prefs;
  const set = (patch: Partial<typeof prefs>) => updatePrefs(profile.id, patch);

  return (
    <View style={{ gap: space(1) }}>
      <Card style={{ gap: space(2), backgroundColor: colors.surface }}>
        <AppText variant="caption" muted>
          {t('comfort_preview')}
        </AppText>
        <AppText variant="heading">b d p q · was saw</AppText>
        <AppText>The little fox jumps over the big log.</AppText>
      </Card>

      <SettingRow title={t('comfort_font')} description={t(`font_${prefs.font}`)}>
        <ChoiceChips accessibilityLabel={t('comfort_font')} value={prefs.font} onChange={(font) => set({ font })} options={FONT_ORDER.map((f) => ({ value: f, label: FONTS[f].label }))} />
      </SettingRow>

      <SettingRow title={t('comfort_text_size')}>
        <Stepper label={t('comfort_text_size')} value={prefs.textScale} min={0.9} max={1.5} step={0.1} onChange={(textScale) => set({ textScale })} format={(v) => `${Math.round(v * 100)}%`} />
      </SettingRow>

      <SettingRow title={t('comfort_spacing')} description={t('comfort_spacing_desc')}>
        <ChoiceChips
          accessibilityLabel={t('comfort_spacing')}
          value={prefs.spacing}
          onChange={(spacing) => set({ spacing })}
          options={([0, 1, 2] as const).map((v) => ({ value: v, label: t(SPACING_LABELS[v]) }))}
        />
      </SettingRow>

      <SettingRow title={t('comfort_colours')} description={t('comfort_colours_desc')}>
        <ChoiceChips
          accessibilityLabel={t('comfort_colours')}
          value={prefs.theme}
          onChange={(theme) => set({ theme })}
          options={(Object.keys(PALETTES) as ThemeName[]).map((name) => ({ value: name, label: t(`theme_${name}`), swatch: PALETTES[name].bg }))}
        />
      </SettingRow>

      <SettingRow title={t('comfort_overlay')} description={t('comfort_overlay_desc')}>
        <ChoiceChips
          accessibilityLabel={t('comfort_overlay')}
          value={prefs.overlay}
          onChange={(overlay) => set({ overlay })}
          options={(Object.keys(OVERLAYS) as OverlayName[]).map((o) => ({ value: o, label: t(`overlay_${o}`), swatch: OVERLAYS[o].color }))}
        />
      </SettingRow>

      <ToggleRow
        title={t('reading_ruler')}
        description={t('comfort_ruler_desc')}
        value={prefs.readingRuler}
        onChange={(readingRuler) => set({ readingRuler })}
      />
      <ToggleRow title={t('comfort_calm')} description={t('comfort_calm_desc')} value={prefs.reduceMotion} onChange={(reduceMotion) => set({ reduceMotion })} />
      <ToggleRow title={t('sound_effects')} value={prefs.sound} onChange={(sound) => set({ sound })} />
      <ToggleRow title={t('comfort_vibration')} value={prefs.haptics} onChange={(haptics) => set({ haptics })} />

      <SettingRow title={t('comfort_voice_speed')}>
        <Stepper
          label={t('comfort_voice_speed')}
          value={prefs.voiceRate}
          min={0.6}
          max={1.1}
          step={0.05}
          onChange={(voiceRate) => set({ voiceRate })}
          format={(v) => `${t(v < 0.75 ? 'voice_slow' : v < 0.95 ? 'voice_steady' : 'voice_quick')} (${Math.round(v * 100)}%)`}
        />
        <Button label={t('comfort_test_voice')} icon="volume-high" variant="secondary" compact onPress={() => feedback.say('comfort_voice_sample')} />
      </SettingRow>
    </View>
  );
}
