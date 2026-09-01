# Task 4 Report — Side-by-side independent loadout owner

Checkpoint 4 of `docs/superpowers/plans/2026-08-29-per-player-loadouts-ipad.md`.
The workspace remains non-Git: no repository was initialised and no commit was made.

## Scope delivered

`mountLoadout` now owns two independent pure `Loadout` values through
`PlayerLoadoutEditorModel`. It renders one neutral overlay containing two equal labelled panels,
with one shared Deploy button. `main.ts` passes the controller tuple through directly; the
temporary single-deck widening adapter and `initialShellIds` UI compatibility contract are gone.

## TDD evidence

All commands below ran from the workspace root with `TEMP` and `TMP` set to `D:\codex-temp`.

### RED 1 — two independent editor owners and shared DOM surface

Before changing production code, `src/ui/loadout.test.ts` gained tests for Player 1/Player 2
isolation, independent counters, enabled filtering, HE locks, tuple deployment, immutable caller
boundaries, two labelled regions, shared deployment/disposal, and CSS targets.

```
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/ui/loadout.test.ts
Test Files  1 failed (1)
Tests  8 failed | 5 passed (13)
```

The four model tests failed with `TypeError: createPlayerLoadoutEditorModel is not a function`.
The remaining failures showed the old owner had zero `[data-player]` regions, deployed one shared
deck instead of a tuple, and lacked the required deploy/layout CSS. These failures were against
the pre-existing one-deck owner, not test setup errors.

### GREEN 1 — two-player model, owner, and adapter removal

After the minimum implementation, then correcting two fixtures to expected spec slot order
(Roller, slot 5, precedes Sandbags, slot 6) and extending the fake DOM's selector support:

```
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/ui/loadout.test.ts
Test Files  1 passed (1)
Tests  13 passed (13)
```

### RED 2 / GREEN 2 — explicit 44 by 44 target floor

Self-review found the initial CSS stated an explicit 44px height floor but not an explicit 44px
width floor. A CSS contract assertion was added first:

```
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/ui/loadout.test.ts
Test Files  1 failed (1)
Tests  1 failed | 12 passed (13)
```

The expected failure named the absent `.loadout-card { min-width: 44px }` declaration. Adding
`min-width: 44px` to cards and Deploy made the final requested focused regression green:

```
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/ui/loadout.test.ts src/app/controller.test.ts src/ui/appView.test.ts
Test Files  3 passed (3)
Tests  27 passed (27)
```

### Integration type check diagnosis

The first `npx tsc --noEmit` exposed two `exactOptionalPropertyTypes` integration errors: main
passed `initialPlayerLoadoutIds: undefined`, and the test's caller-mutation fixture was declared
readonly. The root causes were confirmed against the controller's established conditional-property
construction pattern. `main.ts` now omits that property when absent; the test keeps a mutable
two-array fixture before passing it through the readonly API. The fresh TypeScript check below is
clean.

## Verification

| Command | Result |
|---|---|
| `npm test -- --configLoader runner src/ui/loadout.test.ts src/app/controller.test.ts src/ui/appView.test.ts` | 3 files passed; 27 tests passed. |
| `npm test -- --configLoader runner` | 49 files passed; 406 tests passed. |
| `npx tsc --noEmit` | Exit 0; no output. |
| `npx vite build --outDir 'D:\tank-duel-task-4-dist-final'` | Exit 0; 60 modules transformed; built in 204 ms. |

The build emits only to `D:\tank-duel-task-4-dist-final`. Vite notes that an out-of-project
directory is not automatically emptied; it was confirmed absent before this build, so no existing
output was overwritten.

Baseline after Task 3 was 49 files / 399 tests. The finished suite is 49 files / **406 tests**:
seven new loadout behaviours, with the rest of the suite unchanged.

## Independent deck and budget proof

- Player 1 toggle test starts `['he', 'mortar']`, adds Cluster, and proves Player 1 is
  `['he', 'mortar', 'cluster']` at **5** points while Player 2 remains deeply unchanged at
  `['he', 'roller', 'sand']` and **3** points.
- The reciprocal test changes only Player 2 and proves Player 1's entire deployment remains
  unchanged.
- The editor holds `[Loadout, Loadout]`, invokes the existing spec-backed `toggleShell` against
  only the selected entry, and refreshes only that entry's panel model. `toggleShell` continues to
  enforce `CONSTANTS.loadout.points` and `slots` independently for each owner.
- Both panels are built from the same `enabledShellIds`; the filtering test observes exactly
  `['he', 'mortar', 'sand']` in each. It also proves HE is selected, locked, and cost zero in both.
- The DOM test observes two independent counters (`5/10, 2/5` and `1/10, 1/5`), two locked HE
  cards, one shared enabled Deploy button, and deployment in stable Player 1 / Player 2 tuple
  order.
- The caller-mutation test mutates both original input arrays after model construction and proves
  the owner deploys its original two decks. `deployment()` returns `makePlayerLoadouts(...)`, so
  the tuple and both entries are frozen.

## Source-of-truth and golden audit

- No file under `spec/` was changed or regenerated. The full suite still consumes all existing
  spec contracts.
- `src/ui/loadout.ts` imports `PRESENTATION` for player labels, `CONSTANTS` for points/slots/free
  shell behavior, and existing `PLAYABLE_SHELL_IDS` / `STANDARD_SHELL_IDS` for shell availability
  and the single pre-existing spec-derived default. It introduces no copied point, slot, player
  label, shell, or default-deck data.
- Player labels are read from `PRESENTATION.players[player].label`; `Player 1` and `Player 2` are
  not hardcoded in production loadout rendering.
- `spec/test-vectors.json` SHA-256 is unchanged:

```
D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8
```

## Old-contract grep

```
rg -n "initialShellIds|onDeploy:\s*\(ids|makePlayerLoadouts\(ids, ids\)|TEMPORARY \(Task 4" src --glob '*.ts'
```

Result: **0 matches**. There is no `initialShellIds` compatibility alias, no one-deck `onDeploy`
callback, and no temporary main widening adapter.

## Changed files

| File | Change |
|---|---|
| `src/ui/loadout.ts` | Added the pure two-owner editor model, tuple mount contract, spec-backed labels/default IDs, separate rendering panels, shared tuple deployment, and idempotent disposal. |
| `src/ui/loadout.test.ts` | Added seven TDD behaviours covering owner isolation, counters, filtering, HE, immutable tuple boundaries, two-panel DOM/deploy, and CSS target/layout contracts; updated old single-deck owner tests. |
| `src/ui/loadout.css` | Replaced the one-panel layout with a neutral two-column landscape surface, safe-area padding, card-panel scrolling, explicit 44x44 minimum targets, and preserved focus treatment. |
| `src/main.ts` | Deleted the temporary single-deck-to-tuple adapter and passes `onDeploy` / prior tuple directly. |
| `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-4-report.md` | This report. |

## Self-review

- `loadout.ts` remains import-safe: it reaches the DOM only inside `mountLoadout`; no module-scope
  document/window access was introduced.
- The only mutable editor state is the private two-entry `loadouts` tuple. A player toggle selects
  one entry, so the other deck cannot be aliased or mutated by that operation.
- Render cards retain icon, name, cost, ammo, mass, selected, disabled, and locked semantics;
  panels use neutral styling, not Blue/Pink combat identities.
- Deploy snapshots and validates the stable tuple, disposes the overlay/listener, then calls the
  controller callback. Repeat disposal remains a no-op.
- No orientation blocking, CPU deck behavior, combat colors, Task 13 behavior, controller redesign,
  or spec/golden modification was included.

## Concerns

None found in this checkpoint's scope. `canDeploy` is still derived from both panel validations;
with the existing spec-backed `createLoadout`/`toggleShell` APIs, every state reachable through the
editor is valid by construction, so the shared button remains enabled for valid two-player states.
