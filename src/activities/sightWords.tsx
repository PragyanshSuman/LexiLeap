import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { areLookalikes } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { generateNinjaRounds, type NinjaRound } from './generators';
import type { ActivityDefinition, RoundProps } from './types';

/** Gentle cruising speed (px per ms) and how far words bob up and down. */
const CRUISE = 0.06;
const BOB = 18;
const HIT_PADDING = 16;
const WRONG_COOLDOWN_MS = 500;

interface Sprite {
  text: string;
  x: number;
  baseY: number;
  y: number;
  vx: number;
  cruise: number;
  phase: number;
  width: number;
  height: number;
  popped: boolean;
  flashUntil: number;
  lastHit: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

/** What gets drawn each frame: a snapshot of the moving sprites. */
interface Scene {
  sprites: { text: string; x: number; y: number; popped: boolean; flash: boolean }[];
  particles: Particle[];
}

const estimateWidth = (text: string) => text.length * 22 + 50;

function WordNinjaRoundView({ round, revealed, disabled, onAnswer, score }: RoundProps<NinjaRound>) {
  const { t } = useT();
  const { prefs } = useTheme();
  const feedback = useFeedback();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [scene, setScene] = useState<Scene>({ sprites: [], particles: [] });
  const [trail, setTrail] = useState('');
  const sprites = useRef<Sprite[]>([]);
  const particles = useRef<Particle[]>([]);
  const points = useRef<{ x: number; y: number }[]>([]);
  const solved = useRef(false);
  const gestureUsed = useRef(false);
  const calm = prefs.reduceMotion;

  /** Copies the mutable game state into React state for drawing. */
  const publish = useCallback(() => {
    const now = Date.now();
    setScene({
      sprites: sprites.current.map((s) => ({ text: s.text, x: s.x, y: s.y, popped: s.popped, flash: s.flashUntil > now })),
      particles: particles.current.map((p) => ({ ...p })),
    });
  }, []);

  // Place the words in three lanes once the play area is measured.
  useEffect(() => {
    if (box.width === 0) return;
    const top = 70;
    const laneHeight = (box.height - top - 40) / round.words.length;
    sprites.current = round.words.map((text, i) => {
      const width = estimateWidth(text);
      const fromLeft = i % 2 === 0;
      const cruise = CRUISE * (0.8 + Math.random() * 0.7);
      const baseY = top + i * laneHeight + laneHeight * 0.25;
      const x = calm ? (box.width - width) * (0.15 + 0.35 * i) : fromLeft ? -width * (0.3 + i * 0.5) : box.width + i * 40;
      return { text, x, baseY, y: baseY, vx: fromLeft ? cruise : -cruise, cruise, phase: Math.random() * Math.PI * 2, width, height: 70, popped: false, flashUntil: 0, lastHit: 0 };
    });
    publish();
  }, [box, round.words, calm, publish]);

  // The floating animation loop.
  useEffect(() => {
    if (box.width === 0 || calm || revealed) return;
    let frameId = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(48, now - last);
      last = now;
      for (const s of sprites.current) {
        if (s.popped) continue;
        // After a knock-back, ease back towards the cruising speed in the original direction.
        const target = Math.sign(s.vx || 1) * s.cruise;
        s.vx += (target - s.vx) * 0.02;
        s.x += s.vx * dt;
        s.y = s.baseY + Math.sin(now / 330 + s.phase) * BOB;
        if (s.vx > 0 && s.x > box.width + 20) s.x = -s.width - 20;
        if (s.vx < 0 && s.x < -s.width - 20) s.x = box.width + 20;
      }
      particles.current = particles.current
        .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + 0.0015 * dt, life: p.life - dt / 650 }))
        .filter((p) => p.life > 0);
      publish();
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [box.width, calm, revealed, publish]);

  const burst = (x: number, y: number) => {
    if (calm) return;
    const colors = ['#4ADE80', '#FACC15', '#60A5FA', '#F472B6'];
    particles.current = Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2;
      const speed = 0.15 + Math.random() * 0.2;
      return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.1, life: 1, color: colors[i % colors.length] };
    });
  };

  const hitTest = (x: number, y: number) => {
    if (disabled || revealed || solved.current || gestureUsed.current) return;
    const now = Date.now();
    const sprite = sprites.current.find(
      (s) => !s.popped && x >= s.x - HIT_PADDING && x <= s.x + s.width + HIT_PADDING && y >= s.y - HIT_PADDING && y <= s.y + s.height + HIT_PADDING,
    );
    if (!sprite) return;
    if (sprite.text === round.target) {
      solved.current = true;
      gestureUsed.current = true;
      sprite.popped = true;
      burst(sprite.x + sprite.width / 2, sprite.y + sprite.height / 2);
      publish();
      onAnswer({ correct: true });
    } else if (now - sprite.lastHit > WRONG_COOLDOWN_MS) {
      gestureUsed.current = true;
      sprite.lastHit = now;
      sprite.flashUntil = now + 600;
      // Knock the word away from the blade, then it drifts back to cruising.
      sprite.vx = Math.sign(sprite.x + sprite.width / 2 - x || 1) * 0.5;
      feedback.speak(sprite.text);
      publish();
      onAnswer({ correct: false, confusions: areLookalikes(round.target, sprite.text) ? [[round.target, sprite.text]] : undefined });
    }
  };

  const point = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
  const drawTrail = () => setTrail(points.current.map((p, i) => `${i === 0 ? 'M' : 'L'}${Math.round(p.x)} ${Math.round(p.y)}`).join(' '));

  const onGrant = (e: GestureResponderEvent) => {
    gestureUsed.current = false;
    const p = point(e);
    points.current = [p];
    hitTest(p.x, p.y);
  };
  const onMove = (e: GestureResponderEvent) => {
    const p = point(e);
    const prev = points.current[points.current.length - 1] ?? p;
    // Check along the stroke so a quick swipe can't skip over a word.
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / 12));
    for (let i = 1; i <= steps; i++) hitTest(prev.x + ((p.x - prev.x) * i) / steps, prev.y + ((p.y - prev.y) * i) / steps);
    points.current = [...points.current.slice(-7), p];
    drawTrail();
  };
  const onEnd = () => {
    points.current = [];
    setTrail('');
  };

  return (
    <View
      style={styles.root}
      onLayout={(e: LayoutChangeEvent) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}
    >
      <View pointerEvents="none" style={styles.hud}>
        <View style={styles.target}>
          <AppText variant="heading" weight="bold" color={DT.accent.navy} fixed>
            {t('game_find_target', { word: round.target })}
          </AppText>
        </View>
        <View style={styles.scoreChip}>
          <AppText variant="caption" weight="bold" muted fixed>
            {t('game_score')}
          </AppText>
          <AppText variant="heading" weight="bold" color={DT.accent.navy} fixed>
            {String(score)}
          </AppText>
        </View>
      </View>

      {scene.sprites.map((s, i) =>
        s.popped ? null : (
          <View
            key={`${s.text}-${i}`}
            pointerEvents="none"
            onLayout={(e) => {
              // Use the real bubble size for hit-testing.
              const model = sprites.current[i];
              if (model) {
                model.width = e.nativeEvent.layout.width;
                model.height = e.nativeEvent.layout.height;
              }
            }}
            style={[
              styles.bubble,
              { left: s.x, top: s.y },
              revealed && s.text === round.target && styles.bubbleReveal,
              s.flash && styles.bubbleWrong,
            ]}
          >
            <AppText size={34} fixed weight="bold" color={DT.accent.navy}>
              {s.text}
            </AppText>
          </View>
        ),
      )}

      {scene.particles.map((p, i) => (
        <View key={i} pointerEvents="none" style={[styles.particle, { left: p.x, top: p.y, opacity: Math.max(0, p.life), backgroundColor: p.color }]} />
      ))}

      <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
        {trail ? <Path d={trail} stroke={DT.accent.navy} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
      </Svg>

      {/* For screen readers, which can't swipe: the words as buttons. */}
      <View style={styles.srOnly}>
        {round.words.map((w) => (
          <View
            key={w}
            accessible
            accessibilityRole="button"
            accessibilityLabel={w}
            onAccessibilityTap={() => {
              const s = sprites.current.find((sp) => sp.text === w);
              if (s) hitTest(s.x + 1, s.y + 1);
            }}
          />
        ))}
      </View>
    </View>
  );
}

export const sightWords: ActivityDefinition<NinjaRound> = {
  meta: ACTIVITIES['sight-words'],
  roundsPerSession: 5,
  maxAttempts: 3,
  generate: ({ level, rng }) => generateNinjaRounds(level, rng, 5),
  prompt: (r) => `Find... ${r.target}.`,
  reveal: (r) => `This word is ${r.target}.`,
  tour: [
    { title: 'tour_ninja_welcome_title', description: 'tour_ninja_welcome_desc' },
    { title: 'tour_ninja_slice_title', description: 'tour_ninja_slice_desc' },
    { title: 'tour_ninja_calm_title', description: 'tour_ninja_calm_desc' },
  ],
  Round: WordNinjaRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, zIndex: 2 },
  target: { backgroundColor: DT.bg.lemon, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 2, borderColor: DT.accent.gold },
  scoreChip: { alignItems: 'flex-end' },
  bubble: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderWidth: 3,
    borderColor: DT.accent.navy,
    ...DT.shadow.soft,
  },
  bubbleReveal: { borderColor: '#16A34A', backgroundColor: '#DCFCE7', borderWidth: 4 },
  bubbleWrong: { borderColor: '#DC2626', backgroundColor: '#FEE2E2' },
  particle: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
