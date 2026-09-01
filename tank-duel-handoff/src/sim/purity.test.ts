import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * The lint rule from CLAUDE.md, implemented as a test so it runs in `npm run test`
 * without adding a linter dependency.
 *
 * `sim/` is pure: no DOM, no Canvas, no `window`, no `Math.random`. Headless tests,
 * replays and any future netcode all depend on it and all become impossible without it.
 */
const SIM_DIR = fileURLToPath(new URL('.', import.meta.url));

function simSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return simSources(path);
    if (!path.endsWith('.ts') || path.endsWith('.test.ts')) return [];
    return [path];
  });
}

const BANNED: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /\bMath\s*\.\s*random\b/, why: 'Math.random — use sim/rng.ts (mulberry32)' },
  { pattern: /\bdocument\b/, why: 'DOM access' },
  { pattern: /\bwindow\b/, why: 'window' },
  { pattern: /\bnavigator\b/, why: 'navigator' },
  { pattern: /\blocalStorage\b/, why: 'localStorage' },
  { pattern: /\bperformance\s*\.\s*now\b/, why: 'wall clock — the sim advances by step count' },
  { pattern: /\bDate\s*\.\s*now\b/, why: 'wall clock — the sim advances by step count' },
  { pattern: /\brequestAnimationFrame\b/, why: 'requestAnimationFrame belongs to main.ts' },
  { pattern: /\bCanvas|getContext\b/, why: 'Canvas' },
  { pattern: /from '\.\.\/render\//, why: 'sim must not import from render/' },
  { pattern: /from 'node:/, why: "node builtins — sim/ must run anywhere" },
];

/** Strips comments so prose about a banned name is not mistaken for a use of it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('sim purity', () => {
  const files = simSources(SIM_DIR);

  it('finds sim sources to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s uses no DOM, wall clock or Math.random', (file) => {
    const code = stripComments(readFileSync(file, 'utf8'));
    const violations = BANNED.filter(({ pattern }) => pattern.test(code)).map(({ why }) => why);
    expect(violations).toEqual([]);
  });

  it('runs headless — no browser globals in the test environment', () => {
    expect(typeof document).toBe('undefined');
    expect('window' in globalThis).toBe(false);
  });
});
