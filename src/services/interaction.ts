/**
 * When the child last touched the screen or spoke to the app. The Focus helper uses this as its
 * fallback signal when the camera can't see their face (or isn't available).
 */
let lastInteractionAt = Date.now();

export function markInteraction(now = Date.now()): void {
  lastInteractionAt = now;
}

export function msSinceInteraction(now = Date.now()): number {
  return Math.max(0, now - lastInteractionAt);
}
