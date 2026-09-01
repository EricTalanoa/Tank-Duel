# Per-Player Loadouts and iPad Landscape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both local players independent side-by-side decks, require landscape iPad presentation, and render Player 1 Blue and Player 2 Pink during combat.

**Architecture:** A spec-backed `PlayerLoadouts` tuple travels from one two-panel loadout owner through the controller and match runtime into world creation, where each arsenal is initialized independently. A UI-layer orientation gate pauses scenes/runtime and blocks the app without entering `sim/`; a render-only presentation registry owns player colors.

**Tech Stack:** TypeScript, Vitest, DOM/canvas APIs, CSS media/layout rules, Vite.

**Spec:** `docs/superpowers/specs/2026-08-29-per-player-loadouts-ipad-design.md`

## Global Constraints

- `spec/*.json` is the source of truth; production imports new values instead of retyping them.
- Never edit or regenerate `spec/test-vectors.json`.
- Both players independently receive the existing spec-backed points, optional-slot, and free-HE rules.
- Landscape iPad is required; portrait blocks interaction and does not reset match state.
- Player 1 is Blue and Player 2 is Pink only for player-owned combat presentation; menus/loadout remain neutral.
- Do not implement CPU deck generation/aiming, Task 13 ammunition behavior, or the later full visual overhaul.
- This workspace is not a Git repository. Replace commit steps with checkpoint reports and independent review gates; do not initialize Git.
- Because C: is full, use D: for test/build temporary output where required.

---

### Task 1: Machine-readable presentation and two-player contracts

**Files:**
- Create: `spec/presentation.json`
- Modify: `spec/constants.json`
- Modify: `spec/screens.json`
- Create: `src/render/presentation.ts`
- Create: `src/render/presentation.test.ts`
- Modify: `src/sim/constants.ts`
- Modify: `src/sim/constants.test.ts`
- Create: `src/sim/playerLoadouts.ts`
- Create: `src/sim/playerLoadouts.test.ts`
- Create: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-1-report.md`

**Interfaces:**
- Produces: `PLAYER_COUNT: 2`, `type PlayerIndex = 0 | 1`, `type PlayerLoadouts = readonly [readonly string[], readonly string[]]`.
- Produces: `PRESENTATION.requiredOrientation`, `PRESENTATION.minimumLandscapeWidthPx`, and `PRESENTATION.players[player].color`.
- Consumes: existing `CONSTANTS.loadout.points`, `slots`, and `freeShell`; no budget values are duplicated.

- [ ] **Step 1: Add failing source-contract tests**

```ts
expect(CONSTANTS.loadout.players).toBe(2);
expect(PLAYER_COUNT).toBe(CONSTANTS.loadout.players);
expect(PRESENTATION.requiredOrientation).toBe('landscape');
expect(PRESENTATION.players.map(({ label }) => label)).toEqual(['Player 1', 'Player 2']);
expect(PRESENTATION.players[0].color).not.toBe(PRESENTATION.players[1].color);
expect(makePlayerLoadouts(['he'], ['he', 'mortar'])).toEqual([
  ['he'],
  ['he', 'mortar'],
]);
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npm test -- --configLoader runner src/render/presentation.test.ts src/sim/playerLoadouts.test.ts src/sim/constants.test.ts`

Expected: FAIL because the spec fields, registry, and tuple helper do not exist.

- [ ] **Step 3: Add the new source-of-truth fields**

Create `spec/presentation.json` with this exact initial contract:

```json
{
  "targetDevice": "iPad",
  "requiredOrientation": "landscape",
  "minimumLandscapeWidthPx": 900,
  "players": [
    { "id": 0, "label": "Player 1", "color": "#4DA3FF" },
    { "id": 1, "label": "Player 2", "color": "#FF5CA8" }
  ]
}
```

Add `"players": 2` under `constants.json → loadout`. Add a `LOADOUT` screen record to `screens.json` with `layout: "side-by-side"`, `players: ["Player 1", "Player 2"]`, and `deploy: "shared"`. Do not change existing screen paths or test vectors.

- [ ] **Step 4: Implement strict spec readers and tuple types**

```ts
export const PLAYER_COUNT = CONSTANTS.loadout.players;
export type PlayerIndex = 0 | 1;
export type PlayerLoadouts = readonly [readonly string[], readonly string[]];

export function makePlayerLoadouts(
  playerOne: readonly string[],
  playerTwo: readonly string[],
): PlayerLoadouts {
  return Object.freeze([
    Object.freeze([...playerOne]),
    Object.freeze([...playerTwo]),
  ]);
}
```

Validate that presentation players are exactly IDs 0 and 1, labels are non-empty, colors are CSS hex values, orientation is `landscape`, and minimum width is a positive integer.

- [ ] **Step 5: Run focused and purity tests**

Run: `npm test -- --configLoader runner src/render/presentation.test.ts src/sim/playerLoadouts.test.ts src/sim/constants.test.ts src/sim/purity.test.ts`

Expected: PASS, with no DOM/browser import entering `src/sim/`.

- [ ] **Step 6: Record and review checkpoint 1**

Write the exact commands, pass counts, changed files, and source-of-truth audit to `task-1-report.md`; run a fresh independent review before Task 2.

---

### Task 2: Independent world arsenals

**Files:**
- Modify: `src/sim/world.ts`
- Modify: `src/sim/world.test.ts`
- Modify: `src/sim/repair.test.ts`
- Modify: `src/sim/standard-shells.test.ts`
- Modify: `src/sim/exotic-projectiles.test.ts`
- Modify only callers exposed by TypeScript failures that construct worlds with `loadoutIds`
- Create: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-2-report.md`

**Interfaces:**
- Consumes: `PlayerLoadouts` from Task 1.
- Produces: `CreateWorldOptions.playerLoadoutIds?: PlayerLoadouts`.
- Removes: shared `CreateWorldOptions.loadoutIds` after all callers migrate; do not retain two competing contracts.

- [ ] **Step 1: Write failing distinct-arsenal tests**

```ts
const playerLoadoutIds = makePlayerLoadouts(
  ['he', 'mortar', 'cluster'],
  ['he', 'roller', 'sand'],
);
const state = createWorld(71, { playerLoadoutIds });

expect(state.arsenals[0].slots.map(({ shell }) => shell.id)).toEqual(playerLoadoutIds[0]);
expect(state.arsenals[1].slots.map(({ shell }) => shell.id)).toEqual(playerLoadoutIds[1]);
state.arsenals[0].ammo.mortar = 0;
expect(state.arsenals[1].ammo.mortar).toBeUndefined();
expect(state.arsenals[1].ammo.roller).toBeGreaterThan(0);
```

Also prove slot key `2` selects each active player's own second shell after a turn handoff.

- [ ] **Step 2: Run world tests and confirm RED**

Run: `npm test -- --configLoader runner src/sim/world.test.ts src/sim/turns.test.ts`

Expected: FAIL because `createWorld` still clones one shared deck.

- [ ] **Step 3: Replace the shared world option**

```ts
export interface CreateWorldOptions {
  readonly width?: number;
  readonly height?: number;
  readonly generator?: GeneratorId;
  readonly worldId?: WorldId;
  readonly playerLoadoutIds?: PlayerLoadouts;
}
```

Resolve one default valid deck, use it for each missing tuple entry only at the option boundary, and call arsenal construction separately so arrays/ammo maps never alias.

- [ ] **Step 4: Migrate direct world callers mechanically**

Replace `{ loadoutIds: ids }` with `{ playerLoadoutIds: makePlayerLoadouts(['he', ...ids], ['he', ...ids]) }` only where the old test intentionally wants identical decks. Do not retype point/slot values.

- [ ] **Step 5: Run simulation and purity regressions**

Run: `npm test -- --configLoader runner src/sim`

Expected: all simulation tests pass and `spec/test-vectors.json` remains unchanged.

- [ ] **Step 6: Record and review checkpoint 2**

Document migrations and proof of non-aliased arsenals in `task-2-report.md`; require independent review.

---

### Task 3: Runtime and controller tuple plumbing

**Files:**
- Modify: `src/app/matchRuntime.ts`
- Modify: `src/app/matchRuntime.test.ts`
- Modify: `src/app/controller.ts`
- Modify: `src/app/controller.test.ts`
- Modify: `src/main.ts`
- Create: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-3-report.md`

**Interfaces:**
- Consumes: `PlayerLoadouts` and `CreateWorldOptions.playerLoadoutIds`.
- Produces: `AppControllerLoadoutOptions.onDeploy(loadouts: PlayerLoadouts)` and `AppControllerRuntimeOptions.playerLoadoutIds`.
- Produces: runtime `setPaused(paused: boolean): void` for the orientation gate in Task 5.

- [ ] **Step 1: Write failing tuple/lifecycle tests**

```ts
expect(runtimeCreateWorld).toHaveBeenCalledWith(seed, expect.objectContaining({
  playerLoadoutIds,
}));

harness.loadouts[0]!.options.onDeploy(playerLoadoutIds);
expect(harness.runtimes[0]!.options.playerLoadoutIds).toEqual(playerLoadoutIds);

harness.runtimes[0]!.options.onComplete(recap);
harness.dispatch({ type: 'rematch', seed: nextSeed });
expect(harness.runtimes[1]!.options.playerLoadoutIds).toEqual(playerLoadoutIds);

harness.runtimes[1]!.options.onComplete(recap);
harness.dispatch({ type: 'changeLoadout' });
expect(harness.loadouts[1]!.options.initialPlayerLoadoutIds).toEqual(playerLoadoutIds);
```

Add a runtime test proving `setPaused(true)` cancels or suppresses frame advancement without disposal, and `setPaused(false)` schedules exactly one continuation.

- [ ] **Step 2: Run controller/runtime tests and confirm RED**

Run: `npm test -- --configLoader runner src/app/controller.test.ts src/app/matchRuntime.test.ts`

Expected: FAIL on missing tuple and pause interfaces.

- [ ] **Step 3: Implement immutable controller ownership**

Replace `selectedLoadoutIds` with `selectedPlayerLoadoutIds: PlayerLoadouts | null`. Copy through `makePlayerLoadouts` at callback boundaries. Rematch reuses the same values, Change Loadout sends both as initial state, and stale callbacks remain generation/screen guarded.

- [ ] **Step 4: Implement idempotent runtime pause**

```ts
export interface MatchRuntime {
  readonly state: GameState;
  setPaused(paused: boolean): void;
  dispose(): void;
}
```

Pausing cancels the pending frame and records paused state. Resuming resets the frame-time baseline and schedules one frame. Repeated pause/resume calls are no-ops. Disposal while paused remains final.

- [ ] **Step 5: Wire `main.ts` without stripping the tuple**

Pass `playerLoadoutIds` from the controller runtime options into `createMatchRuntime`; pass it from runtime into `createWorld` unchanged.

- [ ] **Step 6: Run focused regressions and typecheck**

Run: `npm test -- --configLoader runner src/app/controller.test.ts src/app/matchRuntime.test.ts src/sim/world.test.ts`

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Record and review checkpoint 3**

Document tuple equality, rematch/loadout restoration, one-runtime counts, pause scheduling, and TypeScript output in `task-3-report.md`; require independent review.

---

### Task 4: Side-by-side independent loadout owner

**Files:**
- Modify: `src/ui/loadout.ts`
- Modify: `src/ui/loadout.test.ts`
- Modify: `src/ui/loadout.css`
- Modify: `src/main.ts`
- Create: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-4-report.md`

**Interfaces:**
- Consumes: `PlayerLoadouts`, spec-backed player labels, existing pure `createLoadout`/`validateLoadout`, and `enabledShellIds`.
- Produces: `MountLoadoutOptions.onDeploy(loadouts: PlayerLoadouts)` and `initialPlayerLoadoutIds?: PlayerLoadouts`.

- [ ] **Step 1: Write failing independent-editor model tests**

```ts
const model = createPlayerLoadoutEditorModel({
  enabledShellIds,
  initialPlayerLoadoutIds,
});
const beforePlayerTwo = structuredClone(model.players[1].deploymentIds);
model.toggle(0, 'mortar');

expect(model.players[1].deploymentIds).toEqual(beforePlayerTwo);
expect(model.players[0].validation.pointsUsed).not.toBe(
  model.players[1].validation.pointsUsed,
);
expect(model.canDeploy).toBe(
  model.players.every(({ validation }) => validation.valid),
);
```

Add DOM tests for two labelled regions, two independent counters, locked HE in both, one Deploy button, stable tuple order, idempotent disposal, and minimum 44×44 CSS-pixel card/deploy targets.

- [ ] **Step 2: Run loadout tests and confirm RED**

Run: `npm test -- --configLoader runner src/ui/loadout.test.ts`

Expected: FAIL because the owner still contains one shared model.

- [ ] **Step 3: Split pure model from DOM rendering**

```ts
export interface PlayerLoadoutEditorModel {
  readonly players: readonly [PlayerLoadoutPanelModel, PlayerLoadoutPanelModel];
  readonly canDeploy: boolean;
  toggle(player: PlayerIndex, shellId: string): void;
  deployment(): PlayerLoadouts;
}
```

Each panel owns a separate `Loadout`. Recompute only the changed panel plus shared deploy readiness. Filter both through the same `enabledShellIds` set.

- [ ] **Step 4: Render one neutral two-panel landscape surface**

Use spec-backed labels `Player 1` and `Player 2`; do not use Blue/Pink as menu panel accents. Keep icon/name/cost/ammo/mass content, visible focus, disabled semantics, and HE lock. One Deploy button calls `dispose()` before `onDeploy(model.deployment())`.

- [ ] **Step 5: Implement iPad landscape layout CSS**

Use a two-column grid, scroll within each panel when needed, 44×44 minimum targets, safe-area padding, and no hover-only affordances. Do not add the portrait gate here; Task 5 owns blocking behavior.

- [ ] **Step 6: Run loadout/controller/UI regressions**

Run: `npm test -- --configLoader runner src/ui/loadout.test.ts src/app/controller.test.ts src/ui/appView.test.ts`

Expected: PASS.

- [ ] **Step 7: Record and review checkpoint 4**

Capture independent budget and DOM evidence in `task-4-report.md`; require independent review.

---

### Task 5: Landscape iPad orientation gate

**Files:**
- Create: `src/ui/orientationGate.ts`
- Create: `src/ui/orientationGate.test.ts`
- Create: `src/ui/orientationGate.css`
- Modify: `src/app/controller.ts`
- Modify: `src/app/controller.test.ts`
- Modify: `src/render/titleScene.ts`
- Modify: `src/render/titleScene.test.ts`
- Modify: `src/render/howtoScene.ts`
- Modify: `src/render/howtoScene.test.ts`
- Modify: `src/main.ts`
- Create: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-5-report.md`

**Interfaces:**
- Consumes: `PRESENTATION.requiredOrientation` and `minimumLandscapeWidthPx`.
- Produces: `mountOrientationGate(root, viewport, onBlockedChange): OrientationGate`.
- Produces: `PausableDisposable.setPaused(paused: boolean)` implemented by scenes and runtime.

- [ ] **Step 1: Write failing orientation-policy tests**

```ts
expect(isPresentationBlocked({ width: 768, height: 1024 }, PRESENTATION)).toBe(true);
expect(isPresentationBlocked({ width: 1194, height: 834 }, PRESENTATION)).toBe(false);
expect(isPresentationBlocked({ width: 800, height: 600 }, PRESENTATION)).toBe(true);
expect(isPresentationBlocked({ width: 1200, height: 800 }, PRESENTATION)).toBe(false);
```

Add lifecycle tests proving one callback per actual state change, listener cleanup, blocked overlay semantics, inert/`aria-hidden` underlying app, and exact state preservation across blocked/unblocked transitions.

- [ ] **Step 2: Run orientation/scene/controller tests and confirm RED**

Run: `npm test -- --configLoader runner src/ui/orientationGate.test.ts src/app/controller.test.ts src/render/titleScene.test.ts src/render/howtoScene.test.ts`

Expected: FAIL on missing gate and pause methods.

- [ ] **Step 3: Implement pure blocking policy and DOM owner**

```ts
export interface ViewportSize { readonly width: number; readonly height: number }
export function isPresentationBlocked(size: ViewportSize): boolean {
  return size.width <= size.height || size.width < PRESENTATION.minimumLandscapeWidthPx;
}
```

The owner listens to resize/orientation changes, displays `Rotate your iPad` with a landscape icon/instruction, applies `inert` plus `aria-hidden` to the app surface, and restores prior attributes on unblock/dispose.

- [ ] **Step 4: Make scenes pausable without resetting animation state**

Paused scenes cancel their frame. Resuming resets the time baseline and schedules exactly one frame while retaining particles/system state. Repeated calls and disposal are idempotent.

- [ ] **Step 5: Connect gate state to the current owner**

The controller records `presentationBlocked`. On change, call `setPaused` on the active title/HOWTO scene and match runtime. If an owner is created while already blocked, pause it immediately before a frame can advance. Loadout/menu input is blocked by inertness, not destroyed or recreated.

- [ ] **Step 6: Run focused and lifecycle regressions**

Run: `npm test -- --configLoader runner src/ui/orientationGate.test.ts src/app/controller.test.ts src/app/matchRuntime.test.ts src/render/titleScene.test.ts src/render/howtoScene.test.ts`

Expected: PASS with exact owner/frame counts.

- [ ] **Step 7: Record and review checkpoint 5**

Document blocked-state transitions, frame counts, inert cleanup, and preserved state in `task-5-report.md`; require independent review.

---

### Task 6: Blue/Pink gameplay presentation

**Files:**
- Modify: `src/render/palette.ts`
- Modify: `src/render/entities.ts`
- Modify: `src/render/hud.ts`
- Modify: `src/render/effects.ts` only if it currently renders player-owned muzzle/projectile feedback
- Modify: `src/sim/ballistics.ts`
- Modify: `src/sim/ballistics.test.ts`
- Modify: `src/sim/world.ts`
- Modify: projectile-variant tests that construct `Projectile` or `LaunchOptions`
- Create: `src/render/playerIdentity.test.ts`
- Modify: renderer/entity/HUD tests whose expected Brass/Cyan colors change
- Create: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-6-report.md`

**Interfaces:**
- Consumes: `PRESENTATION.players[0|1].color`.
- Produces: `playerColor(player: PlayerIndex): string` for render-only consumers.
- Does not alter shell accent colors, terrain palettes, generic menu colors, or sim state.

- [ ] **Step 1: Write failing render identity tests**

```ts
expect(playerColor(0)).toBe(PRESENTATION.players[0].color);
expect(playerColor(1)).toBe(PRESENTATION.players[1].color);
expect(playerColor(0)).not.toBe(playerColor(1));
```

Use a recording canvas context to prove tanks, health fills, active-turn marker, aim indicator, and player-owned trails use `playerColor(tank.player)`. Prove projectile ownership uses the firing player's color while shell icons/explosion colors retain their existing functional colors.

- [ ] **Step 2: Run render tests and confirm RED**

Run: `npm test -- --configLoader runner src/render/playerIdentity.test.ts src/render/rendererCamera.test.ts src/render/deckLayout.test.ts`

Expected: FAIL because the palette still contains Brass/Cyan and projectiles use only shell accent.

- [ ] **Step 3: Replace hardcoded player palette entries**

```ts
export function playerColor(player: PlayerIndex): string {
  return PRESENTATION.players[player].color;
}
```

Remove `PALETTE.playerOne/playerTwo` after all player-owned consumers migrate. Keep labels, active border weight/brightness, and tank silhouettes so identity is not color-only.

- [ ] **Step 4: Carry projectile owner into render decisions without changing physics**

`Projectile` currently has no owner field. Add `readonly owner: PlayerIndex` to `Projectile` and `LaunchOptions`, pass the active tank's player index from `fire`, and copy the same owner through every split/bounce/roller/projectile variant. Use `projectile.owner` only to select render color; do not branch physics, damage, or terrain behavior on it.

- [ ] **Step 5: Run render, projectile, and purity regressions**

Run: `npm test -- --configLoader runner src/render src/sim/exotic-projectiles.test.ts src/sim/standard-shells.test.ts src/sim/purity.test.ts`

Expected: PASS with all colors imported from `spec/presentation.json`.

- [ ] **Step 6: Record and review checkpoint 6**

Document exact player-owned surfaces and unaffected functional colors in `task-6-report.md`; require independent review.

---

### Task 7: Integrated iPad acceptance and stop

**Files:**
- Modify only files required by failures found during verification
- Create: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-7-report.md`
- Update: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/progress.md`

**Interfaces:**
- Consumes: all Tasks 1–6 deliverables.
- Produces: independently verified per-player local loadouts and landscape iPad experience.

- [ ] **Step 1: Run the complete automated gate**

Run with D: temp/cache:

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npm test -- --configLoader runner
npx tsc --noEmit
npx vite build --configLoader runner --outDir D:/codex-temp/tank-duel-player-loadouts-final --emptyOutDir
```

Expected: zero failures, strict typecheck success, production build success, and unchanged `spec/test-vectors.json`.

- [ ] **Step 2: Browser-test iPad landscape loadouts**

Use an iPad landscape-sized viewport. Verify two equal neutral panels, independent selection/budgets, HE lock in both, 44×44 minimum targets, visible focus, one shared Deploy button, and distinct decks entering the two in-match arsenals. Check console warnings/errors.

- [ ] **Step 3: Browser-test orientation state preservation**

Rotate/emulate portrait and verify only the rotate surface is interactive, scenes/runtime stop advancing, and controls beneath are inert. Return to landscape and verify the same config, both decks, terrain, health, active turn, and ammunition resume without duplicate frames/listeners.

- [ ] **Step 4: Browser-test combat identity**

Verify Player 1 tank/health/aim/projectile/trail are spec Blue and Player 2 equivalents are spec Pink. Confirm labels, silhouettes, and active-state treatment still identify players without color, while terrain, shell icons, and explosions retain functional colors.

- [ ] **Step 5: Run final independent whole-task review**

Review against `spec/*.json`, the approved design, this plan, source-of-truth rules, golden immutability, per-player non-aliasing, iPad orientation lifecycle, accessibility, and the boundary excluding Tasks 12/13/full visual overhaul.

- [ ] **Step 6: Repeat the full gate after any review/browser fix**

If source changed, rerun Step 1 from a fresh command and record final counts/output.

- [ ] **Step 7: Write final evidence and stop**

Record automated, browser, review, changed-file, and limitation evidence in `task-7-report.md`. Mark progress complete and stop before Task 12.
