import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCES = {
  correct: require('../../assets/sounds/correct.wav'),
  tryAgain: require('../../assets/sounds/tryAgain.wav'),
  complete: require('../../assets/sounds/complete.wav'),
  tap: require('../../assets/sounds/tap.wav'),
};

export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let configured = false;

/**
 * Sound effects and the voice mix with other audio and play even with the ringer off
 * (children's devices often are). Called at launch, before anything is spoken.
 */
export async function configureAudio() {
  if (configured) return;
  configured = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  } catch {
    // Not fatal: sounds simply follow the device's default audio mode.
  }
}

/**
 * Restores the playback audio mode. Call after speech recognition, which switches iOS
 * to a record-and-play session that makes later sound effects quiet.
 */
export function restoreAudioMode(): void {
  configured = false;
  void configureAudio();
}

export function playSound(name: SoundName): void {
  void configureAudio();
  try {
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      player.volume = name === 'tap' ? 0.5 : 0.8;
      players[name] = player;
    }
    player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Audio is a nice-to-have; never let it break an activity.
  }
}
