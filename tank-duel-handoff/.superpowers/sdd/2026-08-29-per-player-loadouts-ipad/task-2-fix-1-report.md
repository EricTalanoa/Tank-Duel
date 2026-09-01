# Task 2 Fix 1 Report — runtime HE duplication and default-deck completeness

## Status

DONE

## Scope

Two review findings against checkpoint 2, fixed in isolation. No other change was made.

1. The pre-Task-3 runtime adapter prepended a second `'he'` onto a deck that already
   begins with `'he'`, violating the ruling that each `PlayerLoadouts` tuple entry is a
   complete stable deck containing HE exactly once, in slot one.
2. `'creates independent complete default decks'` asserted only that slot one is `'he'`,
   never that the default decks are the complete standard deck.

Controller, UI, orientation, player-color and `spec/` files were not touched.
`src/sim/playerLoadouts.ts` was not touched. Workspace is not a Git repository; nothing
was initialized and no commit is claimed.

## Issue 1 — RED

Test written first. The harness's `createWorld` stub was extended to record the options it
receives, the fixture deck was corrected to the real production shape (HE first, as
`deploymentShellIds` always emits), and a new test asserts the recorded
`playerLoadoutIds` entries equal the supplied deck exactly.

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/matchRuntime.test.ts
```

Exit code 1. Verbatim failure:

```
 ❯ src/app/matchRuntime.test.ts (6 tests | 1 failed) 213ms
     × passes the supplied complete deck to both players without duplicating HE 36ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/app/matchRuntime.test.ts > match runtime lifecycle > passes the supplied complete deck to both players without duplicating HE
AssertionError: expected [ 'he', 'he', 'mortar', …(4) ] to deeply equal [ 'he', 'mortar', 'cluster', …(3) ]

- Expected
+ Received

@@ -1,7 +1,8 @@
  [
    "he",
+   "he",
    "mortar",
    "cluster",
    "buster",
    "roller",
    "anvil",

 ❯ src/app/matchRuntime.test.ts:239:35

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

This is the defect exactly as described: the deck reaching `createWorld` carried HE twice.

## Issue 1 — fix and GREEN

`src/app/matchRuntime.ts` now passes the ids through unchanged:

```ts
playerLoadoutIds: makePlayerLoadouts(options.loadoutIds, options.loadoutIds),
```

The adapter's public API is otherwise unchanged; it remains the temporary pre-Task-3
boundary.

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/matchRuntime.test.ts
```

Exit code 0; 1 passed test file; 6 passed tests.

## Issue 2 — RED

The default-deck test was strengthened to assert each arsenal's slot ids equal
`STANDARD_SHELL_IDS` (imported from `src/sim/weapons.ts` rather than retyped), keeping the
existing non-aliasing assertions.

There is no production defect behind issue 2 — `world.ts` already derived defaults from the
complete standard deck — so the strengthened assertion is GREEN against correct code. To
produce genuine RED evidence that the new assertion discriminates, the default derivation
in `src/sim/world.ts` was temporarily mutated to `.slice(0, 2)`. That mutant satisfies every
assertion the *old* test made (HE still in slot one, slots and ammo still distinct objects),
so it demonstrates precisely the gap the review identified.

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/sim/world.test.ts -t 'creates independent complete default decks'
```

Exit code 1. Verbatim failure under the mutant:

```
 ❯ src/sim/world.test.ts (30 tests | 1 failed | 29 skipped) 71ms
     × creates independent complete default decks 68ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/sim/world.test.ts > world > creates independent complete default decks
AssertionError: expected [ 'he', 'mortar' ] to deeply equal [ 'he', 'mortar', 'cluster', …(3) ]

- Expected
+ Received

  [
    "he",
    "mortar",
-   "cluster",
-   "buster",
-   "roller",
-   "sand",
  ]

 ❯ src/sim/world.test.ts:69:70

 Test Files  1 failed (1)
      Tests  1 failed | 29 skipped (30)
```

The mutation was then reverted. It exists nowhere in the delivered code.

## Issue 2 — GREEN

With the mutation reverted, and taking the explicitly permitted substitution at
`src/sim/world.ts:200`, the duplicate derivation
`STANDARD_WEAPONS.map((weapon) => weapon.shell.id)` was replaced by the existing
`STANDARD_SHELL_IDS` export (identical value); the now-unused `STANDARD_WEAPONS` import was
swapped for `STANDARD_SHELL_IDS`. No other change to `world.ts`.

## Verification

All three required runs, exact commands and results:

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/app/matchRuntime.test.ts src/sim/world.test.ts
```

Exit code 0 — **2 passed test files; 36 passed tests.**

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner
```

Exit code 0 — **49 passed test files; 391 passed tests** (baseline 49 / 390; +1 is the new
runtime pass-through test; zero failures, zero skips).

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npx tsc --noEmit
```

Exit code 0 — no diagnostics.

Golden-vector check:

```powershell
(Get-FileHash 'spec/test-vectors.json' -Algorithm SHA256).Hash
```

`D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8` — unchanged, matching
the required value. Nothing under `spec/` was edited or regenerated.

## Changed files

- `src/app/matchRuntime.ts` — adapter passes `options.loadoutIds` through unchanged to both
  tuple entries (one statement; no API change).
- `src/app/matchRuntime.test.ts` — harness `createWorld` stub records its options; fixture
  deck corrected to the production shape via a new `DEPLOYED_SHELL_IDS` constant; new test
  `'passes the supplied complete deck to both players without duplicating HE'`.
- `src/sim/world.test.ts` — `'creates independent complete default decks'` now asserts both
  default decks equal `STANDARD_SHELL_IDS`; `STANDARD_SHELL_IDS` imported from `./weapons`.
- `src/sim/world.ts` — default deck derivation uses the existing `STANDARD_SHELL_IDS` export
  instead of recomputing it; import adjusted accordingly (the explicitly permitted
  substitution).
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-2-fix-1-report.md` — this report.

A line-level `Compare-Object` of each of the three snapshot files in
`task-2-fix-1-baseline/` against its working copy shows only the changes listed above and
nothing else.

## Self-review

- The real production path now round-trips faithfully: `deploymentShellIds` emits a deck
  whose first entry is the free HE shell, `controller.ts` stores and forwards it, and the
  adapter hands that exact array to both tuple entries. HE appears exactly once, in slot
  one, in each entry — asserted directly, not inferred.
- The fixture change is a fixture correction, not a behavioural relaxation. The old fixture
  (`['mortar', ...]`, no HE) described a shape production cannot produce; under the fixed
  adapter it would have thrown from `makePlayerLoadouts`, which is the correct new
  behaviour and the reason the fixture had to be corrected.
- The previously masking mechanism is gone, not merely bypassed: the duplicate HE used to be
  silently swallowed by `toggleShell`'s free-shell early return in `src/sim/loadout.ts`. The
  adapter no longer produces a duplicate at all, so Tasks 3 and 4 receive clean tuples.
- The new runtime test asserts on the recorded `createWorld` options rather than on world
  state, so it fails on the adapter's contract directly and cannot be rescued by downstream
  deduplication.
- `src/sim/` remains pure: no DOM, no `window`, no `Math.random` was added. The `world.ts`
  edit substitutes one module-level constant for an identical local recomputation and cannot
  change any value, which the unchanged full-suite and golden-hash results confirm.
- `src/sim/playerLoadouts.ts` was not modified, as instructed.
- Both issues were driven test-first with the failure observed before the change. For issue
  2 the RED came from a deliberate, reverted mutant, because the finding was a missing
  assertion rather than a production defect; this is stated plainly above rather than
  presented as a real failure.

## Concerns

1. **Under-validation in `makePlayerLoadouts` (out of scope, already recorded).** The
   validator checks only `ids[0] === 'he'` and does not reject duplicates. That is exactly
   why this defect reached production silently: a tuple of `['he','he','mortar',...]` was
   accepted without complaint. The fix removes the current producer of such a tuple, but
   nothing structurally prevents a future caller from building one. As instructed, Task 1
   code was left alone; flagging it here because this incident is direct evidence for
   tightening it.
2. **The runtime's shared `loadoutIds` contract still exists.** `CreateMatchRuntimeOptions`
   still takes one `readonly string[]` and duplicates it into both tuple entries, so both
   players necessarily get the same deck. That is expected before Task 3 and unchanged here,
   but it means the adapter's per-player tuple is currently cosmetic. Task 3 replaces it.
3. **No type-level guarantee that `loadoutIds` starts with HE.** The adapter now relies on
   its caller supplying a complete deck; if a future caller passes an HE-less array, it will
   throw at world creation rather than fail at compile time. Acceptable for a temporary
   adapter, and the throw is loud, but worth carrying into Task 3's design.
