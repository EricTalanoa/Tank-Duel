# Task 5 brief — landscape iPad orientation gate

Implement checkpoint 5 from the approved per-player-loadouts/iPad plan. Use strict TDD:
write each behavioral test first, run it, and record the expected RED before changing production.

## Source-of-truth constraints

- Consume `PRESENTATION.requiredOrientation` and
  `PRESENTATION.minimumLandscapeWidthPx`; do not retype their values in production.
- Never edit or regenerate `spec/test-vectors.json`.
- Keep orientation/DOM concerns out of `src/sim/`.
- Do not implement Task 6 colors, CPU behavior, ammunition changes, or the visual overhaul.

## Files

- Create `src/ui/orientationGate.ts`, `.test.ts`, and `.css`.
- Modify `src/app/controller.ts` and `.test.ts`.
- Modify `src/render/titleScene.ts` and `.test.ts`.
- Modify `src/render/howtoScene.ts` and `.test.ts`.
- Modify `src/main.ts`.
- Write the implementation report to this plan workspace as `task-5-report.md`.

## Required behavior

- Export `ViewportSize` and pure `isPresentationBlocked(size)`. Block portrait/square viewports
  and landscape viewports narrower than the spec minimum. The required examples are 768x1024
  blocked, 1194x834 allowed, 800x600 blocked, and 1200x800 allowed.
- Export `mountOrientationGate(root, viewport, onBlockedChange): OrientationGate`.
- The owner observes resize/orientation changes, emits one callback per actual blocked-state
  change, shows a full-screen `Rotate your iPad` surface with an accessible instruction, and
  applies both `inert` and `aria-hidden` to the underlying app surface.
- Preserve and restore the app surface's prior inert/ARIA state on unblock and dispose. Listener
  cleanup and disposal must be idempotent.
- Add a shared `PausableDisposable` contract with `setPaused(paused: boolean)` as appropriate.
  Title and HOWTO scenes must cancel their frame while paused; resume resets time baseline and
  schedules exactly one frame without resetting particles or other animation state. Repeated calls
  and disposal are idempotent.
- The controller records presentation blocking and pauses the active title scene, HOWTO scene, or
  match runtime. An owner created while already blocked is paused immediately before advancement.
  Loadout/menu owners remain mounted and are blocked by inertness, not recreation.
- `main.ts` mounts and disposes the gate and routes its state into the controller.
- CSS is tablet/landscape aware, covers the viewport and safe areas, contains no hover-only
  interaction, and follows the existing dark tactical/mechanical visual direction. This is a
  functional gate, not the visual overhaul.

## Tests and verification

- Tests must cover policy boundaries, callback de-duplication, listener cleanup, overlay semantics,
  inert/ARIA restoration, pause/resume frame counts, owner creation while blocked, exact state
  preservation, and idempotent cleanup.
- Focused gate:
  `npm test -- --configLoader runner src/ui/orientationGate.test.ts src/app/controller.test.ts src/app/matchRuntime.test.ts src/render/titleScene.test.ts src/render/howtoScene.test.ts`
- Then run the full suite, `npx tsc --noEmit`, and a Vite build using D: for temporary/build output.
- Report RED/GREEN evidence, commands/counts, changed files, lifecycle proof, source-of-truth audit,
  golden SHA-256, self-review, and concerns.

Do not initialize Git and do not dispatch subagents.
