# Task 6 fix round 2 scoped re-review

## Verdict

- **Fix-round-1 Important finding — ADDRESSED.** TITLE/HOWTO now obtain functional accents through one spec-backed render contract; the functional color literals were not moved to another production file.
- **Prior Important finding 1 — remains ADDRESSED.** Non-gameplay TITLE/HOWTO decoration does not use `playerColor`.
- **Prior Important finding 2 — remains ADDRESSED.** `PlayerIndex` remains canonical and shared by projectile ownership and render identity.
- **New Critical findings: None.**
- **New Important findings: None.**

## Fix-round-1 Important finding — ADDRESSED

- `src/render/palette.ts:28-30` exports `functionalAccent(world: WorldId)` and returns `worldById(world).palette.accent`, so the render contract reads the validated world specification rather than storing duplicate literals.
- TITLE selects decorative world IDs at `src/render/titleScene.ts:73-75` and resolves the flag color through `functionalAccent(...)` at `src/render/titleScene.ts:230-246`.
- HOWTO selects the first two historical world IDs at `src/render/howtoScene.ts:36-38,176-177` and retains `HE_SHELL.accent` for the third trajectory. The HE accent is spec-backed at `spec/shells.json:3-14`.
- The exact restored accents remain spec-owned: `rust` is `#E8B33C` at `spec/worlds.json:74-84`, and `hollow` is `#4FC3D9` at `spec/worlds.json:164-174`.
- Fresh static audit `rg -n '#E8B33C|#4FC3D9' src --glob '!*.test.ts'` returned no matches, confirming the literals were not relocated into another production file.

## Prior Important findings remain ADDRESSED

- TITLE imports and uses `functionalAccent`, not `playerColor`, at `src/render/titleScene.ts:9,240`; HOWTO does the same at `src/render/howtoScene.ts:8,177`. Static search for `playerColor(` in both scene files returned no matches.
- Gameplay-owned presentation still resolves Blue/Pink through `playerColor`: projectile at `src/render/entities.ts:24-29`, trails at `src/render/entities.ts:49-61`, tank identity at `src/render/entities.ts:67-92`, HUD power at `src/render/hud.ts:110-116`, and muzzle feedback at `src/render/effects.ts:90-94`.
- `PlayerIndex` has one declaration at `src/sim/playerLoadouts.ts:4`; `src/sim/ballistics.ts:6` imports it and requires it for `Projectile.owner` and `LaunchOptions.owner` at `src/sim/ballistics.ts:14-45`.
- Owner propagation remains explicit: launch copies `options.owner` at `src/sim/ballistics.ts:58-68`, gameplay fire supplies `tank.player` at `src/sim/world.ts:275-283`, and apex-generated children copy `projectile.owner` at `src/sim/weapons.ts:70-90`. Airburst cloning preserves owner through the spread at `src/sim/weapons.ts:106-113`; bounce/roller paths continue the same projectile object at `src/sim/weapons.ts:155-190,204-238`.

## Checks

- Fresh focused run: `npm test -- --configLoader runner src/render/titleScene.test.ts src/render/howtoScene.test.ts src/render/playerIdentity.test.ts src/sim/projectileOwnership.test.ts src/sim/ballistics.test.ts src/sim/weapons.test.ts src/sim/exotic-projectiles.test.ts` — **7 files, 66 tests passed**.
- Fresh TypeScript check: `npx tsc --noEmit` — **exit 0**.
- Fresh static audits: no functional color literals in non-test `src`; no `playerColor` in TITLE/HOWTO; one `PlayerIndex` declaration; shared `functionalAccent` call sites confirmed.
- Fresh golden check: `spec/test-vectors.json` SHA-256 remains `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.
- Worker evidence accepted from the appended fix-round-2 report but not rerun here: full suite **52 files / 424 tests passed**.

## Scope note

The three original Minor findings remain explicitly deferred by the fix-round-2 package and are not reassessed here.
