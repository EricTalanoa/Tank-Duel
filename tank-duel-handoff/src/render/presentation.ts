import raw from '../../spec/presentation.json';

export interface PresentationPlayer {
  readonly id: 0 | 1;
  readonly label: string;
  readonly color: string;
}

export interface Presentation {
  readonly targetDevice: 'iPad';
  readonly requiredOrientation: 'landscape';
  readonly minimumLandscapeWidthPx: number;
  readonly players: readonly [PresentationPlayer, PresentationPlayer];
}

export function validatePresentation(value: unknown): Presentation {
  if (!isRecord(value) ||
    !hasExactKeys(value, ['targetDevice', 'requiredOrientation', 'minimumLandscapeWidthPx', 'players']) ||
    value.targetDevice !== 'iPad' || value.requiredOrientation !== 'landscape') {
    throw new Error('Presentation must target landscape iPad');
  }
  const minimumLandscapeWidthPx = value.minimumLandscapeWidthPx;
  if (typeof minimumLandscapeWidthPx !== 'number' ||
    !Number.isInteger(minimumLandscapeWidthPx) || minimumLandscapeWidthPx <= 0) {
    throw new Error('Presentation minimum landscape width must be a positive integer');
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
    players: Object.freeze([playerOne, playerTwo]) as readonly [PresentationPlayer, PresentationPlayer],
  });
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
