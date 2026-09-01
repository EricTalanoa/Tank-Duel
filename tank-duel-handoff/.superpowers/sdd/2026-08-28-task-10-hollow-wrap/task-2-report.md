# Task 2 Report — Ring generator and Hollow registry

## Status

Implemented Task 2 only. Ring is a seeded, periodic terrain generator and Hollow is a shipped wrapping world. No general wrapped collision, terrain editing, camera, or rendering work was added.

## Implementation

- Added all Ring generator values to `spec/generators.json`; the generator imports every value from that spec entry.
- Ring draws five seeded phases and sums the specified integer-frequency sine harmonics over `[0, width)`, with no duplicate endpoint.
- Added `ring` to `SHIPPED_GENERATORS` and `GeneratorId`.
- Ring is forced when the fallback generator is Ring, so Hollow rejects non-seamless URL/creation/validation overrides while non-wrapping worlds retain normal generator selection.
- Added Hollow to `WorldId`, `SHIPPED_WORLDS`, URL resolution, and the `HOLLOW` export. Its profile fields, including kind and palette, are loaded from `spec/worlds.json`.
- Added measured Ring validation fallbacks for the existing six-world-by-six-generator matrix. The required `hollow:ring` fallback is seed `6`; it passes the real validator without any Task 4 provisional accommodation.
- Added tests for Ring registry/resolution, deterministic natural seam quality, Hollow registry/profile/ranges, wrapping override fallback, measured Hollow fallback validation, and the expanded accepted-terrain matrix.

## TDD evidence

### RED

Command:

```text
npm test -- src/sim/generators.test.ts src/sim/worlds.test.ts src/sim/world-ranges.test.ts src/sim/terrainValidation.test.ts
```

Result before implementation: 6 failures, caused by the missing Ring registry/generator implementation, missing Hollow registry/URL resolution/export, and unforced wrapping-world override behavior.

### GREEN

Command:

```text
npm test -- src/sim/generators.test.ts src/sim/worlds.test.ts src/sim/world-ranges.test.ts src/sim/terrainValidation.test.ts
```

Result: 4 test files passed, 64 tests passed.

The Ring fallback seeds were measured with the real validator:

```text
terra:ring=1, vesper:ring=63, rust:ring=2,
selene:ring=1, ferrum:ring=123, hollow:ring=6
```

## Final verification

```text
npm run build
```

Passed: TypeScript type check and Vite production build completed successfully.

```text
npm test
```

Passed: 37 test files, 274 tests.

## Concerns

None. The existing validator accepts Hollow/Ring terrain, so no temporary non-wrapped projectile/terrain-validation exception was needed. The workspace is not a Git repository; no commit was attempted.
