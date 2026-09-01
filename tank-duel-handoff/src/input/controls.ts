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

export interface PointerDragControlsOptions {
  toField(clientX: number, clientY: number): FieldPoint | null;
  onStart(point: FieldPoint): boolean;
  onMove(point: FieldPoint): void;
  onEnd(): void;
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

export function attachPointerDragControls(
  canvas: HTMLCanvasElement,
  options: PointerDragControlsOptions,
): Controls {
  let activePointer: number | null = null;
  const pointFor = (event: PointerEvent): FieldPoint | null =>
    options.toField(event.clientX, event.clientY);
  const onDown = (event: PointerEvent): void => {
    if (event.button !== 0 || activePointer !== null) return;
    const point = pointFor(event);
    if (!point || !options.onStart(point)) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointer) return;
    const point = pointFor(event);
    if (point) options.onMove(point);
    event.preventDefault();
  };
  const finish = (event: PointerEvent): void => {
    if (event.pointerId !== activePointer) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    activePointer = null;
    options.onEnd();
    event.preventDefault();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  return {
    dispose(): void {
      if (activePointer !== null && canvas.hasPointerCapture(activePointer)) {
        canvas.releasePointerCapture(activePointer);
      }
      activePointer = null;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', finish);
      canvas.removeEventListener('pointercancel', finish);
    },
  };
}
