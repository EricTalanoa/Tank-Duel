import { describe, expect, it } from 'vitest';
import { firingSolutionLayout } from './hud';

describe('touch-safe match HUD layout', () => {
  it('bottom-aligns the compact firing solution between touch-control groups', () => {
    const viewport = { width: 1194, height: 834 };
    const panel = firingSolutionLayout(viewport);

    expect(panel).toEqual({ x: 354, y: 700, width: 220, height: 122 });
    expect(panel.y + panel.height).toBe(viewport.height - 12);
  });
});
