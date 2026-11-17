import * as Crypto from 'expo-crypto';

export const PIN_LENGTH = 4;

export function newSalt(): string {
  return Crypto.randomUUID();
}

/** The PIN itself is never stored, only a salted SHA-256 hash. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/** Rejects PINs that are trivially guessable by a child (1111, 1234, 4321 …). */
export function isWeakPin(pin: string): boolean {
  if (new Set(pin).size === 1) return true;
  const digits = pin.split('').map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]);
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}
