import raw from '../../spec/presentation.json';

export interface PresentationPlayer {
  readonly id: 0 | 1;
  readonly label: string;
  readonly color: string;
}

/** The one canvas the menus are drawn at. Every other viewport is that, scaled. */
export interface PresentationSize {
  readonly width: number;
  readonly height: number;
}

/** How far the design may be scaled before legibility, not fit, becomes the constraint. */
export interface PresentationScaleBounds {
  readonly min: number;
  readonly max: number;
}

export interface Presentation {
  readonly targetDevice: 'iPad';
  readonly requiredOrientation: 'landscape';
  readonly minimumLandscapeWidthPx: number;
  readonly designSize: PresentationSize;
  readonly uiScaleBounds: PresentationScaleBounds;
  readonly players: readonly [PresentationPlayer, PresentationPlayer];
}

export function validatePresentation(value: unknown): Presentation {
  if (!isRecord(value) ||
    !hasExactKeys(value, [
      'targetDevice', 'requiredOrientation', 'minimumLandscapeWidthPx', 'designSize',
      'uiScaleBounds', 'players',
    ]) ||
    value.targetDevice !== 'iPad' || value.requiredOrientation !== 'landscape') {
    throw new Error('Presentation must target landscape iPad');
  }
  const minimumLandscapeWidthPx = value.minimumLandscapeWidthPx;
  if (typeof minimumLandscapeWidthPx !== 'number' ||
    !Number.isInteger(minimumLandscapeWidthPx) || minimumLandscapeWidthPx <= 0) {
    throw new Error('Presentation minimum landscape width must be a positive integer');
  }
  const designSize = validateSize(value.designSize);
  const uiScaleBounds = validateScaleBounds(value.uiScaleBounds);
  if (designSize.width <= designSize.height) {
    throw new Error('Presentation design size must be landscape');
  }

  const playerValues = value.players;
  if (!Array.isArray(playerValues) || playerValues.length !== 2) {
    throw new Error('Presentation must define exactly two players');
  }

  const playerOne = validatePlayer(playerValues[0], 0);
  const playerTwo = validatePlayer(playerValues[1], 1);
  if (playerOne.color === playerTwo.color) {
    throw new Error('Presentation player colors must be distinct');
  }

  return Object.freeze({
    targetDevice: value.targetDevice,
    requiredOrientation: value.requiredOrientation,
    minimumLandscapeWidthPx,
    designSize,
    uiScaleBounds,
    players: Object.freeze([playerOne, playerTwo]) as readonly [PresentationPlayer, PresentationPlayer],
  });
}

function validateSize(value: unknown): PresentationSize {
  if (!isRecord(value) || !hasExactKeys(value, ['width', 'height']) ||
    !isPositiveInteger(value.width) || !isPositiveInteger(value.height)) {
    throw new Error('Presentation design size must be positive integer width and height');
  }
  return Object.freeze({ width: value.width, height: value.height });
}

/**
 * The floor exists because a viewport short enough to need it is a phone, and a design
 * scaled to fit one exactly would be too small to read. Below the floor the design is
 * allowed to overflow and the screen body scrolls, which is the better of two bad options.
 */
function validateScaleBounds(value: unknown): PresentationScaleBounds {
  if (!isRecord(value) || !hasExactKeys(value, ['min', 'max']) ||
    typeof value.min !== 'number' || typeof value.max !== 'number' ||
    !(value.min > 0) || !(value.max >= value.min)) {
    throw new Error('Presentation UI scale bounds must satisfy 0 < min <= max');
  }
  return Object.freeze({ min: value.min, max: value.max });
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validatePlayer(value: unknown, index: number): PresentationPlayer {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'label', 'color']) ||
    value.id !== index || (value.id !== 0 && value.id !== 1)) {
    throw new Error(`Presentation player ${index + 1} must have id ${index}`);
  }
  if (typeof value.label !== 'string' || value.label.trim().length === 0) {
    throw new Error(`Presentation player ${index + 1} must have a non-empty label`);
  }
  if (typeof value.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value.color)) {
    throw new Error(`Presentation player ${index + 1} must have a six-digit CSS hex color`);
  }
  return Object.freeze({ id: value.id, label: value.label, color: value.color });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

export const PRESENTATION = validatePresentation(raw);
