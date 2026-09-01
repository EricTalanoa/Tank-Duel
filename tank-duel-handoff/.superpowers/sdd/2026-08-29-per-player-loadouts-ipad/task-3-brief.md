# Task 3 Brief — Runtime and controller tuple plumbing

## Context

Checkpoint 2 is complete and both review gates are clean. Implement checkpoint 3 only, from
`docs/superpowers/plans/2026-08-29-per-player-loadouts-ipad.md` and the binding design at
`docs/superpowers/specs/2026-08-29-per-player-loadouts-ipad-design.md`.

`src/sim/playerLoadouts.ts` exports `PlayerLoadouts`, `PlayerIndex`, `PLAYER_COUNT`, and
`makePlayerLoadouts`. As of fix round 3 that constructor is the enforcement boundary: it rejects
a deck whose slot one is not HE, one containing duplicate ids, and one containing an id that is
not a playable weapon. Errors name the player. Route every tuple you construct through it.

`src/sim/world.ts` already accepts `CreateWorldOptions.playerLoadoutIds?: PlayerLoadouts` and
builds each arsenal independently.

## The shape of this checkpoint

Task 3 carries the tuple from the controller through the runtime into `createWorld`. It does
**not** build the two-panel loadout UI — that is Task 4. Until then the loadout screen still
produces one shared deck, so a temporary adapter must widen that single deck into two identical
tuple entries. Put that adapter at the `main.ts` composition boundary, not inside the controller,
so Task 4 deletes exactly one call site.

The reciprocal adapter currently in `matchRuntime.ts:108`
(`makePlayerLoadouts(options.loadoutIds, options.loadoutIds)`) is what this checkpoint removes:
the runtime's public option becomes the tuple itself and is passed to `createWorld` unchanged.

## Files and boundary

- Modify: `src/app/matchRuntime.ts`, `src/app/matchRuntime.test.ts`, `src/app/controller.ts`,
  `src/app/controller.test.ts`, `src/main.ts`.
- Write `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-3-report.md`.
- Do **not** touch `src/ui/loadout.ts`, `src/ui/loadout.css`, orientation code, player colours,
  or anything under `spec/`. Do not modify `src/sim/`.

## Required interfaces

```ts
// src/app/controller.ts
export interface AppControllerLoadoutOptions {
  readonly onDeploy: (loadouts: PlayerLoadouts) => void;
  readonly enabledShellIds: readonly string[];
  readonly initialPlayerLoadoutIds?: PlayerLoadouts;
}

export interface AppControllerRuntimeOptions {
  readonly config: ResolvedMatchConfig;
  readonly playerLoadoutIds: PlayerLoadouts;
  readonly onComplete: (recap: RoundOverRecap) => void;
}

// src/app/matchRuntime.ts
export interface CreateMatchRuntimeOptions {
  readonly canvas: HTMLCanvasElement;
  readonly config: MatchRuntimeConfig;
  readonly playerLoadoutIds: PlayerLoadouts;
  readonly onComplete: (recap: RoundOverRecap) => void;
  readonly dependencies?: Partial<MatchRuntimeDependencies>;
}

export interface MatchRuntime {
  readonly state: GameState;
  setPaused(paused: boolean): void;
  dispose(): void;
}
```

`initialShellIds` and `loadoutIds` are removed outright. Do not leave a compatibility alias —
the same "do not retain two competing contracts" rule that governed checkpoint 2 applies here.

## Controller ownership

Replace `selectedLoadoutIds: readonly string[] | null` with
`selectedPlayerLoadoutIds: PlayerLoadouts | null`. Copy through `makePlayerLoadouts` at callback
boundaries so a caller cannot retain a mutable handle on controller state. Rematch reuses the
same value and changes only the seed; Change Loadout passes both decks back as
`initialPlayerLoadoutIds`; stale callbacks stay generation- and screen-guarded exactly as they
are today.

## Runtime pause

`setPaused(true)` cancels the pending frame and records the paused state. `setPaused(false)`
resets the frame-time baseline — a resume must not bill the paused wall-clock interval to the
accumulator — and schedules exactly one frame. Repeated calls in either direction are no-ops.
Disposal while paused stays final: a later `setPaused(false)` must not resurrect the loop.

Task 5's orientation gate is the consumer. Nothing calls `setPaused` yet in this checkpoint;
build it and test it directly.

## TDD requirements

Write failing tests first and capture RED verbatim. Cover at least:

- `createWorld` receives the exact tuple: `expect(runtimeCreateWorld).toHaveBeenCalledWith(seed,
  expect.objectContaining({ playerLoadoutIds }))`.
- Deploy stores the tuple: after `harness.loadouts[0]!.options.onDeploy(playerLoadoutIds)`,
  `harness.runtimes[0]!.options.playerLoadoutIds` equals it.
- Rematch preserves both decks and changes only the seed.
- Change Loadout returns both decks as `initialPlayerLoadoutIds`.
- Distinct decks survive the whole path — use two genuinely different decks, not two copies of
  one, or the test cannot distinguish correct plumbing from the old shared behaviour.
- Exactly one runtime is created per match; the existing counts must not drift.
- `setPaused(true)` suppresses frame advancement without disposal; `setPaused(false)` schedules
  exactly one continuation; repeat calls are no-ops; dispose-then-resume stays disposed.

## Verification

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/controller.test.ts src/app/matchRuntime.test.ts src/sim/world.test.ts
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npx tsc --noEmit
```

Baseline to beat: 49 files / 395 tests passing, `tsc --noEmit` clean, `spec/test-vectors.json`
SHA-256 `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.

Report exact commands and counts, all changed files, proof that no `loadoutIds`/`initialShellIds`
alias survives, and a self-review.

## Constraints

- `spec/*.json` authoritative; never edit or regenerate `spec/test-vectors.json`.
- `src/sim/` stays pure and is not modified by this checkpoint.
- Non-Git workspace: do not initialise Git or claim commits. Baselines are in `task-3-baseline/`.
- Do not spawn subagents or reviewers.

## Carried from checkpoint 2

- `matchRuntime.test.ts` imports `deploymentShellIds` from `src/ui/loadout.ts`; that module must
  stay import-safe. Keep it that way.
- `makeArsenal` still materialises through `createLoadout`, which repairs a malformed deck
  silently. Out of scope here, but do not add a second path into `createWorld` that bypasses
  `makePlayerLoadouts`.
