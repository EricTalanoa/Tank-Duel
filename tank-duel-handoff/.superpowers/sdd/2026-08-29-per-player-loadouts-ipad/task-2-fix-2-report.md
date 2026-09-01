# Task 2 — Fix round 2 report

Checkpoint 2 of `docs/superpowers/plans/2026-08-29-per-player-loadouts-ipad.md`.
Five quality findings from the independent review, no behaviour change intended.
Workspace is not a git repository; no commit was made or claimed.

## Baseline captured before any edit

```
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner
  -> Test Files  49 passed (49)
     Tests  391 passed (391)

$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npx tsc --noEmit
  -> exit 0, no output

Get-FileHash -Algorithm SHA256 .\spec\test-vectors.json
  -> D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8
```

---

## Item 1 (Important) — production-realistic runtime fixture

**Route taken: the preferred one.** `src/ui/loadout.ts` has no module-scope DOM access
(its only top-level statement is `PLAYABLE_WEAPONS.map(...)`; `document` is touched only
inside `mountLoadout`), so it imports cleanly under the existing `environment: 'node'`
config. No fallback was needed.

`src/app/matchRuntime.test.ts` now derives the fixture through the same code path
production uses:

```ts
const DEPLOYED_SHELL_IDS: readonly string[] = deploymentShellIds(
  createLoadout(['mortar', 'cluster', 'skipper', 'drill']),
);
```

This is legal *by construction*, not by assertion: `createLoadout` → `toggleShell` throws
on an unplayable id and throws once the deck exceeds `spec/constants.json → loadout.points`,
and `deploymentShellIds` supplies the locked HE slot and the canonical `PLAYABLE_WEAPONS`
order. The overclaiming comment is gone; the replacement states exactly what the
construction guarantees and why the picks are deliberately not the default deck.

Picks chosen so the deck differs from `STANDARD_SHELL_IDS` (he/mortar/cluster/buster/roller/sand).
A runtime that silently substituted the default deck would now fail the test; with the old
fixture's first five entries that overlap was partial and less pointed.

### RED/GREEN evidence

A temporary probe (`src/app/__fixtureProbe.test.ts`, deleted afterwards, confirmed gone from
`src/app/`) exercised both fixtures against the **real** `createWorld`, with all costs read
from `spec/shells.json` via `SHELLS` and the budget read from `CONSTANTS.loadout.points` —
no numbers retyped into a test:

| Probe assertion | Result |
|---|---|
| `createWorld(17, { playerLoadoutIds: makePlayerLoadouts(OLD, OLD) })` throws `Unknown playable weapon: anvil` | passed — confirms the old fixture is unproducible |
| `createLoadout(OLD.slice(1))` throws `Unknown playable weapon: anvil` | passed |
| `specCost(OLD) === 12` and `12 > CONSTANTS.loadout.points` (10) | passed — confirms the second, independent violation |
| `NEW_FIXTURE` equals `['he','mortar','cluster','skipper','drill']` | passed |
| `validateLoadout(createLoadout(NEW.slice(1)))` equals `{ valid: true, pointsUsed: 9, optionalSlotsUsed: 4 }` | passed — budget-legal, 9/10 points, 4/5 slots |
| `deploymentShellIds(createLoadout(NEW.slice(1)))` equals `NEW_FIXTURE` | passed — fixture is exactly what production emits (idempotent through the real path) |
| Real `createWorld` with `NEW` yields both arsenals' slot ids equal to `NEW_FIXTURE` | passed |

```
npm test -- --configLoader runner src/app/__fixtureProbe.test.ts
  -> Test Files 1 passed (1) / Tests 2 passed (2)
```

The probe file was then deleted. It is not part of the delivered change.

## Item 2 (Minor) — default deck built by its own factory

`src/sim/world.ts`:

```ts
const playerLoadoutIds = options.playerLoadoutIds ??
  makePlayerLoadouts(STANDARD_SHELL_IDS, STANDARD_SHELL_IDS);
```

Import changed from `import type { PlayerLoadouts }` to
`import { makePlayerLoadouts, type PlayerLoadouts }`. The `as const` assertion is gone, each
slot now gets its own frozen copy, and the default routes through the same validated factory
as every other caller (it also now asserts HE-in-slot-one for the default, which
`STANDARD_SHELL_IDS` satisfies).

## Item 3 (Minor) — `makeArsenal` hoisted

Moved verbatim out of `createWorld` to a module-level, unexported
`function makeArsenal(deckIds: readonly string[]): Arsenal` placed just above `fire`, with a
one-line doc comment. No test needed it exported. Body unchanged.

### Before/after for Items 2 and 3 (pure refactors, existing suite is the safety net)

| | Test files | Tests | `tsc --noEmit` |
|---|---|---|---|
| Before | 49 passed | 391 passed | exit 0 |
| After Items 2+3, before touching any test | 49 passed | 391 passed | exit 0 |

Both items are provably behaviour-neutral: the suite is bit-for-bit unchanged and the golden
vectors were untouched.

## Item 4 (Minor) — redundant assertions removed

Deleted the `for (const deck of playerLoadoutIds ?? [])` loop and its two assertions from
`src/app/matchRuntime.test.ts`. `DEPLOYED_SHELL_IDS` was also moved to the top of the file,
immediately after the imports and above the `Harness` interface, alongside the other
module-level declarations (it previously sat between `createHarness` and `startRuntime`).

### Prepend-reintroduction probe

`src/app/matchRuntime.ts:108` was temporarily changed to reintroduce the removed prepend:

```ts
playerLoadoutIds: makePlayerLoadouts(
  ['he', ...options.loadoutIds],
  ['he', ...options.loadoutIds],
),
```

Result — the test fails on the surviving `toEqual` pair, with the loop already removed:

```
FAIL  src/app/matchRuntime.test.ts > match runtime lifecycle >
      passes the supplied complete deck to both players without duplicating HE
AssertionError: expected [ 'he', 'he', 'mortar', …(3) ] to deeply equal [ 'he', 'mortar', 'cluster', …(2) ]
  [ "he", + "he", "mortar", "cluster", "skipper", "drill" ]
 ❯ src/app/matchRuntime.test.ts:242:35   (expect(playerLoadoutIds?.[0]).toEqual(DEPLOYED_SHELL_IDS))
 Test Files  1 failed (1) / Tests  1 failed | 5 passed (6)
```

`matchRuntime.ts` was then reverted to
`playerLoadoutIds: makePlayerLoadouts(options.loadoutIds, options.loadoutIds)` and re-verified.
**Conclusion: the removed loop was strictly redundant — the `toEqual` pair carries the test.**

## Item 5 (Minor) — default-deck aliasing check strengthened

`src/sim/world.test.ts`, in 'creates independent complete default decks', keeping the existing
`STANDARD_SHELL_IDS` equality and both `not.toBe` assertions and adding the neighbour's
behavioural mutation pattern:

```ts
state.arsenals[0].ammo.mortar = 0;
expect(state.arsenals[1].ammo.mortar).toBe(weaponById('mortar').shell.ammo);
```

The expected value is read from the weapon table (spec-derived), so no ammo count is retyped.
`weaponById` was already imported.

### RED evidence — a regression reference identity cannot catch

`makeArsenal` was temporarily changed to hand each arsenal a *distinct* `Proxy` over one
shared backing ammo store (a plausible "memoized ammo table" regression: two different object
references, one state):

```ts
let PROBE_LEAK: Record<string, number | 'inf'> | null = null;
PROBE_LEAK ??= Object.fromEntries(deck.map((w) => [w.shell.id, w.shell.ammo]));
return { slots: deck, ammo: new Proxy(PROBE_LEAK, {}), ... };
```

Result:

```
FAIL  src/sim/world.test.ts > world > creates independent complete default decks
AssertionError: expected +0 to be 4 // Object.is equality
 ❯ src/sim/world.test.ts:74:43
    72|     expect(state.arsenals[0].ammo).not.toBe(state.arsenals[1].ammo);
    73|     state.arsenals[0].ammo.mortar = 0;
    74|     expect(state.arsenals[1].ammo.mortar).toBe(weaponById('mortar').sh…
```

The failure is at **line 74**, meaning lines 71–72 (`slots` and `ammo` `not.toBe`) both
**passed** under the aliased implementation. That is exactly the gap the review identified,
and the new assertion is what closes it. `world.ts` was then reverted and re-verified.

---

## Verification (final, after all five items and all probes reverted)

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/matchRuntime.test.ts src/sim/world.test.ts
  -> Test Files  2 passed (2)
     Tests  36 passed (36)

$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner
  -> Test Files  49 passed (49)
     Tests  391 passed (391)

$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npx tsc --noEmit
  -> exit 0, no output
```

Counts match the baseline exactly: **49 files / 391 tests**, `tsc` clean. Item 4 removed two
assertions inside an existing test, not a test, and no test was added, so the count is
unchanged at 391 as expected.

### Golden vectors

```
Get-FileHash -Algorithm SHA256 .\spec\test-vectors.json
  -> D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8
```

Matches the required hash. Nothing under `spec/` was read-modified or regenerated.

## Changed files (complete)

| File | Items |
|---|---|
| `src/sim/world.ts` | 2, 3 |
| `src/app/matchRuntime.test.ts` | 1, 4 |
| `src/sim/world.test.ts` | 5 |
| `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-2-fix-2-report.md` | this report (new) |

Touched and fully reverted (verified byte-identical in behaviour by re-running the suite):
`src/app/matchRuntime.ts` (Item 4 probe). Created and deleted: `src/app/__fixtureProbe.test.ts`.

Each changed file was diffed against `task-2-fix-2-baseline/` at the end; the diffs contain
the five items and nothing else.

## Self-review

- **Nothing out of scope touched.** `src/sim/playerLoadouts.ts` untouched — the deferred
  `createLoadout`-normalisation design question is left exactly as found.
  `src/ui/loadout.ts:76`'s duplicated `STANDARD_WEAPONS.map(...)` untouched (the test *imports*
  `deploymentShellIds` from that module but does not modify it). No `spec/` change. No
  controller, orientation, or player-color change.
- **Items 2 and 3 are behaviour-neutral**, demonstrated by an unchanged 49/391 run taken
  *before* any test file was edited, isolating the production refactor from the test changes.
- **Item 2 has one intentional, latent semantic addition:** the default deck now passes
  through `makePlayerLoadouts`, which throws unless slot one is HE. `STANDARD_SHELL_IDS[0]`
  is `'he'` (slot 1, cost 0), asserted by the existing test at `world.test.ts:68`, so no
  current path can trip it. It is a guard, not a change in observable behaviour.
- **The fixture derivation runs at module load.** If someone later makes those four picks
  illegal (e.g. a spec cost rise pushing them past 10 points), `matchRuntime.test.ts` fails
  at import with a clear `Loadout point limit is 10`. That is the intended fail-loud
  behaviour and is exactly the property the old hand-written fixture lacked.
- **Both probes were destructive-by-design and both were reverted**, each followed by a
  re-run. The final full-suite and `tsc` runs above were taken after every revert.

## Concerns

1. **A test in `src/app/` now imports from `src/ui/`.** This is legal (the architectural rule
   in `CLAUDE.md` constrains `sim/` purity, not test imports, and `ui/loadout.ts` has no
   module-scope DOM access), and it is the whole point of the fix — the fixture is correct
   because it comes from the production path. But it does couple the runtime test to the UI
   module. If `ui/loadout.ts` ever gains top-level DOM access it will break this test at
   import; the fallback the brief describes (a hand-written legal deck with an honest comment)
   remains available. Flagging, not blocking.
2. **Item 1's fix repairs the fixture, not the underlying contract.** The reason a
   nonsense deck sailed through in the first place is the deferred Important finding —
   `createLoadout` silently normalises rather than rejecting. The fixture is now correct by
   construction, but the adapter still cannot reject a bad deck handed to it at runtime.
   That remains open by design and is out of scope here.
