import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SpellingTest from '@/app/assessment/spelling';
import WriteAndScore from '@/app/writing';
import { emptyProgress } from '@/engine/progress';
import { buildAssessmentHtml } from '@/services/report';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_PREFS, type Profile } from '@/store/profile';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
}));

// The real model, read from disk instead of through expo-asset.
jest.mock('@/services/handwritingModel', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const { parseModel } = jest.requireActual<typeof import('@/handwriting/model')>('@/handwriting/model');
  const file = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'models', 'handwriting.bin'));
  const model = parseModel(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
  return { useHandwritingModel: () => ({ status: 'ready', model }) };
});

jest.setTimeout(30_000);

const profile: Profile = {
  id: 'kid',
  name: 'Ada',
  avatar: '🦊',
  age: 7,
  createdAt: '2026-01-01T00:00:00.000Z',
  prefs: { ...DEFAULT_PREFS },
};

beforeEach(() => {
  useAppStore.setState({ profiles: [profile], activeProfileId: profile.id, parent: null, progress: { [profile.id]: emptyProgress() } });
});

const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

async function layoutPad() {
  await fireEvent(screen.getByTestId('pad-area'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } } });
}

/** Draws an "L" on the pad with touch events. */
async function drawL() {
  const pad = screen.getByLabelText('Writing area');
  const at = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } });
  await fireEvent(pad, 'responderGrant', at(90, 40));
  for (let y = 50; y <= 260; y += 15) await fireEvent(pad, 'responderMove', at(90, y));
  for (let x = 100; x <= 220; x += 15) await fireEvent(pad, 'responderMove', at(x, 260));
}

describe('Write & Score', () => {
  it('asks for a letter, reads the handwriting and saves the attempt', async () => {
    const { unmount } = await render(<WriteAndScore />);
    await layoutPad();
    await fireEvent.press(screen.getByText('New letter'));
    await drawL();
    await fireEvent.press(screen.getByText('Check'));
    await wait(80);

    const [attempt] = useAppStore.getState().progress[profile.id].writing;
    expect(attempt.read).toBe('L');
    expect(screen.getByText(attempt.correct ? /Correct!/ : /That looks like L/)).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy(); // tests taken
    await unmount();
  });
});

describe('Write Test', () => {
  it('runs a full test, lets a grown-up fix a reading, then saves and reports it', async () => {
    const { unmount } = await render(<SpellingTest />);
    await fireEvent.press(screen.getByText('Start the test'));

    // First word: one letter, then done. The other words are left blank.
    await layoutPad();
    await drawL();
    await fireEvent.press(screen.getByText('Next letter'));
    expect(screen.getByLabelText('Letters written: 1')).toBeTruthy();
    for (let i = 0; i < 10; i++) await fireEvent.press(screen.getByText('Done with this word'));
    await wait(300); // letters are read in the background

    expect(screen.getByText('Check our reading')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('l')); // cycle to the next-best reading
    await fireEvent.press(screen.getByText('Save results'));

    const [saved] = useAppStore.getState().progress[profile.id].assessments;
    expect(saved).toMatchObject({ kind: 'spelling', method: 'adult' });
    if (saved.kind !== 'spelling') throw new Error('expected a spelling assessment');
    expect(saved.items).toHaveLength(10);
    expect(saved.items[0].written).toHaveLength(1);
    expect(saved.items[0].written).not.toBe('l');
    expect(saved.items[1].errors).toEqual(['blank']);
    expect(screen.getByText('Test complete!')).toBeTruthy();
    expect(screen.getByText('Needs support')).toBeTruthy();
    expect(buildAssessmentHtml(profile, saved)).toContain('Spelling assessment');
    await unmount();
  });
});
