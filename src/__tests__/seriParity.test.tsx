import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { generateRhymeTrainRounds, generateVoiceVaultRounds } from '@/activities/generators';
import { rhymeTrain } from '@/activities/rhymeTrain';
import { voiceVault } from '@/activities/voiceVault';
import TracingLetterMenu from '@/app/tracing/letters';
import GuidedTracingScreen from '@/app/tracing/trace/[letter]';
import RhymeTime from '@/app/rhyme';
import { rhymesWith, RHYME_FAMILIES } from '@/content/rhymes';
import { emptyProgress } from '@/engine/progress';
import { createRng } from '@/lib/random';
import { findSpokenRhyme, rhymeTail, soundsRhyme } from '@/speech/rhyme';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_PREFS, type Profile } from '@/store/profile';
import { ALPHABET, buildSegments, canvasFor, letterFromParam, traceLetterFromParam, moveAlong, segmentScore, startProgress, isSegmentDone, SCALABLE_LETTERS } from '@/tracing/seriLetters';
import { FeatureExtractor, masteryScores } from '@/writing/featureExtractor';
import { generateIdealPath } from '@/writing/geometry';
import { LETTER_PATHS } from '@/writing/letterPaths';
import { letterStats, summarizeMastery } from '@/writing/mastery';
import type { MLFeatures } from '@/writing/types';

const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-camera', () => ({ useCameraPermissions: () => [null, jest.fn()], CameraView: () => null }));

// Speech: the recogniser "hears" whatever the test sets; the dictionary knows a few words.
let mockHeard: string[] = [];
jest.mock('@/services/speechRecognition', () => ({
  isSpeechRecognitionAvailable: () => true,
  listenForWord: async (_word: string, handlers: { onResult: (t: string[]) => void }) => {
    handlers.onResult(mockHeard);
    return () => undefined;
  },
}));
const SOUNDS: Record<string, string[]> = {
  cat: ['K', 'AE', 'T'],
  hat: ['HH', 'AE', 'T'],
  dog: ['D', 'AO', 'G'],
  splat: ['S', 'P', 'L', 'AE', 'T'],
  moon: ['M', 'UW', 'N'],
  balloon: ['B', 'AH', 'L', 'UW', 'N'],
  tiger: ['T', 'AY', 'G', 'ER'],
  letter: ['L', 'EH', 'T', 'ER'],
  better: ['B', 'EH', 'T', 'ER'],
};
jest.mock('@/services/pronunciationDictionary', () => ({
  pronounce: async (word: string) => ({ word, phonemes: SOUNDS[word] ?? [], source: 'dictionary', chunks: null }),
}));
jest.mock('@/services/sounds', () => ({ restoreAudioMode: jest.fn(), playSound: jest.fn(), configureAudio: jest.fn() }));

jest.setTimeout(30_000);

const profile: Profile = { id: 'kid', name: 'Ada', avatar: '🦊', age: 7, createdAt: '2026-01-01T00:00:00.000Z', prefs: { ...DEFAULT_PREFS } };
beforeEach(() => {
  useAppStore.setState({ profiles: [profile], activeProfileId: profile.id, parent: null, progress: { [profile.id]: emptyProgress() } });
});
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const progress = () => useAppStore.getState().progress[profile.id];

describe('guided tracer geometry', () => {
  it('uses the original 420-wide layout on phones and scales up on tablets, keeping a 2:3 canvas', () => {
    expect(canvasFor(430, 900)).toEqual({ width: 420, height: 630, k: 1 });
    // iPad Split View is phone-sized: it keeps the phone layout.
    expect(canvasFor(500, 1100).width).toBe(420);
    const ipadPortrait = canvasFor(820, 1100);
    expect(ipadPortrait.width).toBe(720);
    expect(ipadPortrait.k).toBeCloseTo(720 / 420);
    // iPad landscape is limited by height.
    const ipadLandscape = canvasFor(1180, 740);
    expect(ipadLandscape.height).toBeLessThanOrEqual(740);
    expect(ipadLandscape.width).toBeGreaterThan(420);
  });

  it('places every capital and small letter fully inside the canvas', () => {
    const glyphs = [...ALPHABET, ...ALPHABET.map((l) => l.toLowerCase())];
    for (const canvas of [canvasFor(375, 640), canvasFor(820, 1100), canvasFor(1180, 740)]) {
      for (const glyph of glyphs) {
        const segments = buildSegments(glyph, canvas);
        expect({ glyph, segments: segments.length > 0 }).toEqual({ glyph, segments: true });
        for (const s of segments) {
          expect(s.pts.length).toBeGreaterThanOrEqual(2);
          for (const p of s.pts) {
            expect({ glyph, inside: p.x >= 0 && p.x <= canvas.width && p.y >= 0 && p.y <= canvas.height }).toEqual({ glyph, inside: true });
          }
        }
      }
    }
  });

  it('keeps the original stroke order (A: two slants, then the bar)', () => {
    const [left, right, bar] = buildSegments('A', canvasFor(420, 630));
    expect(left.pts[0].y).toBeLessThan(left.end.y);
    expect(right.pts[0].x).toBeCloseTo(left.pts[0].x);
    expect(Math.abs(bar.pts[0].y - bar.end.y)).toBeLessThan(1);
  });

  it('completes a stroke traced along the path, and scores neat tracing higher than wobbly tracing', () => {
    const canvas = canvasFor(420, 630);
    const [stroke] = buildSegments('L', canvas);
    let neat = startProgress(stroke);
    for (const p of stroke.pts) neat = moveAlong(stroke, neat, p, canvas.k).progress;
    expect(isSegmentDone(stroke, neat)).toBe(true);
    expect(segmentScore(neat)).toBeGreaterThan(0.95);

    let wobbly = startProgress(stroke);
    stroke.pts.forEach((p, i) => {
      wobbly = moveAlong(stroke, wobbly, { x: p.x + (i % 3 === 0 ? 200 : 0), y: p.y }, canvas.k).progress;
    });
    expect(segmentScore(wobbly)).toBeLessThan(segmentScore(neat));
  });

  it("can't jump to the end of a stroke without tracing it", () => {
    const canvas = canvasFor(420, 630);
    const [stroke] = buildSegments('L', canvas);
    const { progress: p } = moveAlong(stroke, startProgress(stroke), stroke.end, canvas.k);
    expect(isSegmentDone(stroke, p)).toBe(false);
  });

  it('accepts capital and small letters for tracing, and nothing else', () => {
    expect(traceLetterFromParam('b')).toBe('b');
    expect(traceLetterFromParam('B')).toBe('B');
    expect(traceLetterFromParam('bb')).toBe('A');
    expect(traceLetterFromParam('7')).toBe('A');
  });

  it('reads letters from route parameters safely', () => {
    expect(letterFromParam('b', SCALABLE_LETTERS)).toBe('B');
    expect(letterFromParam('ß', SCALABLE_LETTERS)).toBe('A');
    expect(letterFromParam(undefined, SCALABLE_LETTERS, 'C')).toBe('C');
  });
});

describe('letter tracing screens', () => {
  it('shows a picture tile for every letter', async () => {
    const { unmount } = await render(<TracingLetterMenu />);
    expect(screen.getByText('Choose a Letter')).toBeTruthy();
    expect(screen.getByText('26 letters available')).toBeTruthy();
    for (const l of ['A', 'M', 'Z']) expect(screen.getByLabelText(l)).toBeTruthy();
    await unmount();
  });

  it('switches the menu to small letters', async () => {
    const { unmount } = await render(<TracingLetterMenu />);
    await fireEvent.press(screen.getByLabelText('Small letters'));
    for (const l of ['a', 'm', 'z']) expect(screen.getByLabelText(`Small letter ${l}`)).toBeTruthy();
    expect(screen.queryByLabelText('A')).toBeNull();
    await unmount();
  });

  it('traces a small letter and saves it separately from the capital', async () => {
    mockParams.letter = 'c';
    const { unmount } = await render(<GuidedTracingScreen />);
    const canvas = canvasFor(750, 1334 - 58);
    for (const segment of buildSegments('c', canvas)) {
      const tracer = screen.getByLabelText(/Tracing stroke/);
      await fireEvent(tracer, 'responderGrant', { nativeEvent: { locationX: segment.pts[0].x, locationY: segment.pts[0].y } });
      for (const p of segment.pts) await fireEvent(tracer, 'responderMove', { nativeEvent: { locationX: p.x, locationY: p.y } });
      await fireEvent(tracer, 'responderRelease', { nativeEvent: {} });
      await wait(1000);
    }
    // The strip shows small letters while tracing a small letter.
    expect(screen.getByLabelText('Small letter z')).toBeTruthy();
    await unmount();
    expect(progress().letters.c.best).toBeGreaterThan(0.9);
    expect(progress().letters.C).toBeUndefined();
  });

  it('traces a whole letter by touch and saves it as a tracing session', async () => {
    mockParams.letter = 'A';
    const { unmount } = await render(<GuidedTracingScreen />);
    // The same canvas the screen computes for the test window (750 × 1334, no insets, 58 pt strip).
    const canvas = canvasFor(750, 1334 - 58);
    const segments = buildSegments('A', canvas);
    for (const segment of segments) {
      const tracer = screen.getByLabelText(/Tracing stroke/);
      await fireEvent(tracer, 'responderGrant', { nativeEvent: { locationX: segment.pts[0].x, locationY: segment.pts[0].y } });
      for (const p of segment.pts) await fireEvent(tracer, 'responderMove', { nativeEvent: { locationX: p.x, locationY: p.y } });
      await fireEvent(tracer, 'responderRelease', { nativeEvent: {} });
      await wait(1000);
    }
    // Leaving the screen saves the letter as a session.
    await unmount();
    const p = progress();
    expect(p.sessions).toHaveLength(1);
    expect(p.sessions[0]).toMatchObject({ activityId: 'trace', rounds: 1 });
    expect(p.letters.A.best).toBeGreaterThan(0.9);
    expect(p.stars).toBeGreaterThan(0);
  });
});

describe('Letter Mastery analysis', () => {
  const letter = LETTER_PATHS.L;
  const ideal = generateIdealPath(letter.strokes, 30);
  const ml: MLFeatures = { predictedChar: 'L', expectedChar: 'L', isCorrect: true, confidence: 0.92, topPredictions: [{ char: 'L', score: 0.92 }], reversalDetected: false, analysisTimestamp: '' };

  /** Writes the ideal strokes, one point every 16 ms, optionally backwards. */
  const write = (backwards = false) => {
    const fx = new FeatureExtractor(letter, ideal);
    let t = 1000;
    for (let s = 0; s < ideal.strokeBoundaries.length - 1; s++) {
      const pts = ideal.points.slice(ideal.strokeBoundaries[s], ideal.strokeBoundaries[s + 1]);
      for (const p of backwards ? [...pts].reverse() : pts) fx.addPoint({ x: p.x, y: p.y, timestamp: (t += 16), pressure: 1 });
      fx.endStroke();
      t += 300;
    }
    return fx.summarize('s1', ml, '2026-11-17T10:00:00.000Z');
  };

  it('measures a neatly written letter as complete, in order and in the right direction', () => {
    const r = write();
    expect(r.clinical.dataQuality.completenessScore).toBeGreaterThan(0.95);
    expect(r.clinical.sequencing).toMatchObject({ strokeCountActual: letter.expectedStrokeCount, strokeCountExpected: letter.expectedStrokeCount, strokeSequenceCorrect: true, directionCorrectRate: 1 });
    expect(r.clinical.shape.mean_path_deviation).toBeLessThan(1);
    expect(r.clinical.sequencing.avgInterStrokeLatency).toBeGreaterThan(200);
    expect(r.overview.score).toBeCloseTo(92);
  });

  it('notices strokes drawn in the wrong direction', () => {
    expect(write(true).clinical.sequencing.directionCorrectRate).toBe(0);
  });

  it('turns reports into scores, letter status and a dashboard summary', () => {
    const good = write();
    const scores = masteryScores(good);
    for (const v of Object.values(scores)) expect(v).toBeGreaterThanOrEqual(0);
    expect(scores.accuracy).toBe(92);
    expect(letterStats([good], 'L').status).toBe('mastered');
    expect(letterStats([], 'L').status).toBe('new');
    const reversed = { ...good, ml: { ...good.ml, reversalDetected: true, reversalConfidence: 0.7 } };
    expect(letterStats([good, reversed], 'L').status).toBe('struggling');
    const summary = summarizeMastery([good, reversed], ['L', 'M']);
    expect(summary.totalSessions).toBe(2);
    expect(summary.struggling).toEqual(['L']);
    expect(summary.trend).toEqual([{ day: '2026-11-17', accuracy: 92 }]);
  });
});

describe('rhymes', () => {
  it('rhymes on the last vowel sound, and on the syllable before a weak ending', () => {
    expect(rhymeTail(SOUNDS.balloon)).toEqual(['UW', 'N']);
    expect(soundsRhyme(SOUNDS.cat, SOUNDS.hat)).toBe(true);
    expect(soundsRhyme(SOUNDS.moon, SOUNDS.balloon)).toBe(true);
    expect(soundsRhyme(SOUNDS.cat, SOUNDS.cat)).toBe(false);
    expect(soundsRhyme(SOUNDS.cat, SOUNDS.dog)).toBe(false);
    expect(soundsRhyme(SOUNDS.tiger, SOUNDS.letter)).toBe(false);
    expect(soundsRhyme(SOUNDS.letter, SOUNDS.better)).toBe(true);
  });

  it('finds a rhyme anywhere in what was heard, but not the word itself', async () => {
    const pronounce = async (w: string) => SOUNDS[w] ?? [];
    expect(await findSpokenRhyme('cat', ['cat'], pronounce)).toEqual({ rhyme: null, heard: 'cat' });
    expect(await findSpokenRhyme('cat', ['a big splat'], pronounce)).toEqual({ rhyme: 'splat', heard: 'a big splat' });
    expect((await findSpokenRhyme('cat', ['dog'], pronounce)).rhyme).toBeNull();
    // Picture rhyme families count even without the dictionary.
    expect((await findSpokenRhyme('moon', ['spoon'], async () => [])).rhyme).toBe('spoon');
  });

  it('builds Rhyme Train rounds where every answer rhymes and no distractor does', () => {
    for (const level of [1, 2, 3] as const) {
      const rounds = generateRhymeTrainRounds(level, createRng(level), 20);
      for (const r of rounds) {
        expect(r.options).toHaveLength({ 1: 4, 2: 5, 3: 6 }[level]);
        expect(new Set(r.options).size).toBe(r.options.length);
        expect(r.answers.length).toBeGreaterThanOrEqual(2);
        for (const a of r.answers) expect(rhymesWith(r.engine, a)).toBe(true);
        for (const o of r.options.filter((x) => !r.answers.includes(x))) expect(rhymesWith(r.engine, o)).toBe(false);
      }
    }
  });

  it('builds Voice Vault rounds from rhyme families', () => {
    for (const r of generateVoiceVaultRounds(1, createRng(4), 10)) {
      expect(r.rhymes.length).toBeGreaterThanOrEqual(2);
      expect(RHYME_FAMILIES.some((f) => f.includes(r.word) && r.rhymes.every((w) => f.includes(w)))).toBe(true);
    }
  });
});

describe('Rhyme Time modes', () => {
  const roundProps = { level: 1 as const, attempt: 0, revealed: false, disabled: false, score: 0, combo: 0, accent: '#B45309' };

  it('lists all three modes', async () => {
    const { unmount } = await render(<RhymeTime />);
    for (const title of ['Rhyme Time', 'Rhyme Train', 'Voice Vault']) expect(screen.getByText(title)).toBeTruthy();
    await unmount();
  });

  it('Rhyme Train: a wrong carriage is a try, and loading every rhyme finishes the round', async () => {
    const onAnswer = jest.fn();
    const Round = rhymeTrain.Round;
    const round = { engine: 'cat', answers: ['hat', 'bat'], options: ['hat', 'dog', 'bat', 'sun'] };
    const { unmount } = await render(<Round round={round} onAnswer={onAnswer} {...roundProps} />);
    await fireEvent(screen.getByTestId('tile-grid'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 360 } } });
    await fireEvent.press(screen.getByLabelText('dog'));
    expect(onAnswer).toHaveBeenLastCalledWith({ correct: false });
    await fireEvent.press(screen.getByLabelText('hat'));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('bat'));
    expect(onAnswer).toHaveBeenLastCalledWith({ correct: true });
    await unmount();
  });

  it('Voice Vault: a spoken rhyme is checked and locked in the vault; a non-rhyme is a try', async () => {
    const onAnswer = jest.fn();
    const Round = voiceVault.Round;
    const round = { word: 'cat', rhymes: ['hat', 'bat', 'rat'] };
    mockHeard = ['dog'];
    const first = await render(<Round round={round} onAnswer={onAnswer} {...roundProps} />);
    await fireEvent.press(screen.getByLabelText('Tap and say a rhyme'));
    await wait(20);
    expect(onAnswer).toHaveBeenLastCalledWith({ correct: false });
    await first.unmount();

    mockHeard = ['splat'];
    const second = await render(<Round round={round} onAnswer={onAnswer} {...roundProps} />);
    await fireEvent.press(screen.getByLabelText('Tap and say a rhyme'));
    await wait(20);
    expect(onAnswer).toHaveBeenLastCalledWith({ correct: true, score: 1 });
    expect(progress().rhymeVault).toEqual({ cat: ['splat'] });
    expect(screen.getByText(/"splat" is locked in your vault/)).toBeTruthy();
    await second.unmount();
  });
});
