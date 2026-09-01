# Task 6 brief — Blue/Pink gameplay presentation

Implement checkpoint 6 only. Use strict TDD and preserve every existing physics result.

## Source-of-truth and boundary

- Player colors must come from `PRESENTATION.players[player].color`; never duplicate them.
- Never edit or regenerate `spec/test-vectors.json`.
- Blue/Pink applies only to player-owned combat presentation: tank body, health fill,
  active-turn marker, aim indicator, projectile/bullet, player-owned trail, and directly related
  player feedback.
- Keep menus/loadout neutral. Keep terrain, explosions, shell icons, and generic accents on their
  existing functional palette. Identity must retain labels/shape/luminance cues and not be color-only.
- Projectile ownership may select render color only; it must never affect physics, damage, terrain,
  RNG, or determinism.
- Do not implement CPU behavior, ammunition changes, or the visual overhaul.

## Expected files and interfaces

- Modify `src/render/palette.ts`, `entities.ts`, `hud.ts`, and `effects.ts` only where it renders
  player-owned muzzle/projectile feedback.
- Modify `src/sim/ballistics.ts`, `.test.ts`, `world.ts`, and only projectile-variant fixtures/tests
  exposed by adding ownership.
- Create `src/render/playerIdentity.test.ts`; update existing render tests whose old hardcoded
  player colors legitimately change.
- Export `playerColor(player: PlayerIndex): string` from the render layer.
- Add `readonly owner: PlayerIndex` to `Projectile` and `LaunchOptions`; `fire` passes the active
  tank's player index, and every split/bounce/roller/projectile variant preserves the same owner.
- Remove old `PALETTE.playerOne/playerTwo` after consumers migrate; do not leave competing identity
  contracts.

## Required tests

- First observe RED for `playerColor`, player-owned render surfaces, and projectile owner propagation.
- Recording-canvas behavior must prove both players' tanks, health fills, active marker, aim
  indicator, projectile, and trail use their corresponding spec color.
- Prove shell icons and explosion colors remain functional colors.
- Prove every projectile variant preserves owner through continuation/spawn paths.
- Run focused render/projectile tests, then `npm test -- --configLoader runner`, `npx tsc --noEmit`,
  and a Vite build with TEMP/TMP/output on D:.
- Report RED/GREEN evidence, counts, changed files, exact migrated surfaces, unaffected functional
  colors, physics/determinism proof, source-of-truth audit, golden hash, self-review, and concerns in
  `task-6-report.md`.

Do not initialize Git and do not dispatch subagents.
