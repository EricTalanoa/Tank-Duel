/**
 * mulberry32 — the only source of randomness allowed inside `sim/`.
 *
 * `Math.random()` under sim/ breaks determinism, replays and every golden test in
 * `spec/test-vectors.json`. The generator state is a single uint32, so a run can be
 * captured, serialised and resumed exactly.
 */

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Next float in [min, max). */
  range(min: number, max: number): number;
  /** Current generator state — enough to resume this exact stream. */
  getState(): number;
  setState(state: number): void;
  /** Independent generator positioned at this one's current state. */
  clone(): Rng;
}

/** Turns an arbitrary string into a uint32 seed (FNV-1a). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    range: (min: number, max: number) => min + next() * (max - min),
    getState: () => s,
    setState: (state: number) => {
      s = state >>> 0;
    },
    clone: () => createRng(s),
  };

  return rng;
}
