import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SpellingTest from '@/app/assessment/spelling';
import AssessmentResult from '@/app/parent/assessment/[id]';
import MasteryDashboard from '@/app/parent/mastery/[childId]';
import LetterMastery from '@/app/mastery/index';
import MasterySessionReport from '@/app/parent/mastery/session/[id]';
import MasteryWriteScreen from '@/app/mastery/write/[letter]';
import { emptyProgress } from '@/engine/progress';
import { buildAssessmentHtml } from '@/services/report';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_PREFS, type Profile } from '@/store/profile';

const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
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

/** Draws an "L" with touch events on the element with this label. */
async function drawL(label = 'Writing area') {
  const pad = screen.getByLabelText(label);
  const at = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } });
  await fireEvent(pad, 'responderGrant', at(90, 40));
  for (let y = 50; y <= 260; y += 15) await fireEvent(pad, 'responderMove', at(90, y));
  for (let x = 100; x <= 220; x += 15) await fireEvent(pad, 'responderMove', at(x, 260));
  await fireEvent(pad, 'responderRelease', at(220, 260));
}

describe('Letter Mastery', () => {
  it('writes a letter on the canvas, reads it with the handwriting model, and saves the full report', async () => {
    mockParams.letter = 'L';
    const { unmount } = await render(<MasteryWriteScreen />);
    await fireEvent(screen.getByTestId('mastery-canvas-area'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 420 } } });

    // Checking with nothing written asks for the letter first and saves nothing.
    await fireEvent.press(screen.getByLabelText('Check'));
    expect(screen.getByText(/Write the letter first/)).toBeTruthy();
    expect(useAppStore.getState().progress[profile.id].mastery).toHaveLength(0);

    await drawL('Writing board for the letter L');
    await fireEvent.press(screen.getByLabelText('Check'));
    await wait(120);

    const progress = useAppStore.getState().progress[profile.id];
    expect(progress.mastery).toHaveLength(1);
    const report = progress.mastery[0];
    expect(report.letter).toBe('L');
    expect(report.ml.predictedChar).toBe('L');
    expect(report.ml.topPredictions.length).toBeGreaterThan(0);
    expect(report.clinical.sequencing.strokeCountActual).toBe(1);
    expect(report.clinical.kinematics.avgVelocity).toBeGreaterThanOrEqual(0);
    // The same letter is logged for the parent zone's writing reports.
    expect(progress.writing).toHaveLength(1);
    expect(progress.writing[0]).toMatchObject({ letter: 'L', read: 'L' });

    // The child sees one kind, spoken result; the measures are only in the parent zone.
    expect(screen.getByText(/Great writing|Nice try|Almost/)).toBeTruthy();
    expect(screen.getByText('Next letter')).toBeTruthy();
    expect(screen.queryByText('Training Feedback')).toBeNull();
    await unmount();
  });

  it('shows real letter progress, the dashboard and a session report', async () => {
    mockParams.letter = 'L';
    const first = await render(<MasteryWriteScreen />);
    await fireEvent(screen.getByTestId('mastery-canvas-area'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 420 } } });
    await drawL('Writing board for the letter L');
    await fireEvent.press(screen.getByLabelText('Check'));
    await wait(120);
    await first.unmount();
    const [report] = useAppStore.getState().progress[profile.id].mastery;

    const menu = await render(<LetterMastery />);
    expect(screen.getByText('Letter Mastery 🏫')).toBeTruthy();
    expect(screen.getByLabelText(/^L\. /)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search letters…'), 'q');
    expect(screen.queryByLabelText(/^L\. /)).toBeNull();
    await menu.unmount();

    mockParams.childId = profile.id;
    const dashboard = await render(<MasteryDashboard />);
    expect(screen.getByText('Progress Dashboard')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy(); // sessions
    await fireEvent.press(screen.getByText('Details'));
    expect(screen.getByText('L')).toBeTruthy();
    await fireEvent.press(screen.getByText('Risk'));
    expect(screen.getByText('Screening Report 🛡️')).toBeTruthy();
    await dashboard.unmount();

    mockParams.id = report.sessionId;
    const sessionReport = await render(<MasterySessionReport />);
    expect(screen.getByText('Session Report')).toBeTruthy();
    expect(screen.getByText('Performance Summary')).toBeTruthy();
    await fireEvent.press(screen.getByText('Detailed'));
    expect(screen.getByText('Training Feedback')).toBeTruthy();
    expect(screen.getByText('7. Artificial Intelligence (ML)')).toBeTruthy();
    await fireEvent.press(screen.getByText('Diagnostic'));
    expect(screen.getByText('Screening Results 🩺')).toBeTruthy();
    await sessionReport.unmount();
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
    expect(screen.getByText('All done! 🎉')).toBeTruthy();
    expect(screen.queryByText('Needs support')).toBeNull();
    expect(buildAssessmentHtml(profile, saved)).toContain('Spelling assessment');
    await unmount();

    // Grown-ups see the result (and can share the PDF) in the parent zone.
    mockParams.id = saved.id;
    mockParams.childId = profile.id;
    const result = await render(<AssessmentResult />);
    expect(screen.getByText('Needs support')).toBeTruthy();
    expect(screen.getByText('Share report (PDF)')).toBeTruthy();
    await result.unmount();
  });
});
