import { fireEvent, render, screen, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { sayIt } from '@/activities/sayIt';
import MasteryWriteScreen from '@/app/mastery/write/[letter]';
import { emptyProgress } from '@/engine/progress';
import { buildMasteryReportHtml, buildReportHtml } from '@/services/report';
import { matchSpokenWordBySound, soundSimilarity } from '@/services/speechMatch';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_PREFS, type Profile } from '@/store/profile';
import { FeatureExtractor } from '@/writing/featureExtractor';
import { generateIdealPath } from '@/writing/geometry';
import { LETTER_PATHS } from '@/writing/letterPaths';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
  useLocalSearchParams: () => ({ letter: 'L' }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock('expo-camera', () => ({ useCameraPermissions: () => [null, jest.fn()], CameraView: () => null }));
// The app's own recogniser (installed app): it "hears" whatever the test sets.
let mockHeard: string[] = [];
jest.mock('@/services/speechRecognition', () => ({
  isSpeechRecognitionAvailable: () => true,
  listenForWord: async (_word: string, handlers: { onResult: (t: string[]) => void }) => {
    handlers.onResult(mockHeard);
    return () => undefined;
  },
}));
jest.mock('@/services/sounds', () => ({ restoreAudioMode: jest.fn(), playSound: jest.fn(), configureAudio: jest.fn() }));
const SOUNDS: Record<string, string[]> = {
  sun: ['S', 'AH', 'N'],
  son: ['S', 'AH', 'N'],
  pig: ['P', 'IH', 'G'],
  big: ['B', 'IH', 'G'],
  rabbit: ['R', 'AE', 'B', 'IH', 'T'],
  rabbet: ['R', 'AE', 'B', 'AH', 'T'],
};
jest.mock('@/services/pronunciationDictionary', () => ({
  pronounce: async (word: string) => ({ word, phonemes: SOUNDS[word] ?? [], source: 'dictionary', chunks: null }),
  pronounceHeard: async (transcripts: string[]) => transcripts[0].split(' ').flatMap((w) => SOUNDS[w] ?? []),
}));

const pronounce = async (w: string) => SOUNDS[w] ?? [];
const profile: Profile = { id: 'kid', name: 'Ada', avatar: '🦊', age: 7, createdAt: '2026-01-01T00:00:00.000Z', prefs: { ...DEFAULT_PREFS } };
beforeEach(() => {
  useAppStore.setState({ profiles: [profile], activeProfileId: profile.id, parent: null, progress: { [profile.id]: emptyProgress() } });
});

describe('speech checking', () => {
  it('accepts words that sound the same (recognisers often type a homophone)', async () => {
    expect(await matchSpokenWordBySound('sun', ['son'], pronounce)).toEqual({ match: 'exact', heard: 'son' });
  });

  it('gives partial credit for a near miss on longer words only', async () => {
    expect((await matchSpokenWordBySound('rabbit', ['rabbet'], pronounce)).match).toBe('close');
    expect((await matchSpokenWordBySound('pig', ['big'], pronounce)).match).toBe('none');
    expect(soundSimilarity(SOUNDS.rabbit, SOUNDS.rabbet)).toBeCloseTo(0.8);
  });

  const sayItRound = async (heard: string[]) => {
    mockHeard = heard;
    const onAnswer = jest.fn();
    const Round = sayIt.Round;
    const view = await render(<Round round={{ word: 'rabbit', emoji: '🐰' }} onAnswer={onAnswer} level={1} attempt={0} revealed={false} disabled={false} score={0} combo={0} accent="#2F7D95" />);
    await fireEvent.press(screen.getByLabelText('Tap the microphone and read the word'));
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
    return { onAnswer, view };
  };

  it('scores Say It from the in-app microphone, sound by sound (every sound right)', async () => {
    const { onAnswer, view } = await sayItRound(['rabbit']);
    expect(onAnswer).toHaveBeenCalledWith({ correct: true, score: 1 });
    expect(screen.getByText('100% of the sounds right!')).toBeTruthy();
    await view.unmount();
  });

  it('tells the child how many sounds were right when a sound is off', async () => {
    const { onAnswer, view } = await sayItRound(['big']);
    expect(onAnswer).toHaveBeenCalledWith({ correct: false });
    expect(screen.getByText(/I heard “big”: \d+% of the sounds right/)).toBeTruthy();
    await view.unmount();
  });
});

describe('Write & Score canvas', () => {
  it('lets the writing area stretch to the screen width, so the canvas gets a size', async () => {
    const { unmount } = await render(<MasteryWriteScreen />);
    const style = StyleSheet.flatten(screen.getByTestId('mastery-canvas-area').props.style);
    expect(style.alignSelf).toBe('stretch');
    expect(style.flex).toBe(1);
    await unmount();
  });
});

describe('reports', () => {
  const ideal = generateIdealPath(LETTER_PATHS.L.strokes, 30);
  const write = () => {
    const fx = new FeatureExtractor(LETTER_PATHS.L, ideal);
    let t = 0;
    for (let s = 0; s < ideal.strokeBoundaries.length - 1; s++) {
      for (const p of ideal.points.slice(ideal.strokeBoundaries[s], ideal.strokeBoundaries[s + 1])) fx.addPoint({ x: p.x, y: p.y, timestamp: (t += 16), pressure: 1 });
      fx.endStroke();
    }
    return fx.summarize('s1', { predictedChar: 'L', expectedChar: 'L', isCorrect: true, confidence: 0.9, topPredictions: [], reversalDetected: false, analysisTimestamp: '' });
  };

  it('adds Letter Mastery, the clinical tests and focus expressions to the learning report', () => {
    const progress = {
      ...emptyProgress(),
      mastery: [write()],
      assessments: [{ id: 'a', kind: 'speech' as const, takenAt: '2026-11-17T10:00:00.000Z', method: 'auto' as const, items: [{ word: 'ship', score: 1, correct: true, missed: [], changed: [] }] }],
      focus: [{ at: 1, day: '2026-11-17', feature: 'rhyme' as const, expression: 'frustrated' as const, concentration: 40, source: 'camera' as const }],
    };
    const html = buildReportHtml(profile, progress);
    expect(html).toContain('Letter Mastery: handwriting analysis');
    expect(html).toContain('letters written');
    expect(html).toContain('Clinical tests');
    expect(html).toContain('1 of 1 words');
    expect(html).toContain('Frustrated 100%');
  });

  it('makes a handwriting report with every letter written', () => {
    const html = buildMasteryReportHtml(profile, [write()]);
    expect(html).toContain("Ada's handwriting report");
    expect(html).toContain('<b>L</b>');
    expect(html).toContain('Letters written');
  });
});
