/**
 * Typed view over `spec/constants.json`.
 *
 * The numbers are imported, never retyped. `spec/` is the source of truth and every
 * golden value in `spec/test-vectors.json` was produced with exactly these figures —
 * editing a number here (or shadowing one with a literal elsewhere) invalidates them.
 */
import raw from '../../spec/constants.json';

export interface PowerSpec {
  readonly min: number;
  readonly max: number;
  readonly coarseStep: number;
  readonly fineStep: number;
}

export interface ElevationSpec {
  readonly minDisplay: number;
  readonly maxDisplay: number;
  readonly coarseStep: number;
  readonly fineStep: number;
}

export interface TankSpec {
  readonly hullHalfWidth: number;
  readonly hullTop: number;
  readonly hullBottom: number;
  readonly turretPivotY: number;
  readonly muzzleOffset: number;
  readonly damageOriginY: number;
}

export interface DamageSpec {
  readonly falloff: string;
  readonly minFractionAtEdge: number;
  readonly edgePadding: number;
  readonly fallDamageThresholdPx: number;
  readonly fallDamagePerPx: number;
  readonly startingHealth: number;
}

export interface SettleSpec {
  readonly gravityPerFrame: number;
  readonly maxFallSpeed: number;
  readonly quietFrames: number;
  readonly particleThreshold: number;
  readonly hardExitFrames: number;
  readonly collisionGraceSubsteps: number;
}

export interface LoadoutSpec {
  /** Optional shells a player may take. The free shell rides on top of these. */
  readonly slots: number;
  readonly freeShell: string;
  readonly players: number;
}

export interface CameraSpec {
  readonly aimPaddingPx: number;
}

export interface Constants {
  readonly baseGravity: number;
  readonly muzzleCoefficient: number;
  readonly windCoefficient: number;
  readonly substeps: number;
  readonly fieldHeight: number;
  readonly defaultFieldWidth: number;
  readonly spawnInsetPx: number;
  readonly camera: CameraSpec;
  readonly simHz: number;
  readonly power: PowerSpec;
  readonly elevation: ElevationSpec;
  readonly tank: TankSpec;
  readonly damage: DamageSpec;
  readonly settle: SettleSpec;
  readonly loadout: LoadoutSpec;
}

export const CONSTANTS: Constants = raw;

// Named re-exports for the values used every frame. Same objects, no copies.
export const {
  muzzleCoefficient: MUZZLE_COEFFICIENT,
  substeps: SUBSTEPS,
  fieldHeight: FIELD_HEIGHT,
  simHz: SIM_HZ,
} = CONSTANTS;

export const PLAYER_COUNT = CONSTANTS.loadout.players;
