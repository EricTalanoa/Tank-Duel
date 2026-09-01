# Task 3 Report — Runtime and controller tuple plumbing

Checkpoint 3 of `docs/superpowers/plans/2026-08-29-per-player-loadouts-ipad.md`.
Workspace is not a Git repository; no repository was initialised and nothing was committed.
Baselines compared against `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-3-baseline/`.

## What changed

`PlayerLoadouts` now travels intact from the composition root, through the controller, through
the match runtime, into `createWorld`. The shared single-deck contract (`loadoutIds`,
`initialShellIds`) is gone from `src/app/` with no compatibility alias. The runtime also gained
`setPaused` for Task 5's orientation gate.

Asymmetry, deliberately: `main.ts` widens the loadout screen's one shared deck into two identical
tuple entries, because the two-panel editor is Task 4. Everything below `main.ts` treats the two
decks as genuinely independent and is tested with two decks that share nothing but the locked HE
slot.

## TDD evidence

Tests were written first, run, and observed failing before any implementation. The work split into
two RED/GREEN cycles because the tuple change makes the runtime unconstructable, which would have
masked the reason the pause tests fail.

### RED 1 — tuple contract (before any implementation change)

Command:

```
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/controller.test.ts src/app/matchRuntime.test.ts
```

Result: `Test Files  2 failed (2)` / `Tests  12 failed | 4 passed (16)`.

Controller — `playerLoadoutIds` / `initialPlayerLoadoutIds` did not exist yet:

```
 FAIL  src/app/controller.test.ts > application controller > carries accepted Custom Game settings through intro and
AssertionError: expected undefined to deeply equal [ [ 'he', 'mortar', 'cluster' ], …(1) ]
 FAIL  src/app/controller.test.ts > application controller > keeps the deployed decks after the deploying caller
AssertionError: expected undefined to deeply equal [ [ 'he', 'mortar', 'cluster' ], …(1) ]
 FAIL  src/app/controller.test.ts > application controller > disposes loadout on deploy, completes once, and rematches
AssertionError: expected undefined to deeply equal [ [ 'he', 'mortar', 'cluster' ], …(1) ]
 FAIL  src/app/controller.test.ts > application controller > preserves settings and the previous deck for Change
AssertionError: expected undefined to deeply equal [ [ 'he', 'mortar', 'cluster' ], …(1) ]
```

Runtime — the option was still `loadoutIds`, so the old widening adapter fed `undefined` into
`makePlayerLoadouts` and every runtime test died at construction:

```
 FAIL  src/app/matchRuntime.test.ts > match runtime lifecycle > passes the two independent decks to createWorld
TypeError: Cannot read properties of undefined (reading '0')
 ❯ validateDeck src/sim/playerLoadouts.ts:19:7
     17| function validateDeck(deck: readonly string[], player: PlayerIndex): v…
     18|   const who = `Player ${player + 1}`;
     19|   if (deck[0] !== CONSTANTS.loadout.freeShell) {
       |       ^
     20|     throw new Error(`${who} loadout requires HE in slot one`);
     21|   }
 ❯ makePlayerLoadouts src/sim/playerLoadouts.ts:36:3
 ❯ createMatchRuntime src/app/matchRuntime.ts:108:23
 ❯ startRuntime src/app/matchRuntime.test.ts:218:10
```

(the same `TypeError` for all eight runtime tests).

### RED 2 — pause interface (after tuple plumbing, before `setPaused`)

Same command. `Tests  2 failed | 14 passed (16)` — all tuple behaviours green, the two pause
behaviours failing on the missing interface rather than on construction:

```
 FAIL  src/app/matchRuntime.test.ts > match runtime lifecycle > suppresses advancement while paused and resumes on one
fresh-baseline frame
TypeError: runtime.setPaused is not a function
 ❯ src/app/matchRuntime.test.ts:335:13
    333|     const pendingFrame = harness.frames[0]!;
    334|
    335|     runtime.setPaused(true);
       |             ^
 FAIL  src/app/matchRuntime.test.ts > match runtime lifecycle > stays disposed when resumed after disposal while paused
TypeError: runtime.setPaused is not a function
 ❯ src/app/matchRuntime.test.ts:370:13
    370|     runtime.setPaused(true);
       |             ^
```

### GREEN

```
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/controller.test.ts src/app/matchRuntime.test.ts src/sim/world.test.ts
 Test Files  3 passed (3)
      Tests  46 passed (46)
```

### Mutation check on the frame-time baseline

The resume-rebase assertion is the one behaviour where a passing test could be vacuous, so it was
checked by mutation. Removing `last = dependencies.now();` from `setPaused(false)` and rerunning
`src/app/matchRuntime.test.ts`:

```
     × suppresses advancement while paused and resumes on one fresh-baseline frame 31ms
AssertionError: expected 15 to be 1 // Object.is equality
      Tests  1 failed | 7 passed (8)
```

15 is `MAX_STEPS_PER_FRAME` — the 250 ms clamp, i.e. exactly the fast-forward CLAUDE.md
non-negotiable 1 exists to prevent. The line was restored from a pre-mutation copy and the suite
re-run green (below).

## Behaviours covered

Runtime (`src/app/matchRuntime.test.ts`):

- `createWorld` receives the exact tuple —
  `expect(harness.createWorld).toHaveBeenCalledWith(17, expect.objectContaining({ playerLoadoutIds: PLAYER_LOADOUT_IDS }))`,
  plus `toBe` identity (the runtime forwards, it does not rebuild) and per-player deep equality.
- The two decks stay distinct through the runtime (`[0]` not equal to `[1]`).
- Resource counts unchanged: still exactly one world/clock/scaler/listener/effects/audio/renderer/
  controls set and one scheduled frame per runtime.
- `setPaused(true)` cancels the pending frame (`cancelledFrames == [1]`), leaves a manually invoked
  stale frame inert (`state.frame == 0`, no draws), schedules nothing, and disposes nothing.
- `setPaused(false)` after five seconds of paused wall clock schedules exactly one continuation and
  that frame advances the sim by one step, not fifteen.
- Repeat calls in both directions are no-ops (double pause cancels once; double resume schedules
  once).
- `setPaused(true)` → `dispose()` → `setPaused(false)` stays disposed: no new frame, no resurrection,
  controls and the reduced-motion listener disposed exactly once.

Controller (`src/app/controller.test.ts`):

- Deploy stores the tuple and hands it to the runtime: `runtimes[0].options.playerLoadoutIds`
  equals the deployed tuple, and each player's deck matches its own source.
- Callers cannot retain a handle on controller state: the test deploys with two *mutable* arrays,
  mutates both immediately afterwards (`push`, `length = 1`), and asserts the runtime still holds
  the pre-mutation decks.
- Rematch preserves both decks and changes only the seed: `runtimes[1].options.playerLoadoutIds`
  equals `runtimes[0]`'s and the original tuple, while `secondSeed !== firstSeed` and all other
  resolved settings are deep-equal. It also asserts no new loadout screen was mounted
  (`loadouts` still length 1).
- Change Loadout returns both decks as `initialPlayerLoadoutIds`, checked per player.
- One runtime per match; the existing `maxActiveRuntimes === 1` and dispose-count assertions are
  untouched and still pass.

Test decks are legal by construction, not by assertion. The runtime fixtures go through
`deploymentShellIds(createLoadout([...]))` as before, now for two disjoint picks:
`['mortar','cluster','skipper','drill']` (9 pts) and `['sand','roller','buster','napalm']` (8 pts).
The controller fixtures are `['he','mortar','cluster']` and `['he','sand','roller']`. Both pairs go
through `makePlayerLoadouts`, so an illegal fixture would throw at module load.

## Verification

All commands run from the workspace root with `TEMP`/`TMP` redirected to `D:\codex-temp`.

| # | Command | Result |
|---|---|---|
| 1 | `npm test -- --configLoader runner src/app/controller.test.ts src/app/matchRuntime.test.ts src/sim/world.test.ts` | `Test Files  3 passed (3)` / `Tests  46 passed (46)` |
| 2 | `npm test -- --configLoader runner` | `Test Files  49 passed (49)` / `Tests  398 passed (398)` |
| 3 | `npx tsc --noEmit` | exit 0, no output |

Extra, per CLAUDE.md's definition of done:

| # | Command | Result |
|---|---|---|
| 4 | `npm run build` | exit 0 — `✓ 58 modules transformed`, `✓ built in 371ms` |

Baseline was 49 files / 395 tests. Now 49 files / **398** tests: +3, all in `src/app/`.

- `src/app/matchRuntime.test.ts`: +2 (`suppresses advancement while paused and resumes on one
  fresh-baseline frame`, `stays disposed when resumed after disposal while paused`). The existing
  deck test was rewritten in place, not added, so the file goes 6 → 8.
- `src/app/controller.test.ts`: +1 (`keeps the deployed decks after the deploying caller mutates the
  arrays it passed`). 7 → 8.

### Golden vectors

```
(Get-FileHash 'spec\test-vectors.json' -Algorithm SHA256).Hash
D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8
```

Matches the expected baseline hash, measured both before and after the change. Nothing under
`spec/` was edited or regenerated; nothing under `src/sim/` was modified.

### Stale-contract grep

```
$ grep -rn "loadoutIds\|initialShellIds" src --include=*.ts
src/main.ts:43:        : { initialShellIds: initialPlayerLoadoutIds[0] }),
src/ui/loadout.test.ts:78:      initialShellIds: ['he', 'mortar'],
src/ui/loadout.ts:65:  readonly initialShellIds?: readonly string[];
src/ui/loadout.ts:76:  const initialShellIds = options.initialShellIds ?? STANDARD_WEAPONS.map(({ shell }) => shell.id);
src/ui/loadout.ts:78:    initialShellIds.filter((id) => id !== CONSTANTS.loadout.freeShell && enabledSet.has(id)),
```

Reading of that output:

- No `loadoutIds` survives anywhere. Every hit above is `initialShellIds`.
- `src/main.ts:43` is the single widening-adapter call site — it is consuming the *UI's*
  `MountLoadoutOptions.initialShellIds` while producing/consuming the controller's
  `initialPlayerLoadoutIds`. This is the one line Task 4 deletes.
- The three `src/ui/loadout.ts` hits and the one in its test are that UI module's own contract for
  the still-single-deck editor. Task 4 owns them; this checkpoint was explicitly forbidden to touch
  `src/ui/loadout.ts`, and the brief also requires it to stay import-safe for
  `matchRuntime.test.ts`, which it does.

Positive side of the same check:

```
$ grep -rn "playerLoadoutIds\|initialPlayerLoadoutIds" src --include=*.ts | grep -v "\.test\.ts"
src/app/controller.ts:27:  readonly initialPlayerLoadoutIds?: PlayerLoadouts;
src/app/controller.ts:32:  readonly playerLoadoutIds: PlayerLoadouts;
src/app/controller.ts:133:          initialPlayerLoadoutIds: copyLoadouts(selectedPlayerLoadoutIds),
src/app/controller.ts:150:      playerLoadoutIds: copyLoadouts(selectedPlayerLoadoutIds),
src/app/matchRuntime.ts:76:  readonly playerLoadoutIds: PlayerLoadouts;
src/app/matchRuntime.ts:114:    playerLoadoutIds: options.playerLoadoutIds,
src/main.ts:36:  mountLoadout: ({ onDeploy, enabledShellIds, initialPlayerLoadoutIds }) => mountLoadout(
src/main.ts:41:      ...(initialPlayerLoadoutIds === undefined
src/main.ts:43:        : { initialShellIds: initialPlayerLoadoutIds[0] }),
src/main.ts:46:  createMatchRuntime: ({ config, playerLoadoutIds, onComplete }) => createMatchRuntime({
src/main.ts:53:    playerLoadoutIds,
src/sim/world.ts:149:  readonly playerLoadoutIds?: PlayerLoadouts;
src/sim/world.ts:200:  const playerLoadoutIds = options.playerLoadoutIds ??
src/sim/world.ts:224:    arsenals: [makeArsenal(playerLoadoutIds[0]), makeArsenal(playerLoadoutIds[1])],
```

`src/sim/world.ts` appears here unchanged from Task 2 — this checkpoint did not modify `src/sim/`.

## Changed files

| File | Change |
|---|---|
| `src/app/matchRuntime.ts` | `loadoutIds` → `playerLoadoutIds: PlayerLoadouts`; removed the `makePlayerLoadouts(ids, ids)` widening adapter at the old line 108 and now forwards the tuple to `createWorld` unchanged; `makePlayerLoadouts` value import demoted to a `type` import; added `setPaused`, a `paused` flag, and a shared `cancelPendingFrame` helper (also used by `dispose`). |
| `src/app/matchRuntime.test.ts` | Two distinct fixture decks plus a `PlayerLoadouts` tuple; `createWorld` dependency is now a `vi.fn` spy so the plan's `toHaveBeenCalledWith` form can be asserted; harness `now()` became movable (`setNow`) so a paused interval can elapse; deck test rewritten for two independent decks; two new pause tests. |
| `src/app/controller.ts` | `AppControllerLoadoutOptions.onDeploy(loadouts: PlayerLoadouts)` and `initialPlayerLoadoutIds`; `AppControllerRuntimeOptions.playerLoadoutIds`; `selectedLoadoutIds` → `selectedPlayerLoadoutIds: PlayerLoadouts | null`; new `copyLoadouts` helper routing every boundary copy through `makePlayerLoadouts`. |
| `src/app/controller.test.ts` | Tuple fixtures; deploy/rematch/change-loadout assertions on both decks; new caller-mutation test. |
| `src/main.ts` | Explicit `mountLoadout` adapter widening one deployed deck into two identical entries (marked TEMPORARY, Task 4 deletes it); `createMatchRuntime` forwards `playerLoadoutIds`. |
| `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-3-report.md` | This report. |

No other file was touched. `src/sim/`, `src/ui/`, orientation code, player colours and `spec/` are
unmodified. (`dist/` was rewritten by the optional `npm run build`; it is generated output.)

## Fix round 1 — paused player input

Reviewer finding addressed: pausing cancelled the frame loop but did not suppress the live
window-level aim, power, shell, and fire callbacks. The root cause was that each callback guarded
only `disposed`; inert app DOM does not prevent the `window` keydown listener from calling them.

### RED

Before changing runtime code, `src/app/matchRuntime.test.ts` gained a regression test that captures
the real `AimControlsOptions` callbacks, pauses the runtime, invokes `onAngle`, `onPower`,
`onShell`, and `onFire`, and asserts that aim, selected shell, projectile/projectiles, phase, and
audio unlock calls are unchanged. It resumes the same runtime and verifies that those callbacks
again update angle/power, select Mortar, fire a Mortar projectile, and unlock audio.

```
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/matchRuntime.test.ts

FAIL  src/app/matchRuntime.test.ts > match runtime lifecycle > ignores player input while paused and accepts it after resume
AssertionError: expected { angleDeg: 56, power: 86 } to deeply equal { angleDeg: 46, power: 76 }
```

The failure proves paused `onAngle(10)` mutated live aim before the fix; the remaining callback
assertions would catch the same missing guard for power, shell selection, firing, and audio unlock.

### GREEN

The minimal runtime-only change makes all four player-input callbacks return when
`disposed || paused`, before audio unlock or simulation mutation. Resume remains unguarded, so the
same captured callbacks work after `setPaused(false)`.

| Command | Result |
|---|---|
| `$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/matchRuntime.test.ts` | `Test Files  1 passed (1)` / `Tests  9 passed (9)` |
| `$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/controller.test.ts src/app/matchRuntime.test.ts src/sim/world.test.ts` | `Test Files  3 passed (3)` / `Tests  47 passed (47)` |
| `$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner` | `Test Files  49 passed (49)` / `Tests  399 passed (399)` |
| `$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npx tsc --noEmit` | exit 0, no output |

### Files changed in this round

- `src/app/matchRuntime.ts` — guards every player-input callback with `disposed || paused`.
- `src/app/matchRuntime.test.ts` — regression coverage for paused callbacks and post-resume input.
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-3-report.md` — this round's evidence.

## Self-review

- **Two competing contracts?** No. `loadoutIds` and `initialShellIds` are removed from `src/app/`
  outright, with no alias, no optional fallback, and no overload. `tsc --noEmit` is clean, so every
  call site was actually migrated rather than widened to `any`.
- **One place that widens.** Exactly one: `src/main.ts`. The controller never sees a single deck,
  and the runtime never constructs a tuple. Task 4 deletes one call site.
- **Would the tests fail against the old behaviour?** Yes, and this was the main risk. Both suites
  use decks that differ in every optional slot, so a runtime or controller that reused one deck for
  both players would fail on the `[1]` assertions. The mutation check above further shows the
  pause-resume assertion is not vacuous.
- **Ownership.** `makePlayerLoadouts` deep-freezes what it returns, and the controller copies
  through it on the way in (deploy) and on the way out (runtime, loadout restore), so no caller
  shares storage with controller state. The mutation test proves the inbound copy; the outbound
  copies mean a rematch cannot be poisoned by a previous runtime.
- **Validation is not bypassed.** The only path into `CreateWorldOptions.playerLoadoutIds` is a
  tuple that came from `makePlayerLoadouts` — built in `main.ts` (widening) or re-copied by the
  controller. No second path into `createWorld` was added.
- **Pause is state-free.** `setPaused` touches only `paused`, `frameHandle` and `last`. It does not
  step, dispose, reset the clock accumulator, or touch `GameState`, so returning to landscape in
  Task 5 resumes the same match — terrain, health, turn, ammo untouched, as the design requires.
- **Guard order preserved.** `onDeploy` still checks `disposed || state.screen !== 'LOADOUT'`
  *before* constructing a tuple, so a stale post-disposal deploy stays a silent no-op rather than
  throwing out of a validator; the generation/screen guard on `onComplete` is unchanged.
- **Frame guard.** `frame()` returns early when `paused`, and reschedules only when
  `!disposed && !paused`, so a frame callback already in flight when the gate closes cannot step
  the sim or re-arm the loop.

## Concerns

1. **The `main.ts` adapter discards player two on restore.** For Change Loadout it passes
   `initialPlayerLoadoutIds[0]` to the single-deck editor. Today that loses nothing, because the same
   adapter guarantees both entries are identical. It would silently lose player two's deck if
   anything started producing genuinely distinct decks before Task 4 replaces this call site. Task 4
   removes the whole adapter, so this resolves itself, but it is the one place where the temporary
   asymmetry could bite if the tasks were reordered.
2. **`createWorld` receives the tuple by reference.** Deliberate, per the brief ("passed to
   `createWorld` unchanged"), and asserted with `toBe`. It is safe because `makePlayerLoadouts`
   freezes both the tuple and its two arrays. If a future caller ever hands the runtime a tuple that
   did not come from `makePlayerLoadouts`, TypeScript would allow it structurally and the freeze
   guarantee would be gone. The type carries no brand to prevent that.
3. **Carried forward, unchanged and out of scope:** `makeArsenal` still materialises through
   `createLoadout`, which silently repairs a malformed deck. This checkpoint added no new path
   around `makePlayerLoadouts`, but the underlying repair-instead-of-fail behaviour is still there
   below the validated boundary.
4. **`setPaused` has no production caller yet.** By design — Task 5's orientation gate is the
   consumer. It is covered only by direct unit tests until then.
