# Task 5 Brief — Title and HOWTO canvas scenes

Implement only Task 5 from the approved plan. Read `.impeccable.md`, the approved design, `spec/screens.json`, and relevant spec-backed physics/test-vector modules first.

## Files and interfaces

- Create `src/render/titleScene.ts`, `src/render/titleScene.test.ts`, `src/render/howtoScene.ts`, `src/render/howtoScene.test.ts`.
- Export `createTitleScene(canvas, options): DisposableScene` and `createHowtoScene(canvas, options): DisposableScene`, each with idempotent `dispose()`.
- Use injected RAF/time/RNG/motion policy and testable model/update seams; no `Math.random`.

## Title requirements

- Canvas only, no visual assets.
- Implement all seven `screens.json` systems: embers, drifting cloud bands, sweeping beams, waving flags, twinkling stars, pulsing muzzle glow, periodic exchange of fire.
- One orchestrated hero scene; do not add scattered menu animation.
- Deterministic local seeded animation, bounded pools/work over long runs, transform/opacity-oriented drawing, and stable 60 fps intent.
- Reduced motion materially removes/slows decorative motion while retaining a usable static atmospheric title and non-blocking menus.

## HOWTO requirements

- Animate three historical/spec-backed trajectories ordered short → long → hit.
- Import or derive every ballistic/gameplay number from spec/test vectors/constants. Do not copy superseded prose values from `docs/05-flow.html`.
- Expose no API that predicts a current-match shot; this is explanatory history only.

## Verification

- TDD: prove all seven systems, deterministic output/state, bounded counts/work, disposal, reduced motion, three-shot ordering, and no prediction API.
- Use deterministic work-count/frame-budget assertions rather than flaky wall-clock tests.
- Run focused render tests, purity, and TypeScript with runner/D:. Write task-5-report.md.
- Do not wire scenes to the controller or implement Task 12.
