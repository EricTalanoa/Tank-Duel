import rawWorlds from '../../spec/worlds.json';
import { CONSTANTS } from './constants';
import { buildMassOverrides } from './worldValidation';
import type { GeneratorId } from './generators';

export type WorldId = 'terra' | 'vesper' | 'rust' | 'selene' | 'ferrum' | 'hollow';
export type WindMode = 'reroll' | 'fixed' | 'none';
export interface WorldPhysics {
  readonly id: WorldId;
  readonly name: string;
  readonly kind: string;
  readonly gravity: number;
  readonly baseGravity: number;
  readonly airDrag: number;
  readonly width: number;
  readonly windRange: number;
  readonly windCoefficient: number;
  readonly windMode: WindMode;
  readonly flightTimeScale: number;
  readonly wrap: boolean;
  readonly generator: GeneratorId;
  readonly palette: {
    readonly sky: readonly string[];
    readonly ground: string;
    readonly edge: string;
    readonly accent: string;
  };
  readonly massOverrides: Readonly<Record<string, number>>;
  readonly derived: {
    readonly rangeAtPower75: number;
    readonly rangeAtPower100: number;
    readonly flightFramesAtPower100: number;
    readonly watchedSeconds: number;
  };
}

const SHIPPED_IDS: readonly WorldId[] = ['terra', 'vesper', 'rust', 'selene', 'ferrum', 'hollow'];

export const SHIPPED_WORLDS: readonly WorldPhysics[] = Object.freeze(
  SHIPPED_IDS.map((id) => {
    const source = rawWorlds.find((world) => world.id === id);
    if (!source) throw new Error(`${id} is missing from spec/worlds.json`);
    const profile: WorldPhysics = {
      id,
      name: source.name,
      kind: source.kind,
      gravity: source.gravity,
      baseGravity: CONSTANTS.baseGravity,
      airDrag: source.airDrag,
      width: source.width,
      windRange: source.windRange,
      windCoefficient: CONSTANTS.windCoefficient,
      windMode: source.windMode as WindMode,
      flightTimeScale: source.flightTimeScale,
      wrap: source.wrap,
      generator: source.generator as GeneratorId,
      palette: Object.freeze({
        sky: Object.freeze([...source.palette.sky]),
        ground: source.palette.ground,
        edge: source.palette.edge,
        accent: source.palette.accent,
      }),
      massOverrides: Object.freeze({}),
      derived: Object.freeze({ ...source.derived }),
    };
    return Object.freeze({
      ...profile,
      massOverrides: buildMassOverrides(profile),
    });
  }),
);

export function worldById(id: string): WorldPhysics {
  const world = SHIPPED_WORLDS.find((candidate) => candidate.id === id);
  if (!world) throw new Error(`Unknown shipped world: ${id}`);
  return world;
}

export function resolveWorldId(value: string | null): WorldId {
  return SHIPPED_WORLDS.some((world) => world.id === value) ? value as WorldId : 'terra';
}

export const TERRA: WorldPhysics = worldById('terra');
export const HOLLOW: WorldPhysics = worldById('hollow');
