import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LETTER_EXAMPLES, spokenLetterName } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { useT } from '@/i18n';
import { AppText } from '@/ui/AppText';
import { AmbientOrbs, GuidedTracer, TRACE_BACKGROUND, type LetterTraced } from '@/tracing/GuidedTracer';
import { canvasFor } from '@/tracing/seriLetters';
import { generateTraceRounds, type TraceRound } from '../generators';
import type { ActivityDefinition, RoundProps } from '../types';
import { isLowercase } from './glyphs';

/**
 * A tracing round in a Learning Path or daily-plan session, using the original app's guided tracer
 * (glowing dots, the yellow puck, the tiger and the end-of-letter reward), so tracing looks the same
 * everywhere in the app.
 */
function TraceRoundView({ round, disabled, onAnswer }: RoundProps<TraceRound>) {
  const { t } = useT();
  const [area, setArea] = useState({ width: 0, height: 0 });
  const example = LETTER_EXAMPLES.find((e) => e.letter === round.glyph.toLowerCase());

  const traced = ({ score, letter }: LetterTraced) => onAnswer({ correct: true, score, glyph: letter, final: true });
  const canvas = area.width > 0 ? canvasFor(area.width, area.height) : null;
  // The tiger is drawn for a full screen; keep it smaller on the runner's shorter stage.
  const tigerScale = canvas ? Math.min(0.6, area.height / 1100) : 0.5;

  return (
    <View style={styles.root}>
      <View style={styles.titleCard}>
        <AppText variant="heading" center color="#0F172A">
          {t(isLowercase(round.glyph) ? 'round_trace_small' : 'round_trace_capital', { letter: round.glyph })}
        </AppText>
        {example ? (
          <AppText variant="label" center color="#475569">
            {t('round_letter_for', { letter: round.glyph, word: `${example.emoji} ${example.word}` })}
          </AppText>
        ) : null}
      </View>
      <View style={styles.stage} onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {canvas ? (
          <>
            <AmbientOrbs width={area.width} height={area.height} />
            <GuidedTracer
              letter={round.glyph}
              canvas={canvas}
              onTraced={traced}
              reportAt="reward"
              successBadge={false}
              announce={false}
              tigerScale={tigerScale}
              faded={round.faded}
              disabled={disabled}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

export const trace: ActivityDefinition<TraceRound> = {
  meta: ACTIVITIES.trace,
  roundsPerSession: 5,
  maxAttempts: 1,
  generate: ({ level, rng, progress, focus }) => generateTraceRounds(level, rng, progress, 5, focus),
  prompt: (r) => `Trace the ${isLowercase(r.glyph) ? 'small' : 'capital'} letter ${spokenLetterName(r.glyph)}. Follow the glowing dots.`,
  timesResponses: false,
  stage: { colors: [...TRACE_BACKGROUND.light] },
  tour: [
    { title: 'tracing_tour_guide_title', description: 'tracing_tour_guide_desc' },
    { title: 'tour_trace_reward_title', description: 'tour_trace_reward_desc' },
  ],
  Round: TraceRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, paddingBottom: 8, gap: 8 },
  titleCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 18, paddingVertical: 6, paddingHorizontal: 12 },
  stage: { flex: 1, overflow: 'hidden', borderRadius: 24 },
});
