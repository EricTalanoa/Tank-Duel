# Task 2 Brief — Ring generator and Hollow registry

## Context

Task 1 established `src/sim/wrap.ts`. This checkpoint adds the seamless Ring generator and ships Hollow, but does not yet implement wrapped collision, terrain edits, camera, or rendering.

## Global constraints

- `spec/*.json` owns every gameplay/generator value; production imports rather than retyping documentation numbers.
- `spec/test-vectors.json` is immutable.
- Projectile/trail x is unbounded; world-owned x is canonical in `[0,width)`.
- Non-wrap behavior remains unchanged.
- Hollow ships with Ring only; a wrapping world must reject/fall back from non-seamless generator overrides.
- No Git repository exists; do not commit.
- Follow TDD and record red/green evidence.

## Files

- Modify `spec/generators.json`.
- Modify `src/sim/generators.ts` and `src/sim/generators.test.ts`.
- Modify `src/sim/worlds.ts`, `src/sim/worlds.test.ts`, and `src/sim/world-ranges.test.ts`.
- Modify `src/sim/terrainValidation.ts` and `src/sim/terrainValidation.test.ts` only as needed for Hollow/Ring fallback and wrapping-world generator constraints.

## Ring requirements

Add the exact working-reference values from `docs/03-worlds.html` to `spec/generators.json`; production must import all of them:

- harmonic count 5;
- integer frequency start 1;
- base height fraction 0.56;
- amplitude numerator fraction 0.09;
- amplitude decay factor 0.6 in denominator `k * decay + 1`;
- phase range is a full turn;
- clamp ceiling fraction 0.34 and floor margin 50.

Generate five seeded phases, then for each x add integer-period sine harmonics using `(x / width) * fullTurn * frequency + phase`. Do not duplicate the endpoint.

Extend `SHIPPED_GENERATORS`/`GeneratorId` with `ring`.

Tests must assert deterministic Ring output and:

`abs(h[width - 1] - h[0]) <= mean(abs(h[x] - h[x - 1]))`

Also assert the chosen seed's seam step is nonzero, proving no artificial flat seam.

## Hollow requirements

Extend `WorldId`, `SHIPPED_WORLDS`, and URL resolution with Hollow. Export `HOLLOW` if consistent with existing `TERRA` use. Hollow must import every profile field from `spec/worlds.json` and match `spec/test-vectors.json` Hollow power-75, power-100, and frame values under the existing golden-range harness.

When `world.wrap` is true, resolve/generate Ring even if a non-seamless generator query override is supplied. Non-wrap worlds retain independent selection among all generators.

Measure a passing Hollow/Ring validation fallback seed using the real validator, store it under `hollow:ring` in `spec/generators.json`, and add it to the 6-world accepted-terrain matrix without altering any golden vectors.

If the current Task 9 validator cannot validate periodic terrain because its projectile/world interaction is intentionally non-wrapped until Task 4, make the smallest explicit provisional accommodation scoped to Hollow/Ring and record it as a concern for Task 4. Do not implement general wrap collision early.

## Verification

- RED focused generator/world tests before implementation.
- GREEN: `npm test -- src/sim/generators.test.ts src/sim/worlds.test.ts src/sim/world-ranges.test.ts src/sim/terrainValidation.test.ts`.
- `npm run build`.
- Run full `npm test` once after focused green.
- Write full report to `.superpowers/sdd/2026-08-28-task-10-hollow-wrap/task-2-report.md`.
