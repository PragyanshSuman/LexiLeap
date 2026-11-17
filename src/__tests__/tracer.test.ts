import { GLYPHS } from '@/activities/trace/glyphs';
import { resample, type Point } from '@/activities/trace/geometry';
import { buildGuide, initialTracerState, touchEnd, touchMove, touchStart, traceProgress, traceScore } from '@/activities/trace/tracer';

/** Simulates a child tracing each stroke perfectly, lifting between strokes. */
function traceGlyph(glyph: string, transform: (p: Point) => Point = (p) => p) {
  const guide = buildGuide(glyph);
  let state = initialTracerState();
  for (const stroke of guide.strokes) {
    const path = resample(stroke, 3).map(transform);
    state = touchStart(guide, state, path[0]);
    for (const p of path.slice(1)) state = touchMove(guide, state, p);
    state = touchEnd(state);
  }
  return { guide, state };
}

describe('tracer', () => {
  it.each(Object.keys(GLYPHS))('completes "%s" when traced accurately', (glyph) => {
    const { guide, state } = traceGlyph(glyph);
    expect(state.done).toBe(true);
    expect(traceProgress(guide, state)).toBe(1);
    expect(traceScore(state)).toBeGreaterThanOrEqual(0.95);
  });

  it('tolerates a wobbly finger that stays near the path', () => {
    const { state } = traceGlyph('S', (p) => ({ x: p.x + 6, y: p.y - 5 }));
    expect(state.done).toBe(true);
    expect(traceScore(state)).toBeGreaterThan(0.8);
  });

  it('does not complete a stroke traced backwards', () => {
    const guide = buildGuide('L');
    const path = [...resample(guide.strokes[0], 3)].reverse();
    let state = touchStart(guide, initialTracerState(), path[0]);
    for (const p of path.slice(1)) state = touchMove(guide, state, p);
    expect(state.done).toBe(false);
  });

  it('counts a wrong start and ignores movement away from the path', () => {
    const guide = buildGuide('T');
    let state = touchStart(guide, initialTracerState(), { x: 50, y: 120 });
    state = touchMove(guide, state, { x: 60, y: 110 });
    expect(state.wrongStarts).toBe(1);
    expect(state.active).toBe(false);
    expect(traceProgress(guide, state)).toBe(0);
  });

  it('resumes a stroke after the finger lifts mid-way', () => {
    const guide = buildGuide('l');
    const path = resample(guide.strokes[0], 3);
    const half = Math.floor(path.length / 2);
    let state = touchStart(guide, initialTracerState(), path[0]);
    for (const p of path.slice(1, half)) state = touchMove(guide, state, p);
    state = touchEnd(state);
    expect(state.lifts).toBe(1);
    state = touchStart(guide, state, path[half - 1]);
    for (const p of path.slice(half)) state = touchMove(guide, state, p);
    expect(state.done).toBe(true);
  });

  it('lets a child slide back to the next stroke without lifting (b)', () => {
    const guide = buildGuide('b');
    const stem = resample(guide.strokes[0], 3);
    let state = touchStart(guide, initialTracerState(), stem[0]);
    for (const p of stem.slice(1)) state = touchMove(guide, state, p);
    // Retrace up the stem to the bowl's start, then draw the bowl.
    for (const p of [...stem].reverse().slice(0, 10)) state = touchMove(guide, state, p);
    for (const p of resample(guide.strokes[1], 3)) state = touchMove(guide, state, p);
    expect(state.done).toBe(true);
  });

  it('jumps across fast moves by interpolating', () => {
    const guide = buildGuide('I');
    let state = touchStart(guide, initialTracerState(), { x: 50, y: 10 });
    state = touchMove(guide, state, { x: 50, y: 100 });
    expect(state.strokeIndex).toBe(1);
  });
});
