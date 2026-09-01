import rawShells from '../../spec/shells.json';

export interface Shell {
  readonly id: string;
  readonly slot: number;
  readonly name: string;
  readonly ammo: number | 'inf';
  readonly cost: number;
  readonly mass: number;
  readonly drag: number;
  readonly blastRadius: number;
  readonly damage: number;
  readonly terrain: 'carve' | 'fill' | 'column' | 'scorch' | 'none';
  readonly accent: string;
  readonly icon: string;
  readonly demoShot: {
    readonly elevation: number | null;
    readonly power: number | null;
  };
  readonly hooks?: ShellHooks;
  readonly noFlight?: boolean;
}

export interface ApexSplitHook {
  readonly split: number;
  readonly spreadVx?: number;
  readonly secondStageAfterFrames?: number;
  readonly secondStageSplit?: number;
  readonly maxDepth?: number;
  readonly totalSubmunitions?: number;
}

export interface SkipHook {
  readonly type: 'skip';
  readonly maxBounces: number;
  readonly horizontalRetention: number;
  readonly relaunchAngleFactor: number;
  readonly $comment?: string;
}

export interface DrillColumnHook {
  readonly type: 'drillColumn';
  readonly depthPx: number;
  readonly widthPx: number;
}

export interface AirburstHook {
  readonly triggerAltitudePx: number;
  readonly bomblets: number;
  readonly spacingPx: number;
  readonly armAfterExceedingPx: number;
}

export interface ScorchHook {
  readonly type: 'scorch';
  readonly halfWidthPx: number;
  readonly damagePerRound: number;
  readonly rounds: number;
}

export interface HealHook {
  readonly type: 'heal';
  readonly amount: number;
  readonly cooldownTurns: number;
  readonly cap: number;
}

export interface BurrowHook {
  readonly type: 'burrow';
  readonly distancePx: number;
}

export interface RollHook {
  readonly type: 'roll';
  readonly fuseFrames: number;
  readonly climbLimitPx: number;
  readonly speedPxPerFrame: number;
}

export interface FillHook {
  readonly type: 'fill';
  readonly $comment?: string;
}

export interface ShellHooks {
  readonly onApex?: ApexSplitHook;
  readonly onTerrainHit?: BurrowHook | RollHook | SkipHook | DrillColumnHook;
  readonly onDetonate?: FillHook | ScorchHook;
  readonly onAltitude?: AirburstHook;
  readonly onUse?: HealHook;
}

export const SHELLS: readonly Shell[] = rawShells as readonly Shell[];

const he = SHELLS.find((shell) => shell.id === 'he');
if (!he) throw new Error('HE shell is missing from spec/shells.json');
export const HE_SHELL: Shell = he;
