import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { spokenLetterName } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { generateSortRounds, parseFocusPair, type SortRound } from './generators';
import type { ActivityDefinition, RoundProps } from './types';

type Mouth = 'idle' | 'open' | 'eating';
type Side = 'left' | 'right';

const MONSTERS: Record<Side, { color: string; variant: 'horns' | 'ears' }> = {
  left: { color: '#EC4899', variant: 'horns' },
  right: { color: '#14B8A6', variant: 'ears' },
};
/** How close (px) the letter must be dropped to a monster's middle. */
const DROP_RADIUS = 120;

function LetterSortRoundView({ round, revealed, disabled, onAnswer, score }: RoundProps<SortRound>) {
  const { t } = useT();
  const { prefs } = useTheme();
  const feedback = useFeedback();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [pan] = useState(() => new Animated.ValueXY());
  const [cardScale] = useState(() => new Animated.Value(1));
  const [drag, setDrag] = useState<{ startX: number; startY: number; dx: number; dy: number } | null>(null);
  const [eating, setEating] = useState<Side | null>(null);
  const [done, setDone] = useState(false);

  const monsterSize = Math.min(140, box.width * 0.34);
  const centre = (side: Side) => ({ x: box.width * (side === 'left' ? 0.27 : 0.73), y: box.height - monsterSize / 2 - 40 });
  const cardHome = { x: box.width / 2, y: box.height * 0.3 };
  const card = drag ? { x: cardHome.x + drag.dx, y: cardHome.y + drag.dy } : cardHome;
  const near = (side: Side) => Math.hypot(card.x - centre(side).x, card.y - centre(side).y) < DROP_RADIUS * 1.4;
  const correctSide: Side = round.left === round.letter ? 'left' : 'right';

  const springBack = (shake: boolean) => {
    const back = Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: true });
    if (shake && !prefs.reduceMotion) {
      Animated.sequence([
        Animated.timing(pan, { toValue: { x: drag ? drag.dx + 20 : 20, y: drag?.dy ?? 0 }, duration: 50, useNativeDriver: true }),
        Animated.timing(pan, { toValue: { x: drag ? drag.dx - 20 : -20, y: drag?.dy ?? 0 }, duration: 50, useNativeDriver: true }),
        back,
      ]).start();
    } else {
      back.start();
    }
  };

  const feed = (side: Side) => {
    if (disabled || revealed || done) return;
    const eaten = side === 'left' ? round.left : round.right;
    if (eaten === round.letter) {
      setDone(true);
      setEating(side);
      const target = centre(side);
      Animated.parallel([
        Animated.timing(pan, { toValue: { x: target.x - cardHome.x, y: target.y - cardHome.y }, duration: 180, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
      feedback.speak('Yum!');
      onAnswer({ correct: true });
    } else {
      springBack(true);
      onAnswer({ correct: false, confusions: [[round.letter, eaten]] });
    }
    setDrag(null);
  };

  const onGrant = (e: GestureResponderEvent) => {
    if (disabled || revealed || done) return;
    setDrag({ startX: e.nativeEvent.pageX, startY: e.nativeEvent.pageY, dx: 0, dy: 0 });
    Animated.spring(cardScale, { toValue: 1.2, friction: 3, useNativeDriver: true }).start();
  };
  const onMove = (e: GestureResponderEvent) => {
    if (!drag) return;
    const dx = e.nativeEvent.pageX - drag.startX;
    const dy = e.nativeEvent.pageY - drag.startY;
    pan.setValue({ x: dx, y: dy });
    setDrag({ ...drag, dx, dy });
  };
  const onRelease = () => {
    if (!drag) return;
    Animated.spring(cardScale, { toValue: 1, useNativeDriver: true }).start();
    const dropped = (['left', 'right'] as Side[]).find((side) => Math.hypot(card.x - centre(side).x, card.y - centre(side).y) < DROP_RADIUS);
    if (dropped) feed(dropped);
    else {
      springBack(false);
      setDrag(null);
    }
  };

  const look = (side: Side) => {
    const c = centre(side);
    const clamp = (v: number) => Math.max(-8, Math.min(8, v));
    return { x: clamp(((card.x - c.x) / (box.width || 1)) * 24), y: clamp(((card.y - c.y) / (box.height || 1)) * 24) };
  };
  const mouthOf = (side: Side): Mouth => (eating === side ? 'eating' : drag && near(side) ? 'open' : 'idle');

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <View style={styles.hud}>
        <AppText variant="label" weight="bold" color="#FFFFFF">
          {t('game_feed')}
        </AppText>
        <AppText variant="label" weight="bold" color="#FCD34D" fixed>
          {`${t('game_score')}: ${score}`}
        </AppText>
      </View>

      {box.width > 0 ? (
        <>
          {(['left', 'right'] as Side[]).map((side) => (
            <View key={side} style={[styles.monsterSlot, { left: centre(side).x - monsterSize / 2 - 10, top: centre(side).y - monsterSize / 2 - 50, width: monsterSize + 20 }]}>
              <Monster
                letter={side === 'left' ? round.left : round.right}
                color={MONSTERS[side].color}
                variant={MONSTERS[side].variant}
                size={monsterSize}
                mouth={mouthOf(side)}
                look={drag ? look(side) : { x: 0, y: 0 }}
                highlight={revealed && side === correctSide}
                onPress={() => feed(side)}
                label={t('game_hungry', { letter: side === 'left' ? round.left : round.right })}
              />
            </View>
          ))}

          <Animated.View
            onStartShouldSetResponder={() => !disabled && !revealed && !done}
            onMoveShouldSetResponder={() => !disabled && !revealed && !done}
            onResponderTerminationRequest={() => false}
            onResponderGrant={onGrant}
            onResponderMove={onMove}
            onResponderRelease={onRelease}
            onResponderTerminate={onRelease}
            accessible
            accessibilityLabel={`${spokenLetterName(round.letter)}. ${t('game_drag_me')}`}
            style={[styles.card, { left: cardHome.x - 50, top: cardHome.y - 50, transform: [...pan.getTranslateTransform(), { scale: cardScale }] }]}
          >
            <AppText size={60} fixed weight="bold" color={DT.accent.navy}>
              {round.letter}
            </AppText>
          </Animated.View>
          {!drag && !done ? (
            <View pointerEvents="none" style={[styles.hint, { top: cardHome.y + 60 }]}>
              <AppText variant="caption" weight="bold" color="rgba(255,255,255,0.75)">
                {t('game_drag_me')}
              </AppText>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

interface MonsterProps {
  letter: string;
  color: string;
  variant: 'horns' | 'ears';
  size: number;
  mouth: Mouth;
  look: { x: number; y: number };
  highlight: boolean;
  label: string;
  onPress: () => void;
}

/** The original's monster: squircle body, letter badge, tracking eyes and a hungry mouth. */
function Monster({ letter, color, variant, size, mouth, look, highlight, label, onPress }: MonsterProps) {
  const { prefs } = useTheme();
  const [breathe] = useState(() => new Animated.Value(1));
  const [chomp] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (prefs.reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.03, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, prefs.reduceMotion]);

  useEffect(() => {
    if (prefs.reduceMotion) return;
    if (mouth === 'open') Animated.spring(chomp, { toValue: 1.15, useNativeDriver: true }).start();
    else if (mouth === 'eating')
      Animated.sequence([
        Animated.timing(chomp, { toValue: 1.3, duration: 100, useNativeDriver: true }),
        Animated.timing(chomp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    else Animated.spring(chomp, { toValue: 1, useNativeDriver: true }).start();
  }, [mouth, chomp, prefs.reduceMotion]);

  const eye = size * 0.26;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.monsterPress}>
      <Animated.View style={[styles.monster, { transform: [{ scale: Animated.multiply(breathe, chomp) }] }]}>
        {variant === 'horns' ? (
          <>
            <View style={[styles.horn, styles.hornLeft, { borderBottomColor: color }]} />
            <View style={[styles.horn, styles.hornRight, { borderBottomColor: color }]} />
          </>
        ) : (
          <>
            <View style={[styles.ear, styles.earLeft, { backgroundColor: color }]} />
            <View style={[styles.ear, styles.earRight, { backgroundColor: color }]} />
          </>
        )}
        <View style={[styles.body, { width: size, height: size, borderRadius: size * 0.43, backgroundColor: color }, highlight && styles.bodyHighlight]}>
          <View style={[styles.badge, { borderColor: color }]}>
            <AppText size={22} fixed weight="bold" color={color}>
              {letter}
            </AppText>
          </View>
          <View style={styles.eyes}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.eye, { width: eye, height: eye, borderRadius: eye / 2 }]}>
                <View style={[styles.pupil, { transform: [{ translateX: look.x }, { translateY: look.y }] }]} />
                <View style={styles.shine} />
              </View>
            ))}
          </View>
          <View style={[styles.mouth, mouth === 'idle' && styles.mouthIdle, mouth === 'open' && styles.mouthOpen, mouth === 'eating' && styles.mouthEating]}>
            {mouth === 'idle' ? <View style={styles.tooth} /> : <View style={styles.tongue} />}
          </View>
        </View>
      </Animated.View>
      <View style={styles.label}>
        <AppText variant="caption" weight="bold" color={color} center numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

export const letterSort: ActivityDefinition<SortRound> = {
  meta: ACTIVITIES['letter-sort'],
  roundsPerSession: 10,
  maxAttempts: 2,
  generate: ({ level, rng, focus }) => generateSortRounds(level, rng, 10, parseFocusPair(focus)),
  prompt: (r) => `Who is hungry for ${spokenLetterName(r.letter)}?`,
  reveal: (r) => `This monster eats the letter ${spokenLetterName(r.letter)}.`,
  stage: { colors: ['#1E1B4B', '#312E81'], dark: true },
  tour: [
    { title: 'tour_sorting_welcome_title', description: 'tour_sorting_welcome_desc' },
    { title: 'tour_sorting_drag_title', description: 'tour_sorting_drag_desc' },
  ],
  Round: LetterSortRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  card: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FCD34D',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  hint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  monsterSlot: { position: 'absolute', alignItems: 'center' },
  monsterPress: { alignItems: 'center' },
  monster: { alignItems: 'center', justifyContent: 'flex-end', paddingTop: 30 },
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 2,
  },
  bodyHighlight: { borderColor: '#4ADE80', borderWidth: 8 },
  badge: {
    position: 'absolute',
    top: -15,
    right: -15,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '15deg' }],
    zIndex: 10,
  },
  eyes: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  eye: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#00000020' },
  pupil: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1E293B' },
  shine: { position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF', opacity: 0.7 },
  mouth: { width: 56, height: 20, borderRadius: 10, backgroundColor: '#333333', overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center' },
  mouthIdle: { height: 10, width: 40 },
  mouthOpen: { height: 44, width: 56, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  mouthEating: { height: 36, width: 64, borderRadius: 18 },
  tongue: { width: 36, height: 26, backgroundColor: '#F472B6', borderTopLeftRadius: 18, borderTopRightRadius: 18, marginBottom: -8 },
  tooth: { width: 10, height: 6, backgroundColor: '#FFFFFF', alignSelf: 'flex-start', marginLeft: 8, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  horn: {
    position: 'absolute',
    top: 8,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 40,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 1,
  },
  hornLeft: { left: 14, transform: [{ rotate: '-30deg' }] },
  hornRight: { right: 14, transform: [{ rotate: '30deg' }] },
  ear: { position: 'absolute', top: 14, width: 40, height: 40, borderRadius: 20, borderWidth: 4, borderColor: 'rgba(0,0,0,0.1)', zIndex: 1 },
  earLeft: { left: 0 },
  earRight: { right: 0 },
  label: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
});
