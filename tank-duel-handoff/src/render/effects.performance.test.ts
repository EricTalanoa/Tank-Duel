import { describe, expect, it } from 'vitest';
import { SHELLS } from '../sim/shells';
import type { PresentationEvent } from '../sim/presentation';
import { EFFECTS } from './effectConfig';
import { createEffects } from './effects';
import { motionPolicy } from './motion';

const drawContext = {
  globalAlpha: 1,
  fillStyle: '',
  save() {}, restore() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {},
} as unknown as CanvasRenderingContext2D;

describe('effects frame budget', () => {
  it('processes and draws a full reference blast under the configured frame budget', () => {
    const shell = SHELLS.find((candidate) => candidate.id === EFFECTS.performance.referenceShellId);
    if (!shell) throw new Error('Performance reference shell is missing');
    const impact: PresentationEvent = {
      type: 'impact', x: 500, y: 300, shellId: shell.id,
      accent: shell.accent, blastRadius: shell.blastRadius,
    };
    const runs = 200;
    for (let warmup = 0; warmup < 20; warmup++) {
      const effects = createEffects(warmup, motionPolicy(false));
      effects.consume([impact]);
      effects.advanceFrame();
      effects.draw(drawContext);
    }
    const start = performance.now();
    for (let run = 0; run < runs; run++) {
      const effects = createEffects(run, motionPolicy(false));
      effects.consume([impact]);
      effects.advanceFrame();
      effects.draw(drawContext);
    }
    expect((performance.now() - start) / runs).toBeLessThan(EFFECTS.performance.frameBudgetMs);
  });
});
