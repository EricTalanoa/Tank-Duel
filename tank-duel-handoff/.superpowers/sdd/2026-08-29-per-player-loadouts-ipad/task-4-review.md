# Task 4 Independent Review — Side-by-side independent loadout owner

Reviewed the Task 4 package, approved design and implementation plan, worker report, Task 4 baseline snapshots, and current `src/ui/loadout.ts`, `src/ui/loadout.test.ts`, `src/ui/loadout.css`, and `src/main.ts`. No production files were edited.

## Spec-compliance verdict: PASS

### Findings

- **Critical:** None.
- **Important:** None.
- **Minor:** None.

### Requirement evidence

| Requirement | Independent evidence |
|---|---|
| Two independent decks and budgets | Separate `Loadout` instances are created from tuple entries at `src/ui/loadout.ts:87-90`; a toggle changes only the addressed instance and refreshes only its panel at `src/ui/loadout.ts:103-109`. Limits remain delegated to the spec-backed loadout implementation. |
| HE is free, locked, and in slot one for both players | The source-of-truth rule is `spec/constants.json:51-55`; HE is included in each enabled set at `src/ui/loadout.ts:237-239`, locked at `src/ui/loadout.ts:64-65`, and rendered disabled at `src/ui/loadout.ts:221-225`. |
| Stable Player 1 / Player 2 order | The deployment tuple is explicitly assembled as Player 1 then Player 2 at `src/ui/loadout.ts:111-115`; rendering preserves that tuple order at `src/ui/loadout.ts:140-146`. |
| Neutral, equal-width labelled panels | Presentation labels are imported at `src/ui/loadout.ts:1` and read at `src/ui/loadout.ts:199`; the two equal grid columns are `src/ui/loadout.css:2`, while neutral panel styling is `src/ui/loadout.css:3-7`. This matches `spec/presentation.json:5-8` and `spec/screens.json:87-94`. |
| One shared Deploy action, valid only when both decks are valid | `canDeploy` evaluates both panel validations at `src/ui/loadout.ts:100-102`; the one button is disabled from it at `src/ui/loadout.ts:142-146` and rechecked before callback at `src/ui/loadout.ts:165-169`. |
| Spec-backed shell/card values and default deck | Cards derive from imported playable weapons at `src/ui/loadout.ts:5,46-68`; the shared default uses the existing `STANDARD_SHELL_IDS` helper at `src/ui/loadout.ts:84-86`, whose sole derivation is `src/sim/weapons.ts:44-46`. Points, slots, and free-shell values are read from `CONSTANTS` at `src/ui/loadout.ts:50,64,187,217,238`. |
| Accessibility and iPad layout requirements | Safe-area padding is `src/ui/loadout.css:1`; two-panel landscape layout and scrolling are `src/ui/loadout.css:2-3`; card/deploy targets meet the 44px minimum at `src/ui/loadout.css:9,16`; visible non-disabled keyboard focus is `src/ui/loadout.css:13,17`. No hover-only selector or Blue/Pink player color exists in this stylesheet. |
| Idempotent owner disposal and deploy-before-callback cleanup | `dispose` guards repeat calls and removes both listener and overlay at `src/ui/loadout.ts:172-177`; deployment snapshots, disposes, then invokes the callback at `src/ui/loadout.ts:165-169`. |
| Public contract and temporary adapter removal | The required tuple contract is present at `src/ui/loadout.ts:120-124`. `src/main.ts:31-38` forwards the tuple directly. A fresh source grep found zero matches for `initialShellIds`, the old single-deck `onDeploy`, `makePlayerLoadouts(ids, ids)`, and the Task 4 adapter marker. |
| Golden immutability | `spec/test-vectors.json:1` remains the golden-data file. Its current SHA-256 is `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`, matching the pre-review value recorded in `task-4-report.md`; no golden-data discrepancy was found. |

## Code-quality verdict: PASS

### Findings

- **Critical:** None.
- **Important:** None.
- **Minor:** None.

### Quality evidence

- The editor model is DOM-free (`src/ui/loadout.ts:81-118`); DOM access begins only inside `mountLoadout` (`src/ui/loadout.ts:130-181`), preserving import safety.
- Model boundary copies are preserved: panel projections are frozen at `src/ui/loadout.ts:198-203`, and deployed tuples are recreated through `makePlayerLoadouts` at `src/ui/loadout.ts:111-115`.
- Tests cover cross-player mutation isolation, filtering, HE state, immutable caller input, independent DOM counters, tuple order, and idempotent disposal at `src/ui/loadout.test.ts:42-111,143-223`.
- The baseline/current comparison across the four package-approved production targets confirms a focused replacement of the one-deck owner; `src/main.ts` removes rather than retains the compatibility adapter.

## Independent checks

| Check | Result |
|---|---|
| `npm test -- --configLoader runner src/ui/loadout.test.ts src/app/controller.test.ts src/ui/appView.test.ts` | 3 files passed, 27 tests passed. |
| `npm test -- --configLoader runner` | 49 files passed, 406 tests passed. |
| `npx tsc --noEmit` | Exit 0 with no diagnostics. |

The worker-reported Vite build was not rerun because this independent review was limited to read-only checks; the fresh full test suite and strict typecheck above were run by the reviewer.
