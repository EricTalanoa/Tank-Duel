# Task 1 Brief — Spec-backed configuration and persistence

Read the approved Task 11 design first. Implement only Task 1 from the plan.

## Files

- Create `src/ui/config.ts`, `src/ui/config.test.ts`, `src/ui/storage.ts`, `src/ui/storage.test.ts`.

## Required interfaces

- `MatchConfig`
- `createDefaultConfig()`
- `validateConfig(value)`
- `resolveMatchConfig(config, seedRng)`
- `loadLastConfig(storage)`
- `saveLastConfig(storage, config)`
- an injected `StorageLike` interface; production localStorage wiring is deferred.

## Requirements

- Import all worlds, generators, shells, icons, ammunition constraints, defaults, and screen membership from `spec/*.json` or existing typed spec-backed registries. Do not retype values from docs.
- HE is enabled, locked, unlimited, and cannot decode as disabled.
- Random resolves through the seeded RNG to a shipped world and a compatible generator.
- Persistence is versioned and validates unknown data structurally. Wrong version, unknown IDs, invalid shape, disabled HE, and out-of-range ammo fall back to defaults; never silently clamp.
- Keep all code headless and outside `sim/`; no DOM/window/localStorage globals in these modules.
- Do not modify `spec/test-vectors.json` or implement screens/reducer/runtime.
- Use TDD. Run focused tests with `npm test -- --configLoader runner ...`, D: temp/cache, then `npx tsc --noEmit`.
- Write `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-1-report.md` containing changed files, RED/GREEN commands/output, self-review, and concerns.
