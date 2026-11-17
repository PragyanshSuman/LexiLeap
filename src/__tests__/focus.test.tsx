import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Journey from '@/app/journey';
import MoodTrack from '@/app/mood-track';
import { FocusTracker } from '@/components/FocusTracker';
import { analyzeFace, focusByDay, needsFocusBreak, summarizeFocus, type FocusSample } from '@/engine/focus';
import { emptyProgress } from '@/engine/progress';
import { dayKey } from '@/lib/date';
import { buildReportHtml } from '@/services/report';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_PREFS, type Profile } from '@/store/profile';

const mockDelete = jest.fn();
const mockReadFace = jest.fn();

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
    Redirect: () => null,
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});
jest.mock('expo-camera', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const CameraView = forwardRef((props: { onCameraReady?: () => void }, ref) => {
    useImperativeHandle(ref, () => ({ takePictureAsync: async () => ({ uri: 'file:///photo.jpg' }) }));
    return <View testID="camera" {...props} />;
  });
  return { CameraView, useCameraPermissions: () => [{ granted: true }] };
});
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ delete: mockDelete })),
}));
jest.mock('@/services/faceDetection', () => ({
  isFaceDetectionAvailable: () => true,
  readFace: (...args: unknown[]) => mockReadFace(...args),
}));

const profile: Profile = {
  id: 'kid',
  name: 'Ada',
  avatar: '🦊',
  age: 7,
  createdAt: '2026-01-01T00:00:00.000Z',
  prefs: { ...DEFAULT_PREFS, focusHelper: true },
};

beforeEach(() => {
  mockDelete.mockClear();
  mockReadFace.mockReset();
  useAppStore.setState({ profiles: [profile], activeProfileId: profile.id, parent: null, progress: { [profile.id]: emptyProgress() } });
});

const sample = (at: number, concentration: number, feature: FocusSample['feature'] = 'rhyme'): FocusSample => ({
  at,
  day: dayKey(new Date(at)),
  feature,
  expression: concentration > 50 ? 'focused' : 'looking-away',
  concentration,
});

describe('focus signals', () => {
  it('scores attention from head angle and eyes', () => {
    expect(analyzeFace(null)).toEqual({ expression: 'away', concentration: 0 });
    expect(analyzeFace({ yaw: 2, pitch: 3, leftEyeOpen: 0.9, rightEyeOpen: 0.95, smiling: 0.1 })).toEqual({ expression: 'focused', concentration: 100 });
    expect(analyzeFace({ yaw: 0, pitch: 0, leftEyeOpen: 0.9, rightEyeOpen: 0.9, smiling: 0.9 }).expression).toBe('happy');
    expect(analyzeFace({ yaw: 45, pitch: 0 })).toEqual({ expression: 'looking-away', concentration: 0 });
    const tired = analyzeFace({ yaw: 0, pitch: 0, leftEyeOpen: 0.1, rightEyeOpen: 0.2 });
    expect(tired.expression).toBe('tired');
    expect(tired.concentration).toBeLessThan(35);
    const halfTurned = analyzeFace({ yaw: 20, pitch: 0, leftEyeOpen: 1, rightEyeOpen: 1 });
    expect(halfTurned.concentration).toBeGreaterThan(0);
    expect(halfTurned.concentration).toBeLessThan(100);
  });

  it('asks for a break only after several low readings in a row', () => {
    const now = 1_000_000;
    const low = [sample(now - 10_000, 10), sample(now - 5_000, 0), sample(now, 20)];
    expect(needsFocusBreak(low, 'rhyme', now)).toBe(true);
    expect(needsFocusBreak(low.slice(1), 'rhyme', now)).toBe(false);
    expect(needsFocusBreak([...low.slice(0, 2), sample(now, 80)], 'rhyme', now)).toBe(false);
    expect(needsFocusBreak(low, 'memory', now)).toBe(false);
    expect(needsFocusBreak(low, 'rhyme', now + 60_000)).toBe(false); // stale
    expect(needsFocusBreak([sample(now - 90_000, 10), sample(now - 5_000, 0), sample(now, 20)], 'rhyme', now)).toBe(false); // gap
  });

  it('summarises by feature and by day', () => {
    const now = Date.now();
    const samples = [sample(now, 80), sample(now, 60), sample(now, 10, 'writing')];
    const [rhyme, writing] = summarizeFocus(samples);
    expect(rhyme).toMatchObject({ feature: 'rhyme', samples: 2, concentration: 70, dominant: 'focused' });
    expect(writing).toMatchObject({ feature: 'writing', samples: 1, concentration: 10, dominant: 'looking-away' });
    expect(focusByDay(samples, [dayKey(), '2000-01-01'])).toEqual([
      { day: dayKey(), concentration: 50 },
      { day: '2000-01-01', concentration: null },
    ]);
  });
});

describe('FocusTracker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const tick = (ms: number) => act(async () => void (await jest.advanceTimersByTimeAsync(ms)));

  it('samples every few seconds, deletes each photo and suggests a break when focus stays low', async () => {
    mockReadFace.mockResolvedValue({ yaw: 50, pitch: 0 }); // looking away
    const onLowFocus = jest.fn();
    await render(<FocusTracker feature="rhyme" onLowFocus={onLowFocus} />);
    expect(screen.getByLabelText('Focus helper is on')).toBeTruthy();
    await fireEvent(screen.getByTestId('camera'), 'cameraReady');
    await tick(500 + 5000 * 2 + 100);

    const samples = useAppStore.getState().progress[profile.id].focus;
    expect(samples).toHaveLength(3);
    expect(samples.every((s) => s.feature === 'rhyme' && s.expression === 'looking-away')).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(3);
    expect(onLowFocus).toHaveBeenCalledTimes(1);

    // No second suggestion straight away.
    await tick(5000 * 3);
    expect(onLowFocus).toHaveBeenCalledTimes(1);
  });

  it('does nothing unless a parent turned it on', async () => {
    useAppStore.setState({ profiles: [{ ...profile, prefs: { ...profile.prefs, focusHelper: false } }] });
    await render(<FocusTracker feature="rhyme" />);
    expect(screen.queryByTestId('camera')).toBeNull();
    await tick(10_000);
    expect(mockReadFace).not.toHaveBeenCalled();
  });
});

describe('progress reports', () => {
  beforeEach(() => {
    const now = Date.now();
    useAppStore.setState({
      progress: {
        [profile.id]: {
          ...emptyProgress(),
          focus: [sample(now, 80), sample(now, 30, 'writing')],
          speechChecks: [{ word: 'ship', score: 1, correct: true, missed: [], changed: [], day: dayKey() }],
        },
      },
    });
  });

  it('shows the Mood Track per activity', async () => {
    await render(<MoodTrack />);
    expect(screen.getByText('Rhyme Time')).toBeTruthy();
    expect(screen.getByText('Write & Score')).toBeTruthy();
    expect(screen.getAllByText('1 readings')).toHaveLength(2);
    await fireEvent.press(screen.getByText('Rhyme Time'));
    expect(screen.getByText('▲ Show less')).toBeTruthy();
  });

  it('shows the learning profile', async () => {
    await render(<Journey />);
    expect(screen.getByText('Learning Profile')).toBeTruthy();
    expect(screen.getByText('55%')).toBeTruthy(); // focus score
    expect(screen.getByText(/ship/)).toBeTruthy();
  });

  it('adds focus to the PDF report', () => {
    const html = buildReportHtml(profile, useAppStore.getState().progress[profile.id]);
    expect(html).toContain('Focus helper');
    expect(html).toContain('Write &amp; Score');
  });
});
