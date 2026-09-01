# Task 7 report — integrated iPad acceptance

## Automated gate

Fresh evidence is recorded in `task-7-automated-report.md`:

- Vitest: 52 files / 424 tests passed.
- `npx tsc --noEmit`: exit 0, no diagnostics.
- Vite production build: 62 modules transformed and emitted to a fresh D: directory.
- `spec/test-vectors.json` SHA-256 remained
  `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.

## Browser acceptance

Tested the local Vite app in the in-app browser at 1194x834 landscape, then 834x1194 portrait,
then 1194x834 landscape again.

### Side-by-side loadouts

- The rendered loadout contained two labelled `[data-player]` panels, each 564.2 CSS px wide and
  720 px tall, with the same neutral foreground/background colors.
- The minimum measured shell-card target was 260.3x96 CSS px. The shared Deploy control measured
  1146.4x48.4 px and reported computed `min-width: 44px` / `min-height: 44px`.
- Keyboard traversal placed focus on Deploy with a visible 2.4 px solid outline.
- Both HE controls were disabled, pressed, and announced `FREE · LOCKED · ∞ AMMO`.
- Editing Player 1 Heavy Mortar changed only Player 1 to `7/10 POINTS · 4/5 SLOTS`; editing Player
  2 Roller changed only Player 2 to `8/10 POINTS · 4/5 SLOTS`.
- One Deploy action entered the match. Player 1's HUD deck was HE, Cluster, Bunker Buster, Roller,
  Sandbags. After firing and turn handoff, Player 2's HUD deck was HE, Heavy Mortar, Cluster,
  Bunker Buster, Sandbags. This visibly proves stable distinct tuple deployment into both arsenals.

### Orientation and state preservation

- At 834x1194 the app surface `#app-surface` had `inert` and `aria-hidden="true"` while a sibling
  `role="alertdialog"`, `aria-modal="true"` displayed `Rotate your iPad` and the landscape
  instruction. Only the rotate surface appeared in the accessible snapshot.
- Returning to 1194x834 removed the dialog, inert, and `aria-hidden` attributes.
- The same Terra terrain, both 100 HP values, Player 2 active turn, ammunition/deck values, tank
  positions, and existing Player 1 trail remained after rotation. The active runtime resumed.
- Headless lifecycle tests additionally pin frame cancellation, one-frame resumption, listener
  de-duplication, and exact owner-state preservation, avoiding conclusions based only on canvas
  telemetry timing.

### Gameplay identity and console

- The live match visibly rendered Player 1's tank/health/aim/trail in spec Blue and Player 2's
  tank/health/active treatment in spec Pink. Labels, tank silhouettes, active outlines, and HUD
  position remain non-color cues.
- Terrain and shell-card/icon treatment retained functional colors. Source and focused render tests
  cover projectiles/muzzle effects and ensure TITLE/HOWTO functional accents do not use Blue/Pink.
- Browser console query for warning/error levels returned an empty list.

## Changed-file inventory and deferred Minor triage

The complete reconstructed inserted-plan inventory and all three Task 6 Minor triage entries are in
`task-7-automated-report.md`. Two test-strength Minors remain for final independent review; the
Task 6 inventory documentation gap is satisfied by that complete Task 7 inventory.

## Final independent review and stop

The final whole-task reviewer returned PASS for spec compliance, code quality, and acceptance
evidence. Fresh reviewer checks also observed 52/52 test files passing, clean TypeScript, clean Vite
build, and unchanged golden hash. Full evidence is in `task-7-final-review.md`.

Two inherited Minor test-strength observations are non-blocking: the projectile-owner regression
uses a cast-based test shape, and some recording-canvas identity assertions aggregate both players
rather than pinning every surface mapping individually. Production mappings and propagation are
correct by direct audit and broader tests.

The inserted per-player-loadouts/iPad plan stops here. No Task 12 CPU behavior, Task 13 ammunition
work, or full visual overhaul was started.
