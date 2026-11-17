import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityRunner } from '@/activities/ActivityRunner';
import { ACTIVITY_DEFINITIONS } from '@/activities/registry';
import { soundMatch } from '@/activities/soundMatch';
import type { SoundMatchRound } from '@/activities/generators';
import type { ActivityDefinition } from '@/activities/types';
import { ACTIVITY_ORDER } from '@/engine/catalog';
import { emptyProgress } from '@/engine/progress';
import type { Level } from '@/engine/types';
import { createRng } from '@/lib/random';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_PREFS, type Profile } from '@/store/profile';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() } }));

// These tests play whole sessions; allow for slow, busy CI machines.
jest.setTimeout(30_000);

const profile: Profile = {
  id: 'kid',
  name: 'Ada',
  avatar: '🦊',
  age: 7,
  createdAt: '2026-01-01T00:00:00.000Z',
  prefs: { ...DEFAULT_PREFS },
};

/** Grids size themselves from their measured space, so tests report a layout first. */
async function layoutGrids() {
  for (const grid of screen.queryAllByTestId('tile-grid')) {
    await fireEvent(grid, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 420 } } });
  }
}

beforeEach(() => {
  useAppStore.setState({ profiles: [profile], activeProfileId: profile.id, parent: null, progress: { [profile.id]: emptyProgress() } });
});

describe('every activity round renders', () => {
  const cases = ACTIVITY_ORDER.flatMap((id) => ([1, 2, 3] as Level[]).map((level) => [id, level] as const));

  it.each(cases)('%s at level %i, before and after the answer is revealed', async (id, level) => {
    const definition = ACTIVITY_DEFINITIONS[id];
    const [round] = definition.generate({ level, rng: createRng(5), progress: emptyProgress() });
    const props = { round, level, attempt: 0, disabled: false, onAnswer: jest.fn(), score: 300, combo: 2, accent: definition.meta.color };
    const { rerender, unmount } = await render(<definition.Round {...props} revealed={false} />);
    await layoutGrids();
    await rerender(<definition.Round {...props} attempt={1} revealed />);
    await layoutGrids();
    expect(screen.toJSON()).toBeTruthy();
    await unmount();
  });
});

describe('ActivityRunner', () => {
  // Fixed rounds so the test knows each answer.
  const rounds: SoundMatchRound[] = ['m', 's', 't', 'a'].map((target) => ({
    mode: 'name',
    target,
    options: [target, 'x', 'o'],
  }));
  const definition: ActivityDefinition<SoundMatchRound> = { ...soundMatch, roundsPerSession: rounds.length, generate: () => rounds };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const advance = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

  async function startSession() {
    await render(<ActivityRunner definition={definition} profile={profile} onInProgressChange={jest.fn()} onExit={jest.fn()} onSwitch={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await layoutGrids();
  }

  it('plays a full session, saves it and shows the summary', async () => {
    await startSession();
    for (const round of rounds) {
      await fireEvent.press(screen.getByLabelText(`Letter ${round.target}`));
      await advance(1200);
      await layoutGrids();
    }
    expect(screen.getByText('Amazing!')).toBeTruthy();
    const progress = useAppStore.getState().progress[profile.id];
    expect(progress.sessions).toHaveLength(1);
    expect(progress.sessions[0].accuracy).toBe(1);
    expect(progress.sessions[0].avgResponseSec).toBeDefined();
    expect(progress.activities['sound-match']?.level).toBe(2);
    expect(screen.getByText(/Level up/)).toBeTruthy();
  });

  it('retries, then reveals the answer and records the look-alike mix-up', async () => {
    const lookalikes: ActivityDefinition<SoundMatchRound> = {
      ...definition,
      roundsPerSession: 1,
      generate: () => [{ mode: 'name', target: 'b', options: ['b', 'd', 'p'] }],
    };
    await render(<ActivityRunner definition={lookalikes} profile={profile} onInProgressChange={jest.fn()} onExit={jest.fn()} onSwitch={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await layoutGrids();

    await fireEvent.press(screen.getByLabelText('Letter d'));
    expect(screen.getByText(/Almost|Good try|Not quite/)).toBeTruthy();
    await advance(1100);
    await fireEvent.press(screen.getByLabelText('Letter p'));
    expect(screen.getByText("Here's the answer. Let's keep going!")).toBeTruthy();
    await advance(2300);

    const progress = useAppStore.getState().progress[profile.id];
    expect(progress.sessions[0].accuracy).toBe(0);
    expect(progress.confusions).toEqual({ 'b|d': 1, 'b|p': 1 });
  });

  it('offers the AI Roadmap after three misses in a row, not after a single tricky round', async () => {
    await startSession();
    // Round 1: two wrong picks reveal the answer. Two misses alone don't trigger the advisor.
    await fireEvent.press(screen.getByLabelText('Letter x'));
    await advance(1100);
    await fireEvent.press(screen.getByLabelText('Letter o'));
    await advance(2300);
    await layoutGrids();
    expect(screen.queryByText("Let's try something different!")).toBeNull();

    // Round 2: a third miss in a row.
    await fireEvent.press(screen.getByLabelText('Letter x'));
    await advance(1100);
    expect(screen.getByText("Let's try something different!")).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: "I'll keep going here" }));
    expect(screen.queryByText("Let's try something different!")).toBeNull();
    // The same round continues, with the wrong pick faded out.
    await fireEvent.press(screen.getByLabelText('Letter s'));
    await advance(1200);
    expect(screen.getByText('3 of 4')).toBeTruthy();
  });

  it('saves progress and switches when the child picks a suggested activity', async () => {
    const onSwitch = jest.fn();
    await render(<ActivityRunner definition={definition} profile={profile} onInProgressChange={jest.fn()} onExit={jest.fn()} onSwitch={onSwitch} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await layoutGrids();
    await fireEvent.press(screen.getByLabelText('Letter x'));
    await advance(1100);
    await fireEvent.press(screen.getByLabelText('Letter o'));
    await advance(2300);
    await layoutGrids();
    await fireEvent.press(screen.getByLabelText('Letter x'));
    await advance(1100);
    await fireEvent.press(screen.getByRole('button', { name: 'Rhyme Time' }));
    expect(onSwitch).toHaveBeenCalledWith('rhyme');
    expect(useAppStore.getState().progress[profile.id].sessions).toHaveLength(1);
  });
});

describe('languages', () => {
  afterEach(() => useAppStore.setState({ language: 'en' }));

  it('shows an activity intro in Tamil', async () => {
    useAppStore.setState({ language: 'ta' });
    const { unmount } = await render(<ActivityRunner definition={soundMatch} profile={profile} onInProgressChange={jest.fn()} onExit={jest.fn()} onSwitch={jest.fn()} />);
    expect(screen.getByText('ஒலி பொருத்தம்')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'தொடங்கு' })).toBeTruthy();
    await unmount();
  });
});

