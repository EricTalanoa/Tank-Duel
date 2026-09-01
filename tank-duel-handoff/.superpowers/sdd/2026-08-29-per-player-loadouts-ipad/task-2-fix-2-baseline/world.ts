/**
 * The game state and the single step function that advances it.
 *
 * Pure: no DOM, no Canvas, no `window`, no `Math.random`. Everything that varies between
 * runs comes from `state.rng`, seeded at creation, so the same seed replays exactly.
 *
 * Deterministic round state. Terrain, ballistics, damage, and turn phases all
 * advance through the same fixed-step contract.
 */
import { CONSTANTS, FIELD_HEIGHT } from './constants';
import { DT } from './clock';
import { createRng, type Rng } from './rng';
import {
  carve,
  carveColumn,
  carveColumnWrapped,
  carveWrapped,
  createTerrain,
  fill,
  fillWrapped,
  generate,
  solidAt,
  solidAtWrapped,
  surfaceY,
  type DirtyRange,
  type DirtyRanges,
  type GeneratorId,
  type Terrain,
} from './terrain';
import {
  launchProjectile,
  stepProjectile,
  type Projectile,
  type TrailPoint,
} from './ballistics';
import { HE_SHELL } from './shells';
import { createLoadout, equippedWeapons } from './loadout';
import type { PlayerLoadouts } from './playerLoadouts';
import type { Shell } from './shells';
import {
  runApexHook,
  runAltitudeHook,
  runTerrainHitHook,
  stepRollingHook,
  STANDARD_SHELL_IDS,
  type TerrainHookContext,
  type Weapon,
} from './weapons';
import { TERRA, worldById, type WorldId, type WorldPhysics } from './worlds';
import { applyBlastDamage, fallDamage } from './damage';
import { pointInHull, type PresentationEvent } from './presentation';
import {
  createCollapseQueue,
  enqueueCollapseRanges,
  stepCollapse,
  type CollapseQueue,
} from './collapse';
import { applyRoundBoundaryZones, createFireZone, type FireZone } from './zones';
import { effectiveMassFor } from './worldValidation';
import { generateAcceptedTerrain } from './terrainValidation';
import { resolveGeneratorId } from './generators';
import { wrapX } from './wrap';

export interface Field {
  readonly width: number;
  readonly height: number;
}

export type Phase = 'aim' | 'flight' | 'resolve' | 'settle' | 'handoff' | 'round_over';

export interface Tank {
  readonly player: 0 | 1;
  x: number;
  y: number;
  readonly direction: -1 | 1;
  health: number;
  vy: number;
  fallFrom: number | null;
  readonly aim: { angleDeg: number; power: number };
  readonly trails: TrailPoint[][];
}

export type RoundResult = 0 | 1 | 'draw' | null;

export interface Arsenal {
  readonly slots: readonly Weapon[];
  readonly ammo: Record<string, number | 'inf'>;
  selectedShellId: string;
  lastRepairTurn: number | null;
}

export interface PendingImpact {
  readonly x: number;
  readonly y: number;
  readonly shell: Shell;
}

/** Player intent captured for one simulation step. */
export interface SimInput {}

export const NO_INPUT: SimInput = Object.freeze({});

export interface GameState {
  /** The seed this state was created from — enough to rebuild it from scratch. */
  readonly seed: number;
  /** Fixed steps elapsed since creation. */
  frame: number;
  readonly field: Field;
  readonly terrain: Terrain;
  readonly rng: Rng;
  launcher: Tank;
  aim: { angleDeg: number; power: number };
  wind: number;
  projectile: Projectile | null;
  projectiles: Projectile[];
  readonly trails: [TrailPoint[][], TrailPoint[][]];
  terrainDirty: DirtyRanges;
  phase: Phase;
  readonly tanks: [Tank, Tank];
  activePlayer: 0 | 1;
  turn: number;
  pendingImpact: PendingImpact | null;
  pendingImpacts: PendingImpact[];
  settleFrames: number;
  quietFrames: number;
  roundResult: RoundResult;
  readonly arsenals: [Arsenal, Arsenal];
  readonly presentationEvents: PresentationEvent[];
  readonly collapseQueue: CollapseQueue;
  readonly fireZones: FireZone[];
  readonly world: WorldPhysics;
  readonly generatorId: GeneratorId;
  readonly terrainGeneration: {
    readonly generatorId: GeneratorId;
    readonly acceptedSeed: number;
    readonly attempts: number;
    readonly usedFallback: boolean;
  };
}

export interface CreateWorldOptions {
  /** Field width in px. Defaults to `spec/constants.json → defaultFieldWidth`; Task 8 supplies it per world. */
  readonly width?: number;
  readonly height?: number;
  /** Terrain generator from `spec/generators.json`. The rest arrive at Task 9. */
  readonly generator?: GeneratorId;
  readonly worldId?: WorldId;
  /** Complete stable decks, including locked HE in slot one, for each local player. */
  readonly playerLoadoutIds?: PlayerLoadouts;
}

export function createWorld(seed: number, options: CreateWorldOptions = {}): GameState {
  const world = options.worldId ? worldById(options.worldId) : TERRA;
  const field: Field = {
    width: options.width ?? world.width,
    height: options.height ?? FIELD_HEIGHT,
  };
  const rng = createRng(seed);
  const generatorId = resolveGeneratorId(options.generator ?? world.generator, world.generator);
  const accepted = field.width === world.width && field.height === FIELD_HEIGHT
    ? generateAcceptedTerrain({ world, generatorId, requestedSeed: seed, height: field.height })
    : null;
  const terrain = accepted?.terrain ?? createTerrain(field.width, field.height);
  if (accepted) {
    if (accepted.rngState !== undefined) rng.setState(accepted.rngState);
  } else {
    generate(terrain, generatorId, rng);
  }
  const launcherX = CONSTANTS.spawnInsetPx;
  const rightX = field.width - CONSTANTS.spawnInsetPx;
  const demo = HE_SHELL.demoShot;
  if (demo.elevation === null || demo.power === null) {
    throw new Error('HE shell requires a demo shot in spec/shells.json');
  }
  const makeAim = () => ({ angleDeg: demo.elevation as number, power: demo.power as number });
  const tanks: [Tank, Tank] = [
    {
      player: 0,
      x: launcherX,
      y: surfaceY(terrain, launcherX) - 1,
      direction: 1,
      health: CONSTANTS.damage.startingHealth,
      vy: 0,
      fallFrom: null,
      aim: makeAim(),
      trails: [],
    },
    {
      player: 1,
      x: rightX,
      y: surfaceY(terrain, rightX) - 1,
      direction: -1,
      health: CONSTANTS.damage.startingHealth,
      vy: 0,
      fallFrom: null,
      aim: makeAim(),
      trails: [],
    },
  ];
  const playerLoadoutIds =
    options.playerLoadoutIds ?? ([STANDARD_SHELL_IDS, STANDARD_SHELL_IDS] as const);
  const makeArsenal = (deckIds: readonly string[]): Arsenal => {
    const deck = equippedWeapons(createLoadout(deckIds));
    return {
      slots: deck,
      ammo: Object.fromEntries(
        deck.map((weapon) => [weapon.shell.id, weapon.shell.ammo]),
      ),
      selectedShellId: HE_SHELL.id,
      lastRepairTurn: null,
    };
  };
  return {
    seed: seed >>> 0,
    frame: 0,
    field,
    terrain,
    rng,
    launcher: tanks[0],
    aim: tanks[0].aim,
    wind: rollWind(world, rng),
    projectile: null,
    projectiles: [],
    trails: [tanks[0].trails, tanks[1].trails],
    terrainDirty: [],
    phase: 'aim',
    tanks,
    activePlayer: 0,
    turn: 1,
    pendingImpact: null,
    pendingImpacts: [],
    settleFrames: 0,
    quietFrames: 0,
    roundResult: null,
    arsenals: [makeArsenal(playerLoadoutIds[0]), makeArsenal(playerLoadoutIds[1])],
    presentationEvents: [],
    collapseQueue: createCollapseQueue(field.width),
    fireZones: [],
    world,
    generatorId,
    terrainGeneration: {
      generatorId,
      acceptedSeed: accepted?.acceptedSeed ?? (seed >>> 0),
      attempts: accepted?.attempts ?? 1,
      usedFallback: accepted?.usedFallback ?? false,
    },
  };
}

/** Launch the active player's HE shell when the round is accepting aim input. */
export function fire(state: GameState): boolean {
  if (state.phase !== 'aim' || state.projectile) return false;
  const angle = (state.aim.angleDeg * Math.PI) / 180;
  const tank = state.tanks[state.activePlayer];
  const arsenal = state.arsenals[state.activePlayer];
  const weapon = arsenal.slots.find((candidate) => candidate.shell.id === arsenal.selectedShellId);
  if (!weapon) return false;
  const remaining = arsenal.ammo[weapon.shell.id];
  if (remaining === undefined || remaining === 0) return false;
  const useHook = weapon.shell.hooks?.onUse;
  if (weapon.shell.noFlight && useHook?.type === 'heal') {
    if (arsenal.lastRepairTurn !== null &&
      state.turn - arsenal.lastRepairTurn <= useHook.cooldownTurns) return false;
    tank.health = Math.min(useHook.cap, tank.health + useHook.amount);
    arsenal.lastRepairTurn = state.turn;
    consumeAmmo(arsenal, weapon, remaining);
    state.settleFrames = 0;
    state.quietFrames = 0;
    state.phase = 'settle';
    return true;
  }
  const pivotY = tank.y + CONSTANTS.tank.turretPivotY;
  const projectile = launchProjectile({
    x: tank.x + Math.cos(angle) * CONSTANTS.tank.muzzleOffset * tank.direction,
    y: pivotY - Math.sin(angle) * CONSTANTS.tank.muzzleOffset,
    angleDeg: state.aim.angleDeg,
    power: state.aim.power,
    direction: tank.direction,
    shell: weapon.shell,
    effectiveMass: effectiveMassFor(state.world, weapon.shell),
  });
  state.projectile = projectile;
  state.projectiles = [projectile];
  state.phase = 'flight';
  const trails = tank.trails;
  trails.push(projectile.trail);
  if (trails.length > 3) trails.shift();
  consumeAmmo(arsenal, weapon, remaining);
  state.presentationEvents.push({
    type: 'muzzleFlash',
    x: projectile.x,
    y: projectile.y,
    shellId: weapon.shell.id,
    accent: weapon.shell.accent,
  });
  return true;
}

export function selectShell(state: GameState, slot: number): boolean {
  if (state.phase !== 'aim') return false;
  const arsenal = state.arsenals[state.activePlayer];
  const weapon = arsenal.slots[slot - 1];
  if (!weapon || arsenal.ammo[weapon.shell.id] === 0) return false;
  const useHook = weapon.shell.hooks?.onUse;
  if (useHook?.type === 'heal' && arsenal.lastRepairTurn !== null &&
    state.turn - arsenal.lastRepairTurn <= useHook.cooldownTurns) return false;
  arsenal.selectedShellId = weapon.shell.id;
  return true;
}

function consumeAmmo(arsenal: Arsenal, weapon: Weapon, remaining: number | 'inf'): void {
  if (typeof remaining !== 'number') return;
  arsenal.ammo[weapon.shell.id] = remaining - 1;
  if (remaining - 1 === 0) arsenal.selectedShellId = CONSTANTS.loadout.freeShell;
}

export function adjustAngle(state: GameState, delta: number): void {
  if (state.phase !== 'aim') return;
  state.aim.angleDeg = Math.max(
    CONSTANTS.elevation.minDisplay,
    Math.min(CONSTANTS.elevation.maxDisplay, state.aim.angleDeg + delta),
  );
}

export function adjustPower(state: GameState, delta: number): void {
  if (state.phase !== 'aim') return;
  state.aim.power = Math.max(
    CONSTANTS.power.min,
    Math.min(CONSTANTS.power.max, state.aim.power + delta),
  );
}

/**
 * Advance one fixed step. Mutates and returns the same object — the loop runs this up to
 * 15 times a frame and a fresh state each time would allocate for nothing.
 */
export function step(state: GameState, _input: SimInput = NO_INPUT): GameState {
  state.frame++;
  switch (state.phase) {
    case 'aim':
    case 'round_over':
      return state;
    case 'flight':
      stepFlight(state);
      return state;
    case 'resolve':
      resolve(state);
      return state;
    case 'settle':
      settle(state);
      return state;
    case 'handoff':
      handoff(state);
      return state;
  }
  return state;
}

function stepFlight(state: GameState): void {
  if (state.projectiles.length === 0 && state.projectile) {
    state.projectiles = [state.projectile];
  }
  if (state.projectiles.length === 0) {
    state.projectile = null;
    state.phase = 'resolve';
    return;
  }

  const next: Projectile[] = [];
  const hookContext = terrainHookContext(state);
  for (const projectile of state.projectiles) {
    if (projectile.mode === 'rolling') {
      const rolled = stepRollingHook(projectile, hookContext);
      if (rolled.status === 'detonate') queueImpact(state, projectile, rolled.x, rolled.y);
      else next.push(projectile);
      continue;
    }

    const result = stepProjectile(projectile, {
      world: state.world,
      wind: state.wind,
      solidAt: (x, y) => terrainSolidAt(state, x, y) || projectileHitsHull(state, x, y),
    });
    const altitudeChildren = runAltitudeHook(
      projectile,
      (x) => surfaceY(state.terrain, canonicalTerrainX(state, x)),
    );
    if (altitudeChildren) {
      next.push(...altitudeChildren);
      continue;
    }
    const children = runApexHook(projectile);
    if (children) {
      next.push(...children);
      continue;
    }
    if (result.hit) {
      projectile.trail.push({ x: projectile.x, y: projectile.y });
      if (projectileHitsHull(state, projectile.x, projectile.y)) {
        queueImpact(state, projectile, projectile.x, projectile.y);
      } else {
        const handled = runTerrainHitHook(projectile, hookContext);
        if (handled.status === 'detonate') queueImpact(state, projectile, handled.x, handled.y);
        else next.push(projectile);
      }
    } else if (!projectileMissed(state, projectile)) {
      next.push(projectile);
    }
  }

  state.projectiles = next;
  state.projectile = next[0] ?? null;
  if (next.length === 0) state.phase = 'resolve';
}

function projectileMissed(state: GameState, projectile: Projectile): boolean {
  const missedHorizontally = !state.world.wrap && (
    projectile.x < -state.field.width || projectile.x > state.field.width * 2
  );
  return missedHorizontally || projectile.y > state.field.height * 2;
}

function queueImpact(state: GameState, projectile: Projectile, x: number, y: number): void {
  state.pendingImpacts.push({ x: canonicalWorldX(state, x), y, shell: projectile.shell });
}

function canonicalWorldX(state: GameState, x: number): number {
  return state.world.wrap ? wrapX(x, state.field.width) : x;
}

function canonicalTerrainX(state: GameState, x: number): number {
  return state.world.wrap ? wrapX(x, state.terrain.width) : x;
}

function terrainSolidAt(state: GameState, x: number, y: number): boolean {
  return state.world.wrap
    ? solidAtWrapped(state.terrain, x, y)
    : solidAt(state.terrain, x, y);
}

function projectileHitsHull(state: GameState, x: number, y: number): boolean {
  const wrapWidth = state.world.wrap ? state.field.width : undefined;
  return state.tanks.some((tank) => tank.health > 0 && pointInHull(tank, x, y, wrapWidth));
}

export function tankHullBox(tank: Tank) {
  return {
    x0: tank.x - CONSTANTS.tank.hullHalfWidth,
    y0: tank.y + CONSTANTS.tank.hullTop,
    x1: tank.x + CONSTANTS.tank.hullHalfWidth,
    y1: tank.y + CONSTANTS.tank.hullBottom,
  };
}

function terrainHookContext(state: GameState): TerrainHookContext {
  return {
    width: state.field.width,
    height: state.field.height,
    wrap: state.world.wrap,
    surfaceY: (x) => surfaceY(state.terrain, canonicalTerrainX(state, x)),
    hullBoxes: state.tanks.map(tankHullBox),
  };
}

function resolve(state: GameState): void {
  const impacts = state.pendingImpact
    ? [state.pendingImpact, ...state.pendingImpacts]
    : state.pendingImpacts;
  for (const pending of impacts) {
    const impact: PendingImpact = state.world.wrap
      ? { ...pending, x: canonicalWorldX(state, pending.x) }
      : pending;
    state.presentationEvents.push({
      type: 'impact',
      x: impact.x,
      y: impact.y,
      shellId: impact.shell.id,
      accent: impact.shell.accent,
      blastRadius: impact.shell.blastRadius,
    });
    for (const tank of state.tanks) {
      if (pointInHull(
        tank,
        impact.x,
        impact.y,
        state.world.wrap ? state.field.width : undefined,
      )) {
        state.presentationEvents.push({
          type: 'directHit',
          x: impact.x,
          y: impact.y,
          shellId: impact.shell.id,
          player: tank.player,
        });
      }
    }
    const detonateType = impact.shell.hooks?.onDetonate?.type;
    if (detonateType === 'scorch') state.fireZones.push(createFireZone(impact.x, impact.shell));
    const terrainHook = impact.shell.hooks?.onTerrainHit;
    const dirtyRanges: DirtyRanges = impact.shell.terrain === 'scorch' || impact.shell.terrain === 'none'
      ? []
      : impact.shell.terrain === 'column' && terrainHook?.type === 'drillColumn'
      ? state.world.wrap
        ? carveColumnWrapped(
          state.terrain,
          impact.x,
          impact.y,
          terrainHook.widthPx,
          terrainHook.depthPx,
        )
        : asDirtyRanges(carveColumn(
          state.terrain,
          impact.x,
          impact.y,
          terrainHook.widthPx,
          terrainHook.depthPx,
        ))
      : detonateType === 'fill'
        ? state.world.wrap
          ? fillWrapped(
            state.terrain,
            impact.x,
            impact.y,
            impact.shell.blastRadius,
            state.tanks.map(tankHullBox),
          )
          : asDirtyRanges(fill(
            state.terrain,
            impact.x,
            impact.y,
            impact.shell.blastRadius,
            state.tanks.map(tankHullBox),
          ))
        : state.world.wrap
          ? carveWrapped(state.terrain, impact.x, impact.y, impact.shell.blastRadius)
          : asDirtyRanges(carve(state.terrain, impact.x, impact.y, impact.shell.blastRadius));
    state.terrainDirty = mergeDirtyRanges(state.terrainDirty, dirtyRanges);
    enqueueCollapseRanges(state.collapseQueue, dirtyRanges);
    applyBlastDamage(
      state.tanks,
      impact.x,
      impact.y,
      impact.shell.damage,
      impact.shell.blastRadius,
      state.world.wrap ? state.field.width : undefined,
    );
  }
  state.pendingImpact = null;
  state.pendingImpacts = [];
  state.settleFrames = 0;
  state.quietFrames = 0;
  state.phase = 'settle';
}

function asDirtyRanges(range: DirtyRange): DirtyRanges {
  return range.x1 > range.x0 ? [range] : [];
}

function mergeDirtyRanges(left: DirtyRanges, right: DirtyRanges): DirtyRanges {
  if (left.length === 0) return right;
  if (right.length === 0) return left;

  const merged: DirtyRange[] = [];
  const ranges = [...left, ...right].sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1);
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || last.x1 < range.x0) {
      merged.push(range);
      continue;
    }
    merged[merged.length - 1] = { x0: last.x0, x1: Math.max(last.x1, range.x1) };
  }
  return merged;
}

function isGrounded(state: GameState, tank: Tank): boolean {
  return solidAt(state.terrain, tank.x, tank.y + 1);
}

function settle(state: GameState): void {
  const collapse = stepCollapse(state.terrain, state.collapseQueue);
  state.terrainDirty = mergeDirtyRanges(state.terrainDirty, collapse.dirtyRanges);
  let moved = collapse.moved;
  for (const tank of state.tanks) {
    if (tank.health <= 0) continue;

    let digSteps = 0;
    while (
      solidAt(state.terrain, tank.x, tank.y + CONSTANTS.tank.damageOriginY) &&
      digSteps < state.field.height
    ) {
      tank.y--;
      digSteps++;
      moved = true;
    }

    if (!isGrounded(state, tank)) {
      if (tank.fallFrom === null) tank.fallFrom = tank.y;
      tank.vy = Math.min(tank.vy + CONSTANTS.settle.gravityPerFrame, CONSTANTS.settle.maxFallSpeed);
      let remaining = tank.vy;
      while (remaining > 0 && !isGrounded(state, tank)) {
        const distance = Math.min(1, remaining);
        tank.y += distance;
        remaining -= distance;
        moved = true;
      }
    }

    if (isGrounded(state, tank)) {
      if (tank.fallFrom !== null) {
        tank.health = Math.max(0, tank.health - fallDamage(tank.y - tank.fallFrom));
        tank.fallFrom = null;
      }
      tank.vy = 0;
    }
  }

  state.settleFrames++;
  state.quietFrames = moved ? 0 : state.quietFrames + 1;
  if (
    state.quietFrames >= CONSTANTS.settle.quietFrames ||
    state.settleFrames >= CONSTANTS.settle.hardExitFrames
  ) {
    finishSettle(state);
  }
}

function finishSettle(state: GameState): void {
  const dead0 = state.tanks[0].health <= 0;
  const dead1 = state.tanks[1].health <= 0;
  if (dead0 || dead1) {
    state.roundResult = dead0 && dead1 ? 'draw' : dead0 ? 1 : 0;
    state.phase = 'round_over';
  } else {
    state.phase = 'handoff';
  }
}

function handoff(state: GameState): void {
  state.activePlayer = state.activePlayer === 0 ? 1 : 0;
  if (state.activePlayer === 0) {
    applyRoundBoundaryZones(
      state.fireZones,
      state.tanks,
      state.world.wrap ? state.field.width : undefined,
    );
    state.turn++;
  }
  const tank = state.tanks[state.activePlayer];
  state.launcher = tank;
  state.aim = tank.aim;
  if (state.world.windMode === 'reroll') state.wind = rollWind(state.world, state.rng);
  state.phase = 'aim';
}

function rollWind(world: WorldPhysics, rng: Rng): number {
  if (world.windMode === 'none') return 0;
  return Math.round(rng.range(-world.windRange, world.windRange));
}

/** Simulated seconds elapsed. Derived from the step count, never from wall clock. */
export function simSeconds(state: GameState): number {
  return state.frame * DT;
}
