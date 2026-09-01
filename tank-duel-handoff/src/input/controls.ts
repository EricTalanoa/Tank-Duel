/**
 * Input layer. Translates browser events into field-space intent and hands them on.
 *
 * It never touches `sim/` state itself — `main.ts` decides what a press means and
 * the simulation enforces whether the current phase accepts that intent.
 */
import type { FieldPoint } from '../render/renderer';

export interface PointerControlsOptions {
  /** Viewport coordinates to field pixels; null when the press missed the field. */
  toField(clientX: number, clientY: number): FieldPoint | null;
  onPress(point: FieldPoint): void;
}

export interface Controls {
  dispose(): void;
}

export interface AimControlsOptions {
  readonly angleFineStep: number;
  readonly angleCoarseStep: number;
  readonly powerFineStep: number;
  readonly powerCoarseStep: number;
  readonly onAngle: (delta: number) => void;
  readonly onPower: (delta: number) => void;
  readonly onFire: () => void;
  readonly onShell: (slot: number) => void;
}

export function shellSlotForCode(code: string, deckSize = 6): number | null {
  const match = /^Digit(\d+)$/.exec(code);
  if (!match) return null;
  const slot = Number(match[1]);
  return slot >= 1 && slot <= deckSize ? slot : null;
}

export function attachAimControls(target: Window, options: AimControlsOptions): Controls {
  const handleKeyDown = (event: KeyboardEvent): void => {
    const shellSlot = shellSlotForCode(event.code);
    if (shellSlot !== null) {
      if (!event.repeat) options.onShell(shellSlot);
      event.preventDefault();
      return;
    }
    const angleStep = event.shiftKey ? options.angleCoarseStep : options.angleFineStep;
    const powerStep = event.shiftKey ? options.powerCoarseStep : options.powerFineStep;
    switch (event.key) {
      case 'ArrowLeft':
        options.onAngle(-angleStep);
        break;
      case 'ArrowRight':
        options.onAngle(angleStep);
        break;
      case 'ArrowUp':
        options.onPower(powerStep);
        break;
      case 'ArrowDown':
        options.onPower(-powerStep);
        break;
      case ' ':
      case 'Enter':
        if (!event.repeat) options.onFire();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  target.addEventListener('keydown', handleKeyDown);
  return { dispose: () => target.removeEventListener('keydown', handleKeyDown) };
}

export function attachPointerControls(
  canvas: HTMLCanvasElement,
  options: PointerControlsOptions,
): Controls {
  const handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const point = options.toField(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    options.onPress(point);
  };

  canvas.addEventListener('pointerdown', handlePointerDown);
  return { dispose: () => canvas.removeEventListener('pointerdown', handlePointerDown) };
}
