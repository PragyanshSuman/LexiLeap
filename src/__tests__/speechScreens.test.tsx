import { fireEvent, render, screen } from '@testing-library/react-native';
import SpeechTest from '@/app/assessment/speech';
import MagicWords from '@/app/magic';
import PhonicCheck from '@/app/phonic-check';
import { SPEECH_TEST_WORDS } from '@/engine/assessment';
import { emptyProgress } from '@/engine/progress';
import { buildAssessmentHtml } from '@/services/report';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_PREFS, type Profile } from '@/store/profile';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
}));

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

describe('Speech Test', () => {
  it('lets an adult mark every word when the device cannot listen, then saves the result', async () => {
    await render(<SpeechTest />);
    expect(screen.getByText(/the grown-up marks each word/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Start the test'));

    for (const [i, word] of SPEECH_TEST_WORDS.entries()) {
      expect(screen.getByText(word)).toBeTruthy();
      await fireEvent.press(screen.getByText(i % 4 === 0 ? 'Not quite' : '✓ Said it right'));
    }

    expect(screen.getByText('Test complete!')).toBeTruthy();
    expect(screen.getByText(`15 of ${SPEECH_TEST_WORDS.length} words right`)).toBeTruthy();
    const [saved] = useAppStore.getState().progress[profile.id].assessments;
    expect(saved).toMatchObject({ kind: 'speech', method: 'adult' });
    expect(saved.items).toHaveLength(SPEECH_TEST_WORDS.length);
  });

  it('builds a report that escapes the name and lists every word', () => {
    const items = SPEECH_TEST_WORDS.map((word) => ({ word, score: 0.5, correct: false, missed: ['K'], changed: [['TH', 'F']] as [string, string][] }));
    const html = buildAssessmentHtml({ ...profile, name: '<Ada>' }, { id: 'a', kind: 'speech', takenAt: '2026-05-01T10:00:00.000Z', method: 'auto', items });
    expect(html).toContain('&lt;Ada&gt;');
    expect(html).not.toContain('<Ada>');
    for (const word of SPEECH_TEST_WORDS) expect(html).toContain(`<b>${word}</b>`);
    expect(html).toContain('not a diagnosis');
  });
});

describe('speech studios', () => {
  it('shows a Magic Words card for a typed word', async () => {
    await render(<MagicWords />);
    await fireEvent.changeText(screen.getByLabelText('Type here...'), 'Ship!');
    await fireEvent.press(screen.getByText('✨ GO'));
    expect(screen.getAllByText(/ship/).length).toBeGreaterThan(0);
  });

  it('renders Say It Right in both modes', async () => {
    await render(<PhonicCheck />);
    expect(screen.toJSON()).toBeTruthy();
    await fireEvent.press(screen.getByText('My own word'));
    expect(screen.toJSON()).toBeTruthy();
  });
});
