/**
 * Generates the small UI sound effects in assets/sounds as 16-bit mono WAV files.
 * The sounds are synthesised (soft sine tones with an envelope), so the app ships
 * with no third-party audio. Re-run with: node scripts/generate-sounds.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

/** A note: frequency in Hz, start and duration in seconds. */
function render(notes, totalSeconds, volume = 0.35) {
  const total = Math.ceil(totalSeconds * SAMPLE_RATE);
  const samples = new Float32Array(total);
  for (const { freq, start, duration } of notes) {
    const from = Math.floor(start * SAMPLE_RATE);
    const length = Math.floor(duration * SAMPLE_RATE);
    for (let i = 0; i < length && from + i < total; i++) {
      const t = i / SAMPLE_RATE;
      // Quick attack, exponential decay: gentle "marimba" feel.
      const attack = Math.min(1, t / 0.01);
      const decay = Math.exp((-4 * t) / duration);
      const tone = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t);
      samples[from + i] += tone * attack * decay * volume;
    }
  }
  return samples;
}

function toWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buffer;
}

const SOUNDS = {
  // Two rising notes (E5 -> A5).
  correct: render(
    [
      { freq: 659.25, start: 0, duration: 0.18 },
      { freq: 880.0, start: 0.1, duration: 0.3 },
    ],
    0.45,
  ),
  // A soft, low, non-punishing "hmm" (two close low notes).
  tryAgain: render(
    [
      { freq: 311.13, start: 0, duration: 0.2 },
      { freq: 277.18, start: 0.12, duration: 0.25 },
    ],
    0.4,
    0.25,
  ),
  // Rising arpeggio C5 E5 G5 C6.
  complete: render(
    [
      { freq: 523.25, start: 0, duration: 0.25 },
      { freq: 659.25, start: 0.12, duration: 0.25 },
      { freq: 783.99, start: 0.24, duration: 0.25 },
      { freq: 1046.5, start: 0.36, duration: 0.5 },
    ],
    0.95,
  ),
  // Short wooden tap.
  tap: render([{ freq: 520, start: 0, duration: 0.07 }], 0.09, 0.3),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  const file = path.join(OUT_DIR, `${name}.wav`);
  fs.writeFileSync(file, toWav(samples));
  console.log(`wrote ${path.relative(process.cwd(), file)} (${samples.length} samples)`);
}
