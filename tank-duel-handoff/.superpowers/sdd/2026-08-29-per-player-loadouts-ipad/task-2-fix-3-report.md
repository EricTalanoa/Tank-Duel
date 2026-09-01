# Task 2 — Fix Round 3 Report

**Status: DONE**

Hardened `makePlayerLoadouts` in `src/sim/playerLoadouts.ts` so an invalid deck fails at
construction. Both tuple entries are now validated independently for: HE in slot one
(unchanged check and message), duplicate ids, and non-playable ids.

## Changed files

| File | Change |
|---|---|
| `C:\Users\erict\Desktop\Personal Projs\Tank Duel\tank-duel-handoff\src\sim\playerLoadouts.ts` | Added `./weapons` import and a private `validateDeck` helper; `makePlayerLoadouts` now calls it for each deck. |
| `C:\Users\erict\Desktop\Personal Projs\Tank Duel\tank-duel-handoff\src\sim\playerLoadouts.test.ts` | Added 4 tests (duplicate named, duplicate in P2, unplayable/unknown id, regression pin). |
| `C:\Users\erict\Desktop\Personal Projs\Tank Duel\tank-duel-handoff\.superpowers\sdd\2026-08-29-per-player-loadouts-ipad\task-2-fix-3-report.md` | This report. |

Nothing else was touched. `src/sim/world.ts`, `src/sim/loadout.ts`, `src/ui/**`, controller,
runtime and everything under `spec/` are unmodified.

## Implementation

```ts
function validateDeck(deck: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of deck) {
    if (seen.has(id)) {
      throw new Error(`Complete player loadouts require unique shells, got duplicate ${id}`);
    }
    seen.add(id);
    weaponById(id);
  }
}
```

- The duplicate error names the offending id.
- Playability reuses `weaponById` from `src/sim/weapons.ts:48`, which throws
  `Unknown playable weapon: <id>`. The id set is not reimplemented and no shell id is
  retyped into `playerLoadouts.ts`; the only literal remains `CONSTANTS.loadout.freeShell`
  from `spec/constants.json`.
- The existing slot-one check and its `'HE in slot one'` message are unchanged and still
  run first, so the existing test asserting that text is untouched.
- Return shape is unchanged: frozen outer tuple, frozen copies of both decks.
  `PLAYER_COUNT` / `PlayerIndex` / `PlayerLoadouts` exports are unchanged.

## RED evidence (before implementation)

Command: `$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/sim/playerLoadouts.test.ts`

```
 ❯ src/sim/playerLoadouts.test.ts (6 tests | 4 failed) 17ms
     × rejects a duplicate id and names the offender 7ms
     × rejects a duplicate in player two’s deck just as in player one’s 1ms
     × rejects an id that is not a playable weapon 1ms
     × rejects the duplicated free shell that shipped as a defect earlier in this task 1ms

 FAIL  src/sim/playerLoadouts.test.ts > player loadouts > rejects a duplicate id and names the offender
AssertionError: expected [Function] to throw an error

- Expected:
null

+ Received:
undefined

 ❯ src/sim/playerLoadouts.test.ts:30:8

 FAIL  src/sim/playerLoadouts.test.ts > player loadouts > rejects a duplicate in player two’s deck just as in player one’s
AssertionError: expected [Function] to throw an error

- Expected:
null

+ Received:
undefined

 ❯ src/sim/playerLoadouts.test.ts:35:8

 FAIL  src/sim/playerLoadouts.test.ts > player loadouts > rejects an id that is not a playable weapon
AssertionError: expected [Function] to throw an error

- Expected:
null

+ Received:
undefined

 ❯ src/sim/playerLoadouts.test.ts:41:73

 FAIL  src/sim/playerLoadouts.test.ts > player loadouts > rejects the duplicated free shell that shipped as a defect earlier in this task
AssertionError: expected [Function] to throw an error
 ❯ src/sim/playerLoadouts.test.ts:51:86

 Test Files  1 failed (1)
      Tests  4 failed | 2 passed (6)
```

Each of the four new tests failed for the right reason — the constructor accepted the bad
deck and returned normally (`Received: undefined`, i.e. nothing thrown) — not from a typo
or a wrong import. The two pre-existing tests passed throughout.

Note the third failure line, `playerLoadouts.test.ts:41`: it is the `'anvil'` assertion, so
the "real shell that is deliberately not playable" case genuinely went unguarded before
this change, exactly as the brief predicted.

## GREEN evidence

Command: `$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/sim/playerLoadouts.test.ts src/sim/world.test.ts src/app/matchRuntime.test.ts`

```
 Test Files  3 passed (3)
      Tests  42 passed (42)
   Duration  2.04s
```

Command: `$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner`

```
 Test Files  49 passed (49)
      Tests  395 passed (395)
   Duration  7.37s
```

Command: `$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npx tsc --noEmit`

```
tsc clean, exit 0
```

(no diagnostics emitted; exit code 0)

Command: `$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/sim/purity.test.ts`

```
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

`sim/` purity holds with the new import — `weapons.ts` is itself a `sim/` module, so no DOM,
`window`, `Math.random`, node builtin or `render/` dependency is introduced.

### Counts

| Metric | Baseline | Now |
|---|---|---|
| Test files | 49 | 49 |
| Tests | 391 | 395 |
| `tsc --noEmit` | clean | clean |

+4 tests, all in `src/sim/playerLoadouts.test.ts`:

1. `rejects a duplicate id and names the offender` — `['he','mortar','mortar']` in P1.
2. `rejects a duplicate in player two’s deck just as in player one’s` — same shape in P2.
3. `rejects an id that is not a playable weapon` — `'anvil'` in P1, `'anvil'` in P2, and the
   plainly nonexistent `'nonexistent'`.
4. `rejects the duplicated free shell that shipped as a defect earlier in this task` — the
   permanent regression pin on `makePlayerLoadouts(['he','he','mortar'], ['he','he','mortar'])`,
   commented in-file with why that exact shape is pinned.

No test file count change, so no new `sim/` source file was added (the purity suite is
`it.each(files)`, and it stayed at 21).

## Import-cycle check

`playerLoadouts.ts` previously imported only `./constants`; it now also imports `./weapons`.

Verified rather than assumed, by computing the transitive `./`-relative import closure of
`src/sim/weapons.ts` over every non-test `.ts` file in `src/sim/`:

```
weapons transitively reaches: ballistics, constants, generators, rng, shells, terrain,
                              weapons, worldValidation, worlds, wrap
playerLoadouts in that set? false
```

`playerLoadouts` is absent from the closure, so the new edge
`playerLoadouts → weapons` closes no cycle. Corroborated independently by `tsc --noEmit`
passing and by the full suite loading every module without a partially-initialised-import
failure — a cycle here would very likely have surfaced as an undefined `weaponById` or an
undefined `PLAYABLE_WEAPONS` at module-evaluation time, because `weapons.ts` runs a
top-level validation loop over `PLAYABLE_WEAPONS` at import.

No cycle appeared, so the BLOCKED path was not taken.

## Call-site audit

Every `makePlayerLoadouts` call site in `src/`, and whether each supplied deck satisfies
the new guard:

| Call site | Decks supplied | Verdict |
|---|---|---|
| `src\sim\world.ts:201` | `STANDARD_SHELL_IDS` twice (default when `options.playerLoadoutIds` is absent) | **Safe.** `STANDARD_SHELL_IDS` is derived from `STANDARD_WEAPONS` ⊂ `PLAYABLE_WEAPONS`, so it is playable-only and duplicate-free by construction; `he` is slot 1 and first, which `world.test.ts:68` already asserts. |
| `src\app\matchRuntime.ts:108` | `options.loadoutIds` twice | **Safe.** Production value flows from `controller.ts:127` ← `mountLoadout`'s `onDeploy` ← `deploymentShellIds` (`src\ui\loadout.ts:52`), which builds its result by `PLAYABLE_WEAPONS.filter(...).map(shell.id)` — a filtered projection of a duplicate-free playable list, so duplicates and unplayable ids are structurally impossible and `he` leads in canonical order. This is the site of the original defect; it no longer prepends `'he'`. |
| `src\sim\world.test.ts:50` | `['he','mortar','cluster']`, `['he','roller','sand']` | Safe — distinct, all playable. |
| `src\sim\world.test.ts:79` | `['he','mortar']`, `['he','roller']` | Safe. |
| `src\sim\world.test.ts:96` | `['he','skipper','drill','sand','buster','cluster']` twice | Safe — 6 distinct playable ids. |
| `src\sim\repair.test.ts:9`, `:25` | `['he','repair']` twice, at both sites | Safe — `repair` is slot 13 and playable (only `anvil` is filtered out). |
| `src\ui\loadout.test.ts:46` | `['he','mortar']` twice | Safe. |
| `src\sim\playerLoadouts.test.ts` | valid-deck and HE-slot-one cases | Unchanged and still passing; the new negative cases throw by design. |

**No caller now throws.** The guard was not loosened for anyone. The full 49-file /
395-test suite passing is the empirical confirmation: `world.ts:201` and
`matchRuntime.ts:108` are exercised by the suite, and no previously-tolerated deck became
a failure.

Worth recording for Task 3: `matchRuntime.ts:108` passes the *same array reference* for
both players. `makePlayerLoadouts` already copies each deck, so the two arsenals stay
independent (asserted in `world.test.ts:49`), but per-player loadouts are not yet actually
per-player at that call site. That is expected at this checkpoint and out of scope here.

## Self-review

- **Slot-one behaviour preserved.** The original check runs first and unmodified, so
  `['mortar']` still reports `'HE in slot one'` rather than a duplicate/unknown message,
  and the existing assertion on that text keeps its meaning.
- **Check ordering inside a deck.** `validateDeck` tests duplicate-then-playable per id in
  deck order, so the first problem encountered is the one reported. For `['he','anvil']`
  that is `Unknown playable weapon: anvil`; for `['he','mortar','mortar']` it is the
  duplicate message. Both name the offending id, which is what the brief required.
- **Both players validated independently**, P1 first then P2, each through the same helper.
  The P2 test would fail if only P1 were checked.
- **No spec values retyped.** Only `CONSTANTS.loadout.freeShell` (pre-existing) and
  `weaponById`. No shell id string appears in `playerLoadouts.ts`.
- **Purity intact.** `weapons.ts` is a `sim/` peer; the purity suite passes unchanged.
- **Golden vectors untouched.** Never regenerated, never opened for writing.
- The regression test asserts a bare `.toThrow()` rather than a message. That is
  deliberate: it pins *that the shape is rejected*, which is the invariant, without
  freezing which of the two guards happens to catch it first.

## Golden vector hash

`spec/test-vectors.json` SHA-256:

```
D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8
```

Matches the expected value. Unchanged.

## Concerns

None blocking.

One observation carried forward, deliberately not acted on here: `createLoadout` in
`src/sim/loadout.ts` still silently repairs a malformed deck via `toggleShell`, and
`makeArsenal` still goes through it. This round hardens only the `makePlayerLoadouts`
boundary, so a deck that reaches `createLoadout` by some other path is still repaired
rather than rejected. Whether `makeArsenal` should materialise decks literally is the open
Task 3 decision named as out of scope in the brief.

## Notes

- The workspace is not a git repository. No `git init`, no commit, no branch — nothing
  git-related was run.
