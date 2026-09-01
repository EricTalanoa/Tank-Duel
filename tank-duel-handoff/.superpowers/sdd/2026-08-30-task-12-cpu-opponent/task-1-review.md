# Task 1 independent review

## Verdicts

- **Spec compliance: FAIL.** The registry/parser and CPU-command implementation satisfy the
  Task 1 interfaces and the published formulas, but the approved design explicitly requires
  derived-gain consistency tests against the live range table/constants. No such test exists.
- **Code quality: PASS (with minor test-coverage concerns).** The implementation is compact,
  deterministic, pure, immutable at its public outputs, and directly follows the parsed rule
  values. The focused test suite is meaningful, although it leaves one firing direction and an
  invalid opening distance unpinned.

## Fresh checks

| Check | Result | Evidence |
| --- | --- | --- |
| Task 1 focused/purity gate | PASS | `$env:TEMP='D:\\codex-temp'; $env:TMP='D:\\codex-temp'; npm test -- --configLoader runner src/sim/cpu.test.ts src/sim/purity.test.ts` exited 0: 2 files, 37/37 tests. |
| Strict TypeScript | PASS | `$env:TEMP='D:\\codex-temp'; $env:TMP='D:\\codex-temp'; npx tsc --noEmit` exited 0 with no diagnostics. |
| Full regression suite | PASS | `$env:TEMP='D:\\codex-temp'; $env:TMP='D:\\codex-temp'; npm test -- --configLoader runner` exited 0: 53 files, 440/440 tests. |
| Golden immutability | PASS | SHA-256 of `spec/test-vectors.json`: `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`, matching the package baseline. |
| Production scope | PASS | Review found Task 1 production only in `src/sim/cpu.ts`; no production file was edited by this review. |

## Ranked findings

### Important — F1: Derived gains are not checked against the live range table/constants

**Verdict impact:** spec compliance FAIL.

The approved design requires that parsed derived gains have consistency tests against the current
range table/constants, so an underlying physics change cannot silently leave the CPU gains stale.
The implementation only imports physics constants for the opening formula
([`src/sim/cpu.ts:1-3`](../../../src/sim/cpu.ts), [`src/sim/cpu.ts:238`](../../../src/sim/cpu.ts)),
while its tests merely pin the checked-in CPU literals
([`src/sim/cpu.test.ts:35-55`](../../../src/sim/cpu.test.ts)). Neither production nor test code
derives or cross-checks `rangePerPowerPoint` / `driftPerWindUnit` against the current range
table/constants. This misses the design's stale-gain regression protection.

### Minor — F2: The correction test covers only right-facing direction

**Verdict impact:** code-quality concern; formula inspection currently passes.

The test asserting the positive-is-short correction uses only `direction: 1`
([`src/sim/cpu.test.ts:137-151`](../../../src/sim/cpu.test.ts)). The production formula correctly
multiplies the observed error and wind correction by `options.direction`
([`src/sim/cpu.ts:242-246`](../../../src/sim/cpu.ts)), but no literal expectation exercises
`direction: -1`. A future left-facing sign regression could therefore pass this suite.

### Minor — F3: Negative finite opening distance produces a non-finite command

**Verdict impact:** code-quality concern only; normal runtime distance is expected to be valid.

`chooseCpuCommand` validates only that distance is finite
([`src/sim/cpu.ts:225-230`](../../../src/sim/cpu.ts)) and directly takes its square root
([`src/sim/cpu.ts:236-239`](../../../src/sim/cpu.ts)). A finite negative distance returns `NaN`
power. The public simulation helper should either reject negative distance or guarantee its
non-negative precondition in the interface/tests.

## Package-bullet audit

| Required audit | Result | Exact evidence |
| --- | --- | --- |
| Strict parser behavior | PASS | Exact root/tier/measured keys and ordered algorithm checks: [`src/sim/cpu.ts:81-179`](../../../src/sim/cpu.ts). Missing/extra keys, reordering, non-finite gain, malformed measured/hit/clamp/elevation fixtures are tested at [`src/sim/cpu.test.ts:57-118`](../../../src/sim/cpu.test.ts). |
| Frozen registry and memory | PASS | Registry/rules/tier records freeze at [`src/sim/cpu.ts:112-134`](../../../src/sim/cpu.ts), [`src/sim/cpu.ts:160-184`](../../../src/sim/cpu.ts); new/observed memory is frozen at [`src/sim/cpu.ts:190-195`](../../../src/sim/cpu.ts), [`src/sim/cpu.ts:206-223`](../../../src/sim/cpu.ts). Tests assert registry/memory/command immutability at [`src/sim/cpu.test.ts:29-33`](../../../src/sim/cpu.test.ts), [`src/sim/cpu.test.ts:122-135`](../../../src/sim/cpu.test.ts), [`src/sim/cpu.test.ts:207-215`](../../../src/sim/cpu.test.ts). |
| Exact formula signs and order | PASS | Opening formula: [`src/sim/cpu.ts:236-239`](../../../src/sim/cpu.ts). Correction, signed wind term, clamp, then jitter: [`src/sim/cpu.ts:242-252`](../../../src/sim/cpu.ts). Literal correction, Veteran-wind, and clamp-order checks: [`src/sim/cpu.test.ts:137-190`](../../../src/sim/cpu.test.ts). |
| Tier jitter on every later shot | PASS | Every complete-memory path applies `rng.range(-tier.jitter, tier.jitter)` after the clamp: [`src/sim/cpu.ts:242-252`](../../../src/sim/cpu.ts). The opening path deliberately has no later-shot correction/jitter, consistent with Task 1 plan's separate opening formula. |
| Opening formula | PASS | Parsed fixed elevation plus `sqrt(distance * baseGravity) / muzzleCoefficient`: [`src/sim/cpu.ts:236-239`](../../../src/sim/cpu.ts); pinned command: [`src/sim/cpu.test.ts:122-135`](../../../src/sim/cpu.test.ts). |
| Observed-impact-only correction | PASS | Memory retains only impact, wind, and actual command power: [`src/sim/cpu.ts:31-35`](../../../src/sim/cpu.ts), [`src/sim/cpu.ts:206-223`](../../../src/sim/cpu.ts). Later correction reads only those fields plus target/direction/wind: [`src/sim/cpu.ts:242-248`](../../../src/sim/cpu.ts). No solver/helper is present. |
| Direction handling | PASS, test gap | Code uses the published direction multiplier in both terms: [`src/sim/cpu.ts:242-246`](../../../src/sim/cpu.ts). See F2 for untested `-1` direction. |
| Recruit/Veteran wind skill | PASS | Parsed bounded `windSkill`: [`src/sim/cpu.ts:119-134`](../../../src/sim/cpu.ts); applied in formula: [`src/sim/cpu.ts:244-248`](../../../src/sim/cpu.ts); Recruit zero and Veteran full tests: [`src/sim/cpu.test.ts:153-177`](../../../src/sim/cpu.test.ts). |
| Seeded reproducibility | PASS | Only injected `Rng` is consumed: [`src/sim/cpu.ts:248`](../../../src/sim/cpu.ts); same-seed equality test: [`src/sim/cpu.test.ts:193-205`](../../../src/sim/cpu.test.ts). |
| No true-solution helper | PASS | `cpu.ts` imports only the CPU spec, simulation constants, and `Rng`: [`src/sim/cpu.ts:1-3`](../../../src/sim/cpu.ts). The later branch is a direct observed-error adjustment at [`src/sim/cpu.ts:242-248`](../../../src/sim/cpu.ts). |
| No retyped CPU numeric values | PASS | CPU rules are extracted from parsed JSON at [`src/sim/cpu.ts:137-184`](../../../src/sim/cpu.ts); calculations reference `CPU_RULES` and imported `CONSTANTS` at [`src/sim/cpu.ts:236-248`](../../../src/sim/cpu.ts). F1 remains: the design-required stale-gain consistency test is absent. |
| Simulation purity | PASS | CPU module imports no UI/render/browser API ([`src/sim/cpu.ts:1-3`](../../../src/sim/cpu.ts)); repository purity gate scans all non-test sim sources for DOM, Canvas, wall-clock, render, Node builtins, and `Math.random` at [`src/sim/purity.test.ts:24-54`](../../../src/sim/purity.test.ts). Fresh focused gate passed. |
| Test independence/mutation strength | PASS with concerns | Tests use hand-pinned literals and name intended production mutations throughout [`src/sim/cpu.test.ts:18-217`](../../../src/sim/cpu.test.ts). F1 and F2 identify missing stale-gain and left-direction mutations. |
| Golden immutability | PASS | Fresh SHA-256 matches the package baseline; `spec/test-vectors.json` was read only. |

## Review boundary

Read: the review package, Task 1 brief/report, approved Task 12 design, full implementation plan,
`spec/cpu.json`, and current `src/sim/cpu.ts` / `src/sim/cpu.test.ts`. Also inspected the direct
constants/RNG/purity dependencies required to validate the production boundary. No production code
was changed and no subagents were dispatched.
