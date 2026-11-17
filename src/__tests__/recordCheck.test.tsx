import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { sayIt } from '@/activities/sayIt';

// The Expo Go preview: no speech recogniser, but the microphone can record.
jest.mock('@/services/speechRecognition', () => ({ isSpeechRecognitionAvailable: () => false, listenForWord: jest.fn() }));

const tick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));

describe('microphone without a speech recogniser (Expo Go)', () => {
  it('records the child, plays it back, and lets a grown-up mark it', async () => {
    const onAnswer = jest.fn();
    const Round = sayIt.Round;
    await render(<Round round={{ word: 'cat', emoji: '🐱' }} onAnswer={onAnswer} level={1} attempt={0} revealed={false} disabled={false} score={0} combo={0} accent="#2F7D95" />);

    // The same big microphone as the installed app.
    await fireEvent.press(screen.getByLabelText('Tap the microphone and say it'));
    await tick();
    expect(screen.getByText('Recording… tap to stop')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Recording… tap to stop'));
    await tick();

    await fireEvent.press(screen.getByText('Hear it back'));
    await fireEvent.press(screen.getByText('Sounded right'));
    expect(onAnswer).toHaveBeenCalledWith({ correct: true, score: 1 });
  });
});
