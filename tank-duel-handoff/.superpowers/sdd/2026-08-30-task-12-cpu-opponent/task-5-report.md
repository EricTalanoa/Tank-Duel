# Task 12 / Task 5 — Integrated acceptance and stop

## Status

**DONE.** All five plan steps executed. Automated gate, statistical acceptance, browser CPU flow,
and orientation lifecycle all pass. No source fix was required, so Step 6 did not trigger.

## Step 1 — Fresh complete automated gate

| Command | Result |
| --- | --- |
| `npx vitest run --configLoader runner` | 54 files, **471/471 passed**, exit 0 |
| `npx tsc --noEmit` | exit 0, no diagnostics |
| `npx vite build --outDir D:\codex-temp\tank-duel-task-12-final --emptyOutDir` | exit 0; 63 modules, 104.59 kB JS / 6.84 kB CSS |
| `Get-FileHash spec\test-vectors.json` | `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8` — unchanged |

`spec/cpu.json` SHA-256 also unchanged: `8117D182B8E332C20188F68BDCC96E9F07C6972AE59E9D2A3974CE8BB75E7C64`.

## Step 2 — Statistical acceptance

Executed as part of the Step 1 gate. `src/sim/cpuTrials.test.ts:87` runs the canonical 500-trial
protocol per tier (seeds 0–499, Terra, production ballistics/wind/spawns, HE, 15-shot cap,
capped shots counted as failures) and asserts exact reproduction — `mismatches` empty for all three
tiers. `:106-107` additionally assert divergence from the historical figures, so the accepted
deviation is pinned rather than hidden.

| Tier | Mean | Median | Failed / 500 | Historical `cpu.json` | Δ mean |
| --- | --- | --- | --- | --- | --- |
| Recruit | 4.5 | 3 | 6 | 5.6 / 5 / 70 | −1.1 |
| Gunner | 2.904 | 2 | 1 | 3.7 / 3 / 18 | −0.796 |
| Veteran | 2.194 | 2 | 3 | 2.8 / 2 / 11 | −0.606 |

**Plan Step 2's literal "±0.5 of parsed spec target" is not met by any tier.** This is the
pre-existing, authorized deviation recorded in the ledger's Task 2 ruling: `spec/cpu.json` is
preserved unchanged as historical reference metadata, and `spec/cpu-trials.json` is the canonical
reproducible protocol this codebase is accepted against. Acceptance therefore ran against the
canonical protocol while reporting the historical deltas above, exactly as that ruling directs.

Direction of the deviation is worth stating plainly: every tier is **stronger** than the historical
reference — fewer shots to hit and far fewer failures (Recruit 70→6). The CPUs are harder than the
original figures describe, not weaker.

Focused wind proofs, both passing: Recruit ignores wind (`src/sim/cpu.test.ts:167`), Veteran applies
the full wind-delta correction (`:179`).

## Step 3 — Browser CPU flow at 1194x834

Driven with Playwright (Chromium) against the running dev server. The in-app Browser pane could not
be used for the live-match portions: its tab is intermittently hidden, which suspends
`requestAnimationFrame` and freezes the simulation mid-flight. That is a harness artifact, not an
app defect — the same build runs normally under Playwright. Menu/DOM assertions were verified in
both surfaces and agree.

| Item | Result |
| --- | --- |
| Two-click Quick Start | TITLE → `quickStart` → MAP → `selectMap` → ROUND_INTRO, mode `local` |
| CPU selection adds no screen | `[data-mode="cpu"]` on MAP keeps screen `MAP` |
| Recruit/Gunner/Veteran present, ordered, selectable | `aria-pressed` moved to `veteran:true` on click; all three enabled only in CPU mode |
| Tier controls disabled in local mode | `recruit:disabled / gunner:disabled / veteran:disabled` while `mode=local` |
| Touch/focus targets | Tier buttons 328x48, mode buttons 93x48 and 83x48 — all ≥44px; `.focus()` lands on the tier button |
| One human editor + CPU summary | `[data-player]` × 1, `[data-cpu-summary]` × 1 |
| Summary is read-only and icon-complete | 6 shells `he, mortar, cluster, buster, roller, sand`; 6 icons; **0** `[data-shell]` controls inside; text `CPU opponent / CPU arsenal / Veteran · READ ONLY` |
| Single shared Deploy | `[data-deploy]` × 1 |
| Distinct arsenals | P1 edited to `[he, buster, roller, sand]`; CPU `[he, mortar, cluster, buster, roller, sand]` — distinct, CPU deck complete at 6 |
| Automatic Player 2 aim + fire | Phase timeline `1/0/flight/0 → 1/0/settle → 1/1/flight/1 → 1/1/settle → 2/0/aim`; projectile owner 1; CPU `selectedShellId` = `he`; P1 100→80 HP |
| Rematch | Full Recruit round played (19 player shots) → ROUND_OVER (`Rematch / Change loadout / Menu`) → Rematch → MATCH; CPU deck still complete; stored config `cpu/recruit` |
| Local two-editor regression | `mode=local` `aria-pressed=true`; `[data-player]` × 2, `[data-cpu-summary]` × 0; decks deployed independently as `[he, cluster, buster, roller, sand]` vs `[he, mortar, cluster, buster, sand]` |
| Console warnings/errors | **Empty** across all four browser runs (only Vite HMR debug lines) |

## Step 4 — Orientation lifecycle

Rotated to 834x1194 while Player 2 (CPU) held the turn:

- Rotate surface blocks the app, and **0** interactive elements exist outside the gate.
- Simulation frozen while portrait: two state samples 1.5s apart were byte-identical.
- Returning to 1194x834 resumed the same turn.
- **No duplicate CPU shot:** HP `[100,100]` before rotation → `[80,100]` after, i.e. exactly one
  20-damage CPU hit across the rotate/resume boundary.
- Console clean throughout.

## Step 5 — Whole-task audit

| Audit item | Result |
| --- | --- |
| No true firing-solution solver | `src/sim/cpu.ts` contains no inverse/trig solve; the only `exact*` symbols are the strict-parser helpers (`exactKeys`, lines 81–172). Correction is bracketing from the CPU's own observed impact. |
| No DOM / `Math.random` in `sim/` | Grep over `src/sim/*.ts` finds those tokens only inside comments documenting the prohibition (`rng.ts:4`, `terrain.ts:8`, `world.ts:4`). `src/sim/purity.test.ts` passes. |
| Source-of-truth usage | `CPU_TIERS` is the single tier registry; UI parses no `cpu.json`. CPU deck derives only from `STANDARD_SHELL_IDS` via `makePlayerLoadouts`. One residual duplication carried as Task 4 F3. |
| 500-trial methodology | Canonical protocol, seeds 0–499, production physics, capped shots counted; reproduced exactly. |
| CPU deck boundary | Canonicalized at both the loadout model and the controller; a malicious/stale UI deck is discarded (Task 4 review, `controller.test.ts:105-134`). |
| Pause / disposal lifecycle | Task 3 review PASS, re-confirmed live by the Step 4 rotation (freeze, single resume, no duplicate shot). |
| Local-mode regression | Verified live in Step 3. |
| Golden immutability | `test-vectors.json` and `cpu.json` hashes unchanged. |
| No Task 13 / visual overhaul | No `task 13` / `overhaul` markers in source; changed-file inventory across Tasks 1–4 contains no visual-overhaul work. |

## Changed files (Task 5)

None in `src/` or `spec/`. Task 5 was acceptance-only and required no source fix, so Step 6 did not
run. Files created/updated: this report, `progress.md`, and a root `.claude/launch.json` added so the
preview tooling could locate the dev server (tooling config, not application source).

## Carried findings

Three non-blocking Minors from the Task 4 review remain open and are unchanged by this checkpoint:

- **F2** — eight stale RED-era `as unknown as` casts in the new tests.
- **F3** — `CPU_TIERS[1]!.id` in `loadout.ts:98` duplicates `CREATE_DEFAULT_CPU_TIER_ID`.
- **F4** — `.cpu-tier-controls` fieldset has no CSS rule and renders unconditionally, showing three
  permanently disabled buttons in local mode. **Confirmed visually during this checkpoint** on MAP.

**F1** (CPU mode/tier storage persistence has no test) remains waived by owner ruling. Live browser
runs incidentally confirmed the behavior works: `localStorage` held `cpu/veteran` and later
`cpu/recruit` across navigation and rematch.

## Limitations

- The in-app Browser pane cannot drive the real-time simulation because its hidden tab suspends
  `requestAnimationFrame`. All live-match evidence above comes from Playwright/Chromium.
- Rematch was exercised at Recruit only; Gunner and Veteran rematch paths rely on the shared flow
  reducer, which is covered by `flow.test.ts`.

## Stop

Task 12 is complete at its stated line: **Single player works.** Task 13 was not begun.
