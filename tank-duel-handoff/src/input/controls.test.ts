import { describe, expect, it } from 'vitest';
import { attachPointerDragControls, shellSlotForCode } from './controls';

describe('shell slot controls', () => {
  it.each([1, 2, 3, 4, 5, 6])('maps Digit%i to its stable slot', (slot) => {
    expect(shellSlotForCode(`Digit${slot}`)).toBe(slot);
  });

  it('ignores keys outside the six-shell deck', () => {
    expect(shellSlotForCode('Digit0')).toBeNull();
    expect(shellSlotForCode('Digit7')).toBeNull();
  });

  it('limits digits to the active deck length', () => {
    expect(shellSlotForCode('Digit3', 3)).toBe(3);
    expect(shellSlotForCode('Digit4', 3)).toBeNull();
  });
});

describe('pointer drag controls', () => {
  it('captures one primary pointer and routes drag without firing on release', () => {
    const canvas = new FakeCanvas();
    const points: string[] = [];
    const controls = attachPointerDragControls(canvas as unknown as HTMLCanvasElement, {
      toField: (x, y) => ({ x, y }),
      onStart: () => true,
      onMove: ({ x, y }) => { points.push(`${x},${y}`); },
      onEnd: () => { points.push('end'); },
    });

    canvas.emit('pointerdown', pointer(7, 10, 20));
    canvas.emit('pointermove', pointer(7, 30, 40));
    canvas.emit('pointerup', pointer(7, 30, 40));

    expect(points).toEqual(['30,40', 'end']);
    expect(canvas.captured).toEqual([7]);
    expect(canvas.released).toEqual([7]);
    controls.dispose();
  });
});

function pointer(pointerId: number, clientX: number, clientY: number) {
  return { pointerId, clientX, clientY, button: 0, preventDefault() {} } as PointerEvent;
}

class FakeCanvas {
  readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>();
  readonly captured: number[] = [];
  readonly released: number[] = [];
  addEventListener(type: string, listener: (event: PointerEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: (event: PointerEvent) => void): void { this.listeners.get(type)?.delete(listener); }
  setPointerCapture(id: number): void { this.captured.push(id); }
  releasePointerCapture(id: number): void { this.released.push(id); }
  hasPointerCapture(id: number): boolean { return this.captured.includes(id) && !this.released.includes(id); }
  emit(type: string, event: PointerEvent): void { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}
