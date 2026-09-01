import { describe, it, expect } from 'vitest';
import { createRng, hashSeed } from './rng';

const SEED = 0xc0ffee;

describe('mulberry32', () => {
  it('produces an identical sequence of 1000 values for the same seed', () => {
    const a = createRng(SEED);
    const b = createRng(SEED);

    const first = Array.from({ length: 1000 }, () => a.next());
    const second = Array.from({ length: 1000 }, () => b.next());

    expect(first).toEqual(second);
  });

  it('diverges for different seeds', () => {
    const a = Array.from({ length: 1000 }, createRng(SEED).next);
    const b = Array.from({ length: 1000 }, createRng(SEED + 1).next);
    expect(a).not.toEqual(b);
  });

  it('stays in [0, 1)', () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('resumes an exact stream from captured state', () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 137; i++) rng.next();

    const resumed = createRng(0);
    resumed.setState(rng.getState());

    const expected = Array.from({ length: 500 }, () => rng.next());
    const actual = Array.from({ length: 500 }, () => resumed.next());
    expect(actual).toEqual(expected);
  });

  it('clones without sharing state', () => {
    const rng = createRng(SEED);
    const clone = rng.clone();
    expect(clone.next()).toBe(rng.next());
    clone.next();
    expect(clone.getState()).not.toBe(rng.getState());
  });

  it('keeps int() and range() inside their bounds', () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 5000; i++) {
      const n = rng.int(6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);

      const r = rng.range(-100, 100);
      expect(r).toBeGreaterThanOrEqual(-100);
      expect(r).toBeLessThan(100);
    }
  });

  it('hashes seed strings deterministically to a uint32', () => {
    expect(hashSeed('terra-01')).toBe(hashSeed('terra-01'));
    expect(hashSeed('terra-01')).not.toBe(hashSeed('terra-02'));
    const h = hashSeed('terra-01');
    expect(h).toBe(h >>> 0);
  });
});
