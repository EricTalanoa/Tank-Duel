import { describe, expect, it } from 'vitest';
import { PRESENTATION } from '../render/presentation';
import { UI_SCALE_PROPERTY, mountUiScale, uiScaleFor } from './uiScale';

const { designSize, uiScaleBounds } = PRESENTATION;

describe('ui scale', () => {
  it('is 1 at the design size, and the smaller of the two fits everywhere else', () => {
    expect(uiScaleFor(designSize)).toBe(1);

    // A viewport twice the design in one axis only is still governed by the other, so the
    // design's full width and height are both available whenever the scale is unclamped.
    expect(uiScaleFor({ width: designSize.width * 2, height: designSize.height })).toBe(1);
    expect(uiScaleFor({ width: designSize.width, height: designSize.height * 2 })).toBe(1);
  });

  it.each([
    // iPad, the device this was built for.
    [{ width: 1194, height: 834 }, 1],
    // iPad 4:3 in landscape — height is generous, so width governs.
    [{ width: 1080, height: 810 }, 0.9],
    // A 1080p desktop, held at the ceiling rather than filling the screen with type.
    [{ width: 1920, height: 1080 }, 1.29],
    // A phone in landscape, held at the floor: legibility, not fit, is the constraint here.
    [{ width: 844, height: 390 }, uiScaleBounds.min],
  ] as const)('scales %o to %s', (size, scale) => {
    expect(uiScaleFor(size)).toBe(scale);
  });

  it('clamps to the spec bounds and survives a zero-sized viewport', () => {
    expect(uiScaleFor({ width: 100, height: 100 })).toBe(uiScaleBounds.min);
    expect(uiScaleFor({ width: 10_000, height: 10_000 })).toBe(uiScaleBounds.max);
    expect(uiScaleFor({ width: 0, height: 0 })).toBe(uiScaleBounds.min);
  });

  it('publishes the scale as a property, updates on viewport changes, and cleans up', () => {
    const root = new FakeRoot();
    const viewport = new FakeViewport(1194, 834);

    const scale = mountUiScale(root as unknown as HTMLElement, viewport as unknown as Window);
    expect(root.properties.get(UI_SCALE_PROPERTY)).toBe('1');
    expect(root.writes).toBe(1);

    viewport.resize(1920, 1080);
    viewport.dispatch('resize');
    expect(root.properties.get(UI_SCALE_PROPERTY)).toBe('1.29');

    // Rounded to two decimals, so a drag-resize does not relay the menus on every pixel.
    viewport.resize(1921, 1080);
    viewport.dispatch('resize');
    expect(root.writes).toBe(2);

    scale.dispose();
    scale.dispose();
    viewport.resize(844, 390);
    viewport.dispatch('resize');
    expect(root.properties.has(UI_SCALE_PROPERTY)).toBe(false);
    expect(viewport.listenerCount).toBe(0);
  });
});

class FakeRoot {
  readonly properties = new Map<string, string>();
  writes = 0;

  readonly style = {
    setProperty: (name: string, value: string): void => {
      this.writes++;
      this.properties.set(name, value);
    },
    removeProperty: (name: string): void => {
      this.properties.delete(name);
    },
  };
}

class FakeViewport {
  innerWidth: number;
  innerHeight: number;
  private readonly listeners = new Map<string, Set<() => void>>();

  constructor(width: number, height: number) {
    this.innerWidth = width;
    this.innerHeight = height;
  }

  get listenerCount(): number {
    return [...this.listeners.values()].reduce((total, set) => total + set.size, 0);
  }

  resize(width: number, height: number): void {
    this.innerWidth = width;
    this.innerHeight = height;
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}
